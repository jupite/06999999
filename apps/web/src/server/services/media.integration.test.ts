import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import sharp from "sharp";
import { PrismaClient } from "@/generated/prisma/client";
import { imageIdFromUrl } from "@/media/urls";
import { type Actor } from "../domain/permissions";
import { saveDraft } from "./drafts";
import {
  deletePublishedArticle,
  reviewArticle,
  submitArticle,
  submitArticleEdit,
} from "./articles";
import { readImage, storeImage } from "./media";
import { saveMediaLimits, saveUserMediaAccess } from "./media-settings";

test("uploads enforce quotas and follow the current public article revision", async () => {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString, "DATABASE_URL is required");
  const schema = `media_test_${randomBytes(8).toString("hex")}`;
  const pool = new Pool({ connectionString });
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString, options: `-c search_path=${schema}` }, { schema }),
  });
  const tempRoot = await realpath(tmpdir());
  const root = await mkdtemp(join(tempRoot, "site-media-test-"));
  const previousRoot = process.env.MEDIA_ROOT;
  process.env.MEDIA_ROOT = root;

  try {
    const migrations = await readdir("prisma/migrations", { withFileTypes: true });
    const sql = await Promise.all(
      migrations
        .filter((entry) => entry.isDirectory())
        .map(({ name }) => name)
        .sort()
        .map((name) => readFile(join("prisma/migrations", name, "migration.sql"), "utf8")),
    );
    await pool.query(
      `CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"; ${sql.join("\n")}`,
    );
    const ownerUser = await db.user.create({ data: { githubId: "123", name: "Owner" } });
    const authorUser = await db.user.create({ data: { githubId: "456", name: "Author" } });
    const owner: Actor = { id: ownerUser.id, role: "OWNER", banned: false, overrides: {} };
    const author: Actor = { id: authorUser.id, role: "MEMBER", banned: false, overrides: {} };
    const enabledAuthor: Actor = { ...author, overrides: { "image.upload": "ALLOW" } };
    const png = await sharp({
      create: { width: 40, height: 30, channels: 3, background: "#9959ee" },
    })
      .png()
      .toBuffer();
    const body = () => new Blob([new Uint8Array(png)]).stream();
    const getGuest = async () => null;

    await assert.rejects(storeImage(db, author, body()), { message: "imagePermissionRequired" });
    await assert.rejects(storeImage(db, owner, body()), { message: "mediaUnconfigured" });
    const limits = new FormData();
    limits.set("fileMib", "1");
    limits.set("siteMib", "2");
    await saveMediaLimits(db, owner, limits);
    const access = new FormData();
    access.set("userMib", "1");
    access.set("enabled", "on");
    await saveUserMediaAccess(db, owner, authorUser.githubId, access);

    await assert.rejects(storeImage(db, owner, body()), { message: "userMediaQuotaExceeded" });
    await assert.rejects(storeImage(db, enabledAuthor, new Blob(["<svg></svg>"]).stream()), {
      message: "invalidImage",
    });
    await assert.rejects(
      storeImage(db, enabledAuthor, new Blob([new Uint8Array(1024 * 1024 + 1)]).stream()),
      { message: "imageTooLarge" },
    );
    assert.deepEqual(await readdir(root), []);
    const first = await storeImage(db, enabledAuthor, body());
    const second = await storeImage(db, enabledAuthor, body());
    const firstId = imageIdFromUrl(first.url)!;
    const secondId = imageIdFromUrl(second.url)!;
    const bytes = await readImage(db, firstId, async () => owner);
    assert.ok(bytes);
    assert.equal((await sharp(bytes).metadata()).format, "webp");
    assert.equal(await readImage(db, firstId, getGuest), null);
    assert.ok(await readImage(db, firstId, async () => author));

    await assert.rejects(
      db.$transaction((tx) =>
        saveDraft(tx, owner, { version: 0, title: "Foreign", markdown: `![x](${first.url})` }),
      ),
      { message: "articleImageUnavailable" },
    );
    const draft = await db.$transaction((tx) =>
      saveDraft(tx, author, {
        version: 0,
        title: "Images",
        markdown: `![Old][cover]\n\n[cover]: ${first.url}\n\n\`![code](${second.url})\``,
      }),
    );
    await db.$transaction((tx) => submitArticle(tx, author, draft.id, draft.version));
    assert.equal(await readImage(db, firstId, getGuest), null);
    await db.$transaction((tx) => reviewArticle(tx, owner, draft.id, draft.version, "approve", ""));
    assert.ok(await readImage(db, firstId, getGuest));
    assert.equal(await readImage(db, secondId, getGuest), null);

    await db.$transaction((tx) =>
      submitArticleEdit(tx, author, {
        ...draft,
        markdown: `![New](${second.url})`,
      }),
    );
    assert.ok(await readImage(db, firstId, getGuest));
    assert.equal(await readImage(db, secondId, getGuest), null);
    await db.$transaction((tx) => reviewArticle(tx, owner, draft.id, 2, "approve", ""));
    assert.equal(await readImage(db, firstId, getGuest), null);
    assert.ok(await readImage(db, secondId, getGuest));
    await db.$transaction((tx) => deletePublishedArticle(tx, author, draft.id, 2));
    assert.equal(await readImage(db, secondId, getGuest), null);

    const single = BigInt(bytes.length);
    await db.siteSettings.update({
      where: { id: "site" },
      data: { totalMediaLimitBytes: 3n * single },
    });
    const uploads = await Promise.allSettled([
      storeImage(db, enabledAuthor, body()),
      storeImage(db, enabledAuthor, body()),
    ]);
    assert.equal(uploads.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = uploads.find((result) => result.status === "rejected");
    assert.equal(rejected?.reason.message, "siteMediaQuotaExceeded");
    assert.equal(await db.media.count(), 3);
    assert.equal((await readdir(root)).length, 3);
    const quota = await db.storageQuota.findUniqueOrThrow({ where: { userId: author.id } });
    assert.equal(quota.usedBytes, 3n * single);

    access.delete("enabled");
    await saveUserMediaAccess(db, owner, authorUser.githubId, access);
    await assert.rejects(storeImage(db, enabledAuthor, body()), { message: "permissionDenied" });
    assert.equal(await db.auditLog.count({ where: { action: "media.updateUserAccess" } }), 2);
  } finally {
    if (previousRoot === undefined) delete process.env.MEDIA_ROOT;
    else process.env.MEDIA_ROOT = previousRoot;
    await db.$disconnect();
    try {
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await pool.end();
      const resolved = await realpath(root);
      if (resolved === root && dirname(resolved) === tempRoot) {
        await rm(resolved, { recursive: true, force: true });
      }
    }
  }
});
