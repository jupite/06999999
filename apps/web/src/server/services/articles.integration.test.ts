import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { saveDraft, deleteDraft } from "./drafts";
import { createArticleCategory } from "./article-taxonomy";
import { listPublishedTerms } from "./public-articles";
import {
  submitArticle,
  submitArticleEdit,
  deletePublishedArticle,
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

test("public taxonomy follows only the approved article version", async () => {
  const db = getDb();
  const rollback = new Error("ROLLBACK_TAXONOMY_TEST");
  try {
    await assert.rejects(
      db.$transaction(
        async (tx) => {
          const suffix = randomUUID().slice(0, 8);
          const user = await tx.user.create({
            data: { githubId: `category-author-${suffix}`, name: "Author" },
          });
          const admin = await tx.user.create({
            data: { githubId: `category-owner-${suffix}`, name: "Owner" },
          });
          const author: Actor = { id: user.id, role: "MEMBER", banned: false, overrides: {} };
          const owner: Actor = { id: admin.id, role: "OWNER", banned: false, overrides: {} };
          await assert.rejects(createArticleCategory(tx, author, "Forbidden"), {
            message: "ownerOnly",
          });
          const first = await createArticleCategory(tx, owner, `分类 ${suffix}`);
          const second = await createArticleCategory(tx, owner, `新分类 ${suffix}`);
          await assert.rejects(createArticleCategory(tx, owner, ` ${first.name} `), {
            message: "categoryNameTaken",
          });

          const originalTag = `标签 ${suffix}`;
          const replacementTag = `新标签 ${suffix}`;
          const draft = await saveDraft(tx, author, {
            version: 0,
            title: "Article taxonomy",
            markdown: "Draft",
            categoryId: first.id,
            tagText: `${originalTag}，${originalTag}`,
          });
          const updated = await saveDraft(tx, author, {
            id: draft.id,
            version: draft.version,
            title: draft.title,
            markdown: "Ready",
          });
          assert.equal(updated.categoryId, first.id);
          assert.equal(updated.tagText, originalTag);
          const oldTag = await tx.tag.findUniqueOrThrow({ where: { name: originalTag } });
          assert.ok(!(await listPublishedTerms(tx)).tags.some((term) => term.id === oldTag.id));
          assert.ok(
            !(await listPublishedTerms(tx)).categories.some((term) => term.id === first.id),
          );
          const submitted = await submitArticle(tx, author, draft.id, updated.version);
          assert.equal((await listPublishedArticles(tx, 1, { tagId: oldTag.id })).length, 0);
          await reviewArticle(tx, owner, draft.id, updated.version, "approve", "");
          assert.equal((await readPublishedArticle(tx, submitted.slug))?.category?.id, first.id);
          assert.equal(
            (await listPublishedArticles(tx, 1, { categoryId: first.id, tagId: oldTag.id }))[0]
              ?.slug,
            submitted.slug,
          );

          await submitArticleEdit(tx, author, {
            ...updated,
            categoryId: second.id,
            tagText: replacementTag,
          });
          const newTag = await tx.tag.findUniqueOrThrow({ where: { name: replacementTag } });
          assert.deepEqual(
            (await readPendingArticle(tx, owner, draft.id))?.revisions[0].tags.map((tag) => tag.id),
            [newTag.id],
          );
          assert.ok(!(await listPublishedTerms(tx)).tags.some((term) => term.id === newTag.id));
          assert.equal((await listPublishedArticles(tx, 1, { categoryId: second.id })).length, 0);
          assert.equal((await readPublishedArticle(tx, submitted.slug))?.category?.id, first.id);
          await reviewArticle(tx, owner, draft.id, updated.version + 1, "approve", "");
          assert.equal((await listPublishedArticles(tx, 1, { tagId: oldTag.id })).length, 0);
          assert.ok(
            !(await listPublishedTerms(tx)).categories.some((term) => term.id === first.id),
          );
          assert.equal(
            (await listPublishedArticles(tx, 1, { categoryId: first.id, tagId: newTag.id })).length,
            0,
          );
          assert.equal(
            (await listPublishedArticles(tx, 1, { categoryId: second.id, tagId: newTag.id }))[0]
              ?.slug,
            submitted.slug,
          );
          assert.equal((await readPublishedArticle(tx, submitted.slug))?.tags[0].id, newTag.id);
          throw rollback;
        },
        { timeout: 30_000 },
      ),
      (error) => error === rollback,
    );
  } finally {
    await db.$disconnect();
  }
});

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

test("article filters, edits and deletion respect ownership and published revisions", async () => {
  const db = getDb();
  const rollback = new Error("ROLLBACK_DELETE_TESTS");
  try {
    await assert.rejects(
      db.$transaction(
        async (tx) => {
          const user = await tx.user.create({
            data: { githubId: `delete-test-${randomUUID()}`, name: "删除测试" },
          });
          const another = await tx.user.create({
            data: { githubId: `delete-test-${randomUUID()}`, name: "其他用户" },
          });
          const actor: Actor = { id: user.id, role: "OWNER", banned: false, overrides: {} };
          const other: Actor = { ...actor, id: another.id };
          const draft = await saveDraft(tx, actor, {
            version: 0,
            title: "将删除的公开文章",
            markdown: "内容",
          });
          const published = await submitArticle(tx, actor, draft.id, draft.version);
          for (let i = 0; i < 23; i++)
            await saveDraft(tx, actor, { version: 0, title: `草稿 ${i}`, markdown: "" });
          assert.equal((await listMyArticles(tx, actor, 1, "published")).length, 1);
          assert.equal((await listMyArticles(tx, actor, 1, "draft")).length, 21);
          assert.equal((await listMyArticles(tx, actor, 2, "draft")).length, 3);
          assert.equal((await listMyArticles(tx, actor, 1, "pending")).length, 0);
          assert.equal((await listMyArticles(tx, other, 1, "published")).length, 0);
          await assert.rejects(deletePublishedArticle(tx, null, draft.id, draft.version));
          await assert.rejects(deletePublishedArticle(tx, other, draft.id, draft.version));
          await assert.rejects(
            deletePublishedArticle(tx, { ...actor, banned: true }, draft.id, draft.version),
          );
          await assert.rejects(
            deletePublishedArticle(
              tx,
              { ...actor, overrides: { "content.editOwn": "DENY" } },
              draft.id,
              draft.version,
            ),
          );
          await assert.rejects(deletePublishedArticle(tx, actor, draft.id, draft.version + 1));
          assert.ok(await readPublishedArticle(tx, published.slug));
          await deletePublishedArticle(tx, actor, draft.id, draft.version);
          assert.equal(await readPublishedArticle(tx, published.slug), null);
          assert.ok(
            !(await listPublishedArticles(tx)).some((item) => item.slug === published.slug),
          );
          assert.equal(await readMyArticle(tx, actor, draft.id), null);
          assert.equal((await listMyArticles(tx, actor, 1, "published")).length, 0);
          assert.equal((await listMyArticles(tx, actor, 2)).length, 3);
          await assert.rejects(deletePublishedArticle(tx, actor, draft.id, draft.version));
          await assert.rejects(submitArticle(tx, actor, draft.id, draft.version));
          assert.equal(
            (await tx.content.findUniqueOrThrow({ where: { id: draft.id } })).publishedVersion,
            null,
          );
          assert.equal(
            await tx.moderationReview.count({ where: { revision: { contentId: draft.id } } }),
            2,
          );
          assert.equal(
            await tx.auditLog.count({ where: { targetId: draft.id, action: "article.delete" } }),
            1,
          );
          const fresh = await saveDraft(tx, actor, {
            version: 0,
            title: "未发布",
            markdown: "内容",
          });
          await assert.rejects(deletePublishedArticle(tx, actor, fresh.id, fresh.version));
          const member: Actor = { ...other, role: "MEMBER" };
          const pending = await saveDraft(tx, member, {
            version: 0,
            title: "待审核",
            markdown: "内容",
          });
          await submitArticle(tx, member, pending.id, pending.version);
          assert.equal((await listMyArticles(tx, member, 1, "draft")).length, 0);
          assert.equal((await listMyArticles(tx, member, 1, "pending")).length, 1);
          await reviewArticle(tx, actor, pending.id, pending.version, "reject", "需要补充");
          assert.equal((await listMyArticles(tx, member, 1, "pending")).length, 0);
          assert.equal((await listMyArticles(tx, member, 1, "rejected")).length, 1);

          const toPublish = await copyRejectedArticle(tx, member, pending.id, pending.version);
          const original = await submitArticle(tx, member, toPublish.id, toPublish.version);
          await reviewArticle(tx, actor, toPublish.id, toPublish.version, "approve", "");
          const edit = { ...toPublish, title: "修改标题", markdown: "待审核的新正文" };
          await assert.rejects(submitArticleEdit(tx, actor, edit), {
            message: "articleEditConflict",
          });
          await assert.rejects(submitArticleEdit(tx, member, { ...edit, markdown: " " }), {
            message: "articleBodyRequired",
          });
          assert.equal((await submitArticleEdit(tx, member, edit)).state, "PENDING_HUMAN");
          await assert.rejects(submitArticleEdit(tx, member, edit), {
            message: "articleEditConflict",
          });
          await assert.rejects(submitArticleEdit(tx, member, { ...edit, version: 2 }), {
            message: "articleEditConflict",
          });
          assert.equal(
            (await readPublishedArticle(tx, original.slug))?.markdown,
            toPublish.markdown,
          );
          assert.equal(
            (await readPendingArticle(tx, actor, edit.id))?.revisions[0].markdown,
            edit.markdown,
          );
          assert.ok((await listPendingArticles(tx, actor)).some((item) => item.id === edit.id));
          assert.ok(
            (await listMyArticles(tx, member, 1, "pending")).some((item) => item.id === edit.id),
          );

          await reviewArticle(tx, actor, edit.id, 2, "reject", "请补充细节");
          assert.equal(
            (await readPublishedArticle(tx, original.slug))?.markdown,
            toPublish.markdown,
          );
          assert.equal(await readPendingArticle(tx, actor, edit.id), null);
          await submitArticleEdit(tx, member, { ...edit, version: 2, markdown: "重新提交的正文" });
          await reviewArticle(tx, actor, edit.id, 3, "approve", "");
          assert.equal((await readPublishedArticle(tx, original.slug))?.markdown, "重新提交的正文");
          await submitArticleEdit(tx, member, { ...edit, version: 3 });
          await deletePublishedArticle(tx, member, edit.id, 4);
          await assert.rejects(reviewArticle(tx, actor, edit.id, 4, "approve", ""));
          assert.equal(await readPublishedArticle(tx, original.slug), null);
          assert.equal(await readPendingArticle(tx, actor, edit.id), null);

          const ownerPost = await submitArticle(tx, actor, fresh.id, fresh.version);
          const ownerEdit = await submitArticleEdit(tx, actor, { ...fresh, markdown: "站主修改" });
          assert.equal(ownerEdit.state, "PUBLISHED");
          assert.equal(ownerEdit.slug, ownerPost.slug);
          assert.equal((await readPublishedArticle(tx, ownerPost.slug))?.markdown, "站主修改");
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
