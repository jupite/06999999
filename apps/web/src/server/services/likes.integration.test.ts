import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { accountActor } from "../domain/permissions";
import { readArticleLike, setArticleLike } from "./likes";

test("likes enforce publication, current permissions, and concurrent idempotency", async () => {
  const db = getDb();
  const suffix = randomUUID();
  const user = await db.user.create({
    data: { githubId: `likes-test-${suffix}`, name: "Like test" },
  });
  const actor = accountActor({ ...user, permissions: [] }, undefined);
  let contentId: string | undefined;
  try {
    const content = await db.content.create({
      data: {
        authorId: user.id,
        kind: "POST",
        slug: `likes-${suffix}`,
        publishedVersion: 1,
        revisions: { create: { version: 1, title: "Like test", state: "PUBLISHED" } },
      },
    });
    contentId = content.id;
    assert.deepEqual(await readArticleLike(db, null, content.slug), { count: 0, liked: false });
    await assert.rejects(setArticleLike(db, null, content.slug, true), { key: "loginRequired" });
    const concurrent = await Promise.all(
      Array.from({ length: 5 }, () => setArticleLike(db, actor, content.slug, true)),
    );
    assert.ok(concurrent.every((result) => result.count === 1 && result.liked));
    assert.deepEqual(await readArticleLike(db, actor, content.slug), { count: 1, liked: true });
    assert.deepEqual(await setArticleLike(db, actor, content.slug, false), {
      count: 0,
      liked: false,
    });
    assert.deepEqual(await setArticleLike(db, actor, content.slug, false), {
      count: 0,
      liked: false,
    });
    await db.permissionOverride.create({
      data: { userId: user.id, capability: "like.toggle", effect: "DENY" },
    });
    await assert.rejects(setArticleLike(db, actor, content.slug, true), {
      key: "permissionDenied",
    });
    await db.permissionOverride.deleteMany({ where: { userId: user.id } });
    await db.user.update({ where: { id: user.id }, data: { banned: true } });
    await assert.rejects(setArticleLike(db, actor, content.slug, true), { key: "accountBanned" });
    await db.user.update({ where: { id: user.id }, data: { banned: false } });
    await db.content.update({ where: { id: content.id }, data: { publishedVersion: null } });
    await assert.rejects(readArticleLike(db, null, content.slug), { key: "likeArticleMissing" });
    await assert.rejects(setArticleLike(db, actor, content.slug, true), {
      key: "likeArticleMissing",
    });
  } finally {
    if (contentId) await db.content.deleteMany({ where: { id: contentId } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});

test("project likes use IDs, isolate content kinds, and batch only public states", async () => {
  const db = getDb();
  const user = await db.user.create({
    data: { githubId: `project-like-${randomUUID()}`, name: "Project like test" },
  });
  const actor = accountActor({ ...user, permissions: [] }, undefined);
  const ids: string[] = [];
  try {
    const project = await db.content.create({
      data: {
        kind: "PROJECT",
        authorId: user.id,
        slug: randomUUID(),
        publishedVersion: 1,
        revisions: { create: { version: 1, title: "test", state: "PUBLISHED" } },
      },
    });
    ids.push(project.id);
    const article = await db.content.create({
      data: {
        kind: "POST",
        authorId: user.id,
        slug: randomUUID(),
        publishedVersion: 1,
        revisions: { create: { version: 1, title: "test", state: "PUBLISHED" } },
      },
    });
    ids.push(article.id);
    const { readContentLike, setContentLike, readProjectLikes } = await import("./likes");
    await assert.rejects(readContentLike(db, actor, article.id, "PROJECT"), {
      key: "likeProjectMissing",
    });
    await assert.rejects(readContentLike(db, actor, project.slug, "POST"), {
      key: "likeArticleMissing",
    });
    const results = await Promise.all(
      Array.from({ length: 5 }, () => setContentLike(db, actor, project.id, true, "PROJECT")),
    );
    assert.ok(results.every((result) => result.count === 1 && result.liked));
    const states = await readProjectLikes(db, actor, ids);
    assert.deepEqual(states.get(project.id), { count: 1, liked: true });
    assert.equal(states.has(article.id), false);
    assert.deepEqual(await setContentLike(db, actor, project.id, false, "PROJECT"), {
      count: 0,
      liked: false,
    });
    await db.content.update({ where: { id: project.id }, data: { publishedVersion: null } });
    assert.equal((await readProjectLikes(db, actor, ids)).size, 0);
    await assert.rejects(setContentLike(db, actor, project.id, true, "PROJECT"), {
      key: "likeProjectMissing",
    });
  } finally {
    await db.content.deleteMany({ where: { id: { in: ids } } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
