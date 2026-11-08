import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { saveDraft, deleteDraft } from "./drafts";
import {
  submitArticle,
  reviewArticle,
  copyRejectedArticle,
  readPublishedArticle,
  listPublishedArticles,
  listPendingArticles,
  readPendingArticle,
  listMyArticles,
  readMyArticle,
} from "./articles";
import type { Actor } from "../domain/permissions";

test("article submission and review isolate private content and publish only the approved version", async () => {
  const db = getDb();
  const rollback = new Error("ROLLBACK_ARTICLE_TESTS");
  try {
    await assert.rejects(
      db.$transaction(
        async (tx) => {
          async function actor(role: "MEMBER" | "OWNER"): Promise<Actor> {
            const user = await tx.user.create({
              data: { githubId: `article-test-${randomUUID()}`, name: "文章测试" },
            });
            return { id: user.id, role, banned: false, overrides: {} };
          }
          const member = await actor("MEMBER"),
            owner = await actor("OWNER"),
            other = await actor("MEMBER");
          const draft = await saveDraft(tx, member, {
            version: 0,
            title: "待审核标题",
            markdown: "私人正文",
          });
          const content = await tx.content.findUniqueOrThrow({ where: { id: draft.id } });
          assert.equal(await readPublishedArticle(tx, content.slug), null);
          assert.equal(await readMyArticle(tx, other, draft.id), null);
          await assert.rejects(submitArticle(tx, null, draft.id, 1));
          await assert.rejects(submitArticle(tx, owner, draft.id, 1));
          await assert.rejects(submitArticle(tx, { ...member, banned: true }, draft.id, 1));
          await assert.rejects(
            submitArticle(tx, { ...member, overrides: { "post.submit": "DENY" } }, draft.id, 1),
          );
          const saved = await saveDraft(tx, member, { ...draft, markdown: "更新后的私人正文" });
          await assert.rejects(submitArticle(tx, member, draft.id, 1));
          const submitted = await submitArticle(tx, member, draft.id, saved.version);
          assert.equal(submitted.state, "PENDING_HUMAN");
          assert.equal(await readPublishedArticle(tx, content.slug), null);
          assert.ok(!(await listPublishedArticles(tx)).some((a) => a.slug === content.slug));
          assert.equal(
            (await readMyArticle(tx, member, draft.id))?.revisions[0].state,
            "PENDING_HUMAN",
          );
          await assert.rejects(saveDraft(tx, member, saved));
          await assert.rejects(deleteDraft(tx, member, saved.id, saved.version));
          await assert.rejects(submitArticle(tx, member, draft.id, saved.version));
          await assert.rejects(listPendingArticles(tx, member));
          await assert.rejects(readPendingArticle(tx, member, draft.id));
          await assert.rejects(reviewArticle(tx, member, draft.id, saved.version, "approve", ""));
          await assert.rejects(
            reviewArticle(
              tx,
              { ...owner, overrides: { "site.manage": "DENY" } },
              draft.id,
              saved.version,
              "approve",
              "",
            ),
          );
          await assert.rejects(reviewArticle(tx, owner, draft.id, 1, "approve", ""));
          await assert.rejects(reviewArticle(tx, owner, draft.id, saved.version, "reject", ""));
          assert.ok((await listPendingArticles(tx, owner)).some((a) => a.id === draft.id));
          await reviewArticle(tx, owner, draft.id, saved.version, "reject", "请补充细节");
          assert.equal(await readPublishedArticle(tx, content.slug), null);
          assert.equal(
            (await readMyArticle(tx, member, draft.id))?.revisions[0].reviews[0].reason,
            "请补充细节",
          );
          await assert.rejects(reviewArticle(tx, owner, draft.id, saved.version, "approve", ""));
          await assert.rejects(copyRejectedArticle(tx, other, draft.id, saved.version));
          const copy = await copyRejectedArticle(tx, member, draft.id, saved.version);
          assert.notEqual(copy.id, draft.id);
          assert.equal(copy.markdown, saved.markdown);
          const resubmitted = await submitArticle(tx, member, copy.id, copy.version);
          await reviewArticle(tx, owner, copy.id, copy.version, "approve", "通过");
          assert.equal(
            (await readPublishedArticle(tx, resubmitted.slug))?.markdown,
            saved.markdown,
          );
          await assert.rejects(
            reviewArticle(tx, owner, copy.id, copy.version, "reject", "重复审核"),
          );
          // Even if a newer private revision exists, only the published pointer may be served.
          await tx.contentRevision.create({
            data: {
              contentId: copy.id,
              version: 2,
              title: "秘密标题",
              markdown: "秘密正文",
              state: "DRAFT",
            },
          });
          await tx.content.update({ where: { id: copy.id }, data: { currentVersion: 2 } });
          assert.equal(
            (await readPublishedArticle(tx, resubmitted.slug))?.markdown,
            saved.markdown,
          );
          assert.equal(
            (await listPublishedArticles(tx)).find((a) => a.slug === resubmitted.slug)?.title,
            "待审核标题",
          );
          const direct = await saveDraft(tx, owner, {
            version: 0,
            title: "站主文章",
            markdown: "公开正文",
          });
          const published = await submitArticle(tx, owner, direct.id, direct.version);
          assert.equal(published.state, "PUBLISHED");
          assert.ok((await readPublishedArticle(tx, published.slug))?.publishedAt);
          assert.equal((await listMyArticles(tx, other)).length, 0);
          const bannedDraft = await saveDraft(tx, other, {
            version: 0,
            title: "封禁检查",
            markdown: "正文",
          });
          const bannedSubmission = await submitArticle(
            tx,
            other,
            bannedDraft.id,
            bannedDraft.version,
          );
          await tx.user.update({ where: { id: other.id }, data: { banned: true } });
          await assert.rejects(
            reviewArticle(tx, owner, bannedDraft.id, bannedDraft.version, "approve", ""),
          );
          assert.equal(await readPublishedArticle(tx, bannedSubmission.slug), null);
          await reviewArticle(
            tx,
            owner,
            bannedDraft.id,
            bannedDraft.version,
            "reject",
            "作者账号已封禁",
          );
          const empty = await saveDraft(tx, owner, { version: 0, title: "空正文", markdown: " " });
          await assert.rejects(submitArticle(tx, owner, empty.id, empty.version));
          assert.equal(await tx.moderationReview.count({ where: { reviewerId: owner.id } }), 4);
          assert.ok((await tx.auditLog.count({ where: { actorId: owner.id } })) >= 4);
          throw rollback;
        },
        { timeout: 30000 },
      ),
      (error) => error === rollback,
    );
  } finally {
    await db.$disconnect();
  }
});
