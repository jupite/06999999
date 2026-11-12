import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { accountActor } from "../domain/permissions";
import {
  listArticleComments,
  listPendingComments,
  submitArticleComment,
  reviewArticleComment,
} from "./comments";
test("comments protect public visibility, authors, review state, replay and permissions", async () => {
  const db = getDb(),
    rollback = new Error("ROLLBACK_COMMENT_TEST");
  try {
    await assert.rejects(
      db.$transaction(
        async (tx) => {
          const suffix = randomUUID();
          const owner = await tx.user.create({
            data: { githubId: `local:comment-${suffix}`, name: "Comment owner", role: "OWNER" },
          });
          const member = await tx.user.create({
            data: { githubId: `comment-${suffix}`, name: "Comment member" },
          });
          const manager = accountActor({ ...owner, permissions: [] }, undefined),
            author = accountActor({ ...member, permissions: [] }, undefined);
          const article = await tx.content.create({
            data: {
              authorId: owner.id,
              slug: `comments-${suffix}`,
              kind: "POST",
              publishedVersion: 1,
              revisions: { create: { version: 1, title: "Test", state: "PUBLISHED" } },
            },
          });
          const id = randomUUID(),
            input = { id, body: "<script>alert(1)</script>\nplain text" };
          await assert.rejects(submitArticleComment(tx, null, article.slug, input), {
            key: "loginRequired",
          });
          await assert.rejects(submitArticleComment(tx, author, article.slug, { id, body: " " }), {
            key: "invalidComment",
          });
          const pending = await submitArticleComment(tx, author, article.slug, input);
          assert.equal(pending.state, "PENDING_HUMAN");
          assert.deepEqual(await submitArticleComment(tx, author, article.slug, input), pending);
          assert.equal(await tx.comment.count({ where: { id } }), 1);
          await assert.rejects(submitArticleComment(tx, manager, article.slug, input), {
            key: "commentConflict",
          });
          assert.equal((await listArticleComments(tx, article.slug)).length, 0);
          assert.ok((await listPendingComments(tx, manager)).some((comment) => comment.id === id));
          assert.throws(() => listPendingComments(tx, author), { key: "ownerOnly" });
          await assert.rejects(reviewArticleComment(tx, author, id, 1, "approve", ""), {
            key: "ownerOnly",
          });
          await assert.rejects(reviewArticleComment(tx, manager, id, 1, "reject", ""), {
            key: "reviewReasonRequired",
          });
          await tx.permissionOverride.create({
            data: { userId: member.id, capability: "comment.submit", effect: "DENY" },
          });
          await assert.rejects(reviewArticleComment(tx, manager, id, 1, "approve", ""), {
            key: "permissionDenied",
          });
          await tx.permissionOverride.deleteMany({ where: { userId: member.id } });
          await reviewArticleComment(tx, manager, id, 1, "approve", "");
          assert.equal((await listArticleComments(tx, article.slug))[0].body, input.body);
          await assert.rejects(reviewArticleComment(tx, manager, id, 1, "reject", "reason"), {
            key: "commentReviewConflict",
          });
          const rejectedId = randomUUID();
          await submitArticleComment(tx, author, article.slug, {
            id: rejectedId,
            body: "reject me",
          });
          await reviewArticleComment(tx, manager, rejectedId, 1, "reject", "Not suitable");
          assert.equal((await listArticleComments(tx, article.slug)).length, 1);
          const direct = await submitArticleComment(tx, manager, article.slug, {
            id: randomUUID(),
            body: "Owner direct",
          });
          assert.equal(direct.state, "PUBLISHED");
          const queued = await submitArticleComment(tx, author, article.slug, {
            id: randomUUID(),
            body: "wait",
          });
          await tx.user.update({ where: { id: member.id }, data: { banned: true } });
          await assert.rejects(reviewArticleComment(tx, manager, queued.id, 1, "approve", ""), {
            key: "accountBanned",
          });
          await tx.user.update({ where: { id: member.id }, data: { banned: false } });
          await submitArticleComment(tx, author, article.slug, { id: randomUUID(), body: "four" });
          await submitArticleComment(tx, author, article.slug, { id: randomUUID(), body: "five" });
          await assert.rejects(
            submitArticleComment(tx, author, article.slug, { id: randomUUID(), body: "six" }),
            { key: "commentRateLimited" },
          );
          await tx.content.update({ where: { id: article.id }, data: { publishedVersion: null } });
          await assert.rejects(listArticleComments(tx, article.slug), {
            key: "likeArticleMissing",
          });
          await assert.rejects(
            submitArticleComment(tx, author, article.slug, { id: randomUUID(), body: "new" }),
            { key: "likeArticleMissing" },
          );
          await assert.rejects(reviewArticleComment(tx, manager, queued.id, 1, "approve", ""), {
            key: "likeArticleMissing",
          });
          await reviewArticleComment(tx, manager, queued.id, 1, "reject", "Article withdrawn");
          assert.equal(await tx.moderationReview.count({ where: { commentId: id } }), 1);
          throw rollback;
        },
        { timeout: 15000 },
      ),
      (error) => error === rollback,
    );
  } finally {
    await db.$disconnect();
  }
});
