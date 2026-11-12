import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { accountActor, authorize } from "../domain/permissions";
import { featureKeys } from "../domain/features";
import { resolveAccountActor } from "../access";
import { listFeatures, updateFeature } from "./features";
import { saveDraft, deleteDraft } from "./drafts";
import { submitArticle, reviewArticle } from "./articles";
import { submitProject } from "./projects";
import { submitPhoto } from "./photos";
import { submitFriend } from "./friends";
import { submitArticleComment } from "./comments";
import { setContentLike } from "./likes";
import { storeImage } from "./media";
import { withdrawOwnSubmission } from "./withdrawal";

test("global flags block real mutations, grants and owners while keeping management accessible", async () => {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString);
  const schema = `features_test_${randomBytes(8).toString("hex")}`;
  const pool = new Pool({ connectionString, max: 1 });
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString, options: `-c search_path=${schema}` }, { schema }),
  });
  try {
    const entries = await readdir("prisma/migrations", { withFileTypes: true });
    const sql = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
        .map((name) => readFile(join("prisma/migrations", name, "migration.sql"), "utf8")),
    );
    await pool.query(
      `CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"; ${sql.join("\n")}`,
    );
    const owner = await db.user.create({
        data: { githubId: "local:feature-owner", name: "Owner", role: "OWNER" },
      }),
      member = await db.user.create({ data: { githubId: "123456", name: "Member" } });
    await db.permissionOverride.createMany({
      data: featureKeys.map((capability) => ({
        userId: member.id,
        capability,
        effect: "ALLOW" as const,
      })),
    });
    const permissions = featureKeys.map((capability) => ({ capability, effect: "ALLOW" as const }));
    const actor = accountActor({ ...member, permissions }, undefined),
      manager = accountActor({ ...owner, permissions: [] }, undefined);
    assert.equal((await listFeatures(db, manager)).length, 8);
    assert.ok((await listFeatures(db, manager)).every((flag) => flag.enabled));
    await assert.rejects(listFeatures(db, null), { key: "loginRequired" });
    await assert.rejects(listFeatures(db, actor), { key: "ownerOnly" });
    await assert.rejects(
      db.$transaction((tx) =>
        updateFeature(tx, actor, "post.submit", { enabled: false, expectedEnabled: true }),
      ),
      { key: "ownerOnly" },
    );
    await assert.rejects(
      db.$transaction((tx) =>
        updateFeature(tx, manager, "site.manage", { enabled: false, expectedEnabled: true }),
      ),
      { key: "featureUnknown" },
    );
    const article = await db.content.create({
      data: {
        kind: "POST",
        authorId: owner.id,
        slug: randomUUID(),
        publishedVersion: 1,
        revisions: { create: { version: 1, title: "Public", state: "PUBLISHED" } },
      },
    });
    const pendingArticle = await db.content.create({
      data: {
        kind: "POST",
        authorId: member.id,
        slug: randomUUID(),
        revisions: { create: { version: 1, title: "Pending", state: "PENDING_HUMAN" } },
      },
    });
    const draft = await db.content.create({
      data: {
        kind: "POST",
        authorId: member.id,
        slug: randomUUID(),
        revisions: { create: { version: 1, title: "Draft", state: "DRAFT" } },
      },
    });
    const photo = await db.content.create({
      data: {
        kind: "PHOTO",
        authorId: member.id,
        slug: randomUUID(),
        revisions: { create: { version: 1, title: "Photo", state: "PENDING_HUMAN" } },
      },
    });
    const media = await db.media.create({
      data: {
        id: randomUUID(),
        ownerId: member.id,
        storageKey: "fixture.webp",
        mimeType: "image/webp",
        ready: true,
        bytes: 0,
      },
    });
    function form(extra: Record<string, string> = {}) {
      const value = new FormData();
      for (const [k, v] of Object.entries({
        submissionId: randomUUID(),
        title: "Test",
        summary: "Summary",
        url: "https://example.com",
        imageUrl: `/api/media/${media.id}`,
        categoryId: "",
        tagText: "",
        ...extra,
      }))
        value.set(k, v);
      return value;
    }
    const disabled = (error: unknown) => {
      const e = error as { key?: string; notice?: string | { key: string; reason?: string } };
      return (
        e.key === "featureDisabled" ||
        e.notice === "featureDisabled" ||
        (typeof e.notice === "object" && e.notice.reason === "featureDisabled")
      );
    };
    for (const key of featureKeys) {
      await db.$transaction((tx) =>
        updateFeature(tx, manager, key, { enabled: false, expectedEnabled: true }),
      );
      const current = await resolveAccountActor(db, { ...member, permissions });
      const currentOwner = await resolveAccountActor(db, { ...owner, permissions: [] });
      assert.equal(authorize(current, key).reason, "featureDisabled");
      assert.equal(authorize(currentOwner, key).reason, "featureDisabled");
      assert.equal(authorize(currentOwner, "site.manage").allowed, true);
      if (key === "post.submit") {
        await assert.rejects(
          db.$transaction((tx) => saveDraft(tx, actor, { title: "New", markdown: "", version: 0 })),
          disabled,
        );
        await assert.rejects(
          db.$transaction((tx) => submitArticle(tx, actor, draft.id, 1)),
          disabled,
        );
        await assert.rejects(
          db.$transaction((tx) => reviewArticle(tx, manager, pendingArticle.id, 1, "approve", "")),
          disabled,
        );
      } else if (key === "project.submit")
        await assert.rejects(
          db.$transaction((tx) => submitProject(tx, actor, form())),
          disabled,
        );
      else if (key === "photo.submit")
        await assert.rejects(
          db.$transaction((tx) => submitPhoto(tx, actor, form())),
          disabled,
        );
      else if (key === "friend.submit")
        await assert.rejects(
          db.$transaction((tx) => submitFriend(tx, actor, form())),
          disabled,
        );
      else if (key === "comment.submit")
        await assert.rejects(
          db.$transaction((tx) =>
            submitArticleComment(tx, actor, article.slug, { id: randomUUID(), body: "Comment" }),
          ),
          disabled,
        );
      else if (key === "like.toggle")
        await assert.rejects(setContentLike(db, actor, article.slug, true), disabled);
      else if (key === "image.upload")
        await assert.rejects(storeImage(db, current, new Blob(["unused"]).stream()), disabled);
      else if (key === "content.editOwn") {
        await assert.rejects(
          db.$transaction((tx) => deleteDraft(tx, actor, draft.id, 1)),
          disabled,
        );
        await assert.rejects(
          db.$transaction((tx) =>
            withdrawOwnSubmission(tx, actor, photo.id, 1, "PHOTO", "PENDING_HUMAN"),
          ),
          disabled,
        );
      }
      await assert.rejects(
        db.$transaction((tx) =>
          updateFeature(tx, manager, key, { enabled: true, expectedEnabled: true }),
        ),
        { key: "featureConflict" },
      );
      await db.$transaction((tx) =>
        updateFeature(tx, manager, key, { enabled: true, expectedEnabled: false }),
      );
    }
    assert.equal(await db.auditLog.count({ where: { action: "feature.update" } }), 16);
    assert.equal(
      (await db.content.findUniqueOrThrow({ where: { id: article.id } })).publishedVersion,
      1,
    );
    assert.equal(await db.like.count(), 0);
    assert.equal(await db.comment.count(), 0);
    assert.equal(
      (
        await db.contentRevision.findUniqueOrThrow({
          where: { contentId_version: { contentId: photo.id, version: 1 } },
        })
      ).state,
      "PENDING_HUMAN",
    );
  } finally {
    await db.$disconnect();
    try {
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await pool.end();
    }
  }
});
