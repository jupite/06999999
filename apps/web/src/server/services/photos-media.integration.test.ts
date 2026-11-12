import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import sharp from "sharp";
import { accountActor } from "../domain/permissions";
import { imageIdFromUrl } from "@/media/urls";
import { readImage, storeImage } from "./media";
import { submitPhoto, reviewPhoto, listPublicPhotos } from "./photos";

test("photo uploads stay private until approval and use the existing storage quota", async () => {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString);
  const schema = `photo_media_test_${randomBytes(8).toString("hex")}`;
  const pool = new Pool({ connectionString, max: 1 });
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString, options: `-c search_path=${schema}` }, { schema }),
  });
  const tempRoot = await realpath(tmpdir()),
    root = await mkdtemp(join(tempRoot, "photo-media-test-"));
  const previousRoot = process.env.MEDIA_ROOT;
  process.env.MEDIA_ROOT = root;
  try {
    const migrations = await readdir("prisma/migrations", { withFileTypes: true });
    const sql = await Promise.all(
      migrations
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
        .map((name) => readFile(join("prisma/migrations", name, "migration.sql"), "utf8")),
    );
    await pool.query(
      `CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"; ${sql.join("\n")}`,
    );
    const owner = await db.user.create({
      data: { githubId: "local:photo-owner", name: "Owner", role: "OWNER" },
    });
    const member = await db.user.create({ data: { githubId: "123456789", name: "Member" } });
    await db.permissionOverride.create({
      data: { userId: member.id, capability: "image.upload", effect: "ALLOW" },
    });
    await db.storageQuota.create({ data: { userId: member.id, limitBytes: 10000000 } });
    await db.siteSettings.create({
      data: { id: "site", maxImageBytes: 1000000, totalMediaLimitBytes: 20000000 },
    });
    const author = accountActor(
        { ...member, permissions: [{ capability: "image.upload", effect: "ALLOW" as const }] },
        undefined,
      ),
      manager = accountActor({ ...owner, permissions: [] }, undefined);
    const png = await sharp({
      create: { width: 40, height: 30, channels: 3, background: "#9959ee" },
    })
      .png()
      .toBuffer();
    const upload = await storeImage(db, author, new Blob([new Uint8Array(png)]).stream());
    const mediaId = imageIdFromUrl(upload.url)!;
    assert.equal(await readImage(db, mediaId, async () => null), null);
    assert.ok(await readImage(db, mediaId, async () => author));
    const form = new FormData();
    for (const [k, v] of Object.entries({
      submissionId: randomUUID(),
      title: "Real photo upload",
      summary: "Caption",
      imageUrl: upload.url,
      categoryId: "",
      tagText: "",
    }))
      form.set(k, v);
    const photo = await db.$transaction((tx) => submitPhoto(tx, author, form));
    assert.equal((await listPublicPhotos(db)).length, 0);
    assert.equal(await readImage(db, mediaId, async () => null), null);
    const approve = new FormData();
    approve.set("decision", "approve");
    approve.set("reason", "");
    await db.$transaction((tx) => reviewPhoto(tx, manager, photo.id, 1, approve));
    assert.equal((await listPublicPhotos(db))[0].id, photo.id);
    const publicImage = await readImage(db, mediaId, async () => null);
    assert.ok(publicImage);
    assert.equal((await sharp(publicImage).metadata()).format, "webp");
    const quota = await db.storageQuota.findUniqueOrThrow({ where: { userId: member.id } });
    const media = await db.media.findUniqueOrThrow({ where: { id: mediaId } });
    assert.equal(quota.usedBytes, media.bytes);
  } finally {
    if (previousRoot === undefined) delete process.env.MEDIA_ROOT;
    else process.env.MEDIA_ROOT = previousRoot;
    await db.$disconnect();
    try {
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await pool.end();
      const resolved = await realpath(root);
      if (resolved === root && dirname(resolved) === tempRoot)
        await rm(resolved, { recursive: true, force: true });
    }
  }
});
