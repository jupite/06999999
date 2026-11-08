import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { authorize, type Actor } from "../domain/permissions";
import { ArticleError, articleReference, reviewInput } from "../domain/articles";
import { saveDraft } from "./drafts";

type Db = Prisma.TransactionClient;
function requireActor(actor: Actor | null, manage = false): Actor {
  const access = authorize(actor, manage ? "site.manage" : "post.submit");
  if (!actor || !access.allowed) throw new ArticleError(access.reason);
  return actor;
}
function requireReader(actor: Actor | null): Actor {
  if (!actor || actor.banned) throw new ArticleError(actor ? "账号已封禁" : "请先登录");
  return actor;
}
// All writes must run inside a transaction. Claim the content row before changing a revision.
export async function submitArticle(
  db: Db,
  actor: Actor | null,
  rawId: unknown,
  rawVersion: unknown,
) {
  const author = requireActor(actor);
  const { id, version } = articleReference(rawId, rawVersion);
  const claimed = await db.content.updateMany({
    where: {
      id,
      authorId: author.id,
      kind: "POST",
      currentVersion: version,
      publishedVersion: null,
      revisions: { some: { version, state: "DRAFT" } },
    },
    data: { updatedAt: new Date() },
  });
  if (claimed.count !== 1) throw new ArticleError("文章已更新、已提交或不可操作，请刷新后重试。");
  const revision = await db.contentRevision.findUniqueOrThrow({
    where: { contentId_version: { contentId: id, version } },
  });
  if (revision.state !== "DRAFT") throw new ArticleError("文章已经提交，请刷新状态。");
  if (!revision.title.trim() || !revision.markdown.trim())
    throw new ArticleError("请先保存非空的标题和正文，再提交。");
  const state = author.role === "OWNER" ? "PUBLISHED" : "PENDING_HUMAN";
  await db.contentRevision.update({ where: { id: revision.id }, data: { state } });
  const content = await db.content.update({
    where: { id },
    data: { publishedVersion: state === "PUBLISHED" ? version : null },
  });
  if (state === "PUBLISHED")
    await db.moderationReview.create({
      data: {
        revisionId: revision.id,
        targetVersion: version,
        result: state,
        reason: "站主直接发布",
        reviewerId: author.id,
      },
    });
  await db.auditLog.create({
    data: {
      actorId: author.id,
      action: state === "PUBLISHED" ? "article.publish" : "article.submit",
      targetId: id,
      before: { version, state: "DRAFT" },
      after: { version, state },
    },
  });
  return { id, slug: content.slug, state };
}
export async function reviewArticle(
  db: Db,
  actor: Actor | null,
  rawId: unknown,
  rawVersion: unknown,
  decision: unknown,
  reason: unknown,
) {
  const reviewer = requireActor(actor, true);
  const { id, version } = articleReference(rawId, rawVersion);
  const input = reviewInput(decision, reason);
  const claimed = await db.content.updateMany({
    where: {
      id,
      kind: "POST",
      currentVersion: version,
      publishedVersion: null,
      revisions: { some: { version, state: "PENDING_HUMAN" } },
    },
    data: { updatedAt: new Date() },
  });
  if (claimed.count !== 1) throw new ArticleError("该版本已审核或已发生变化，请刷新审核列表。");
  const content = await db.content.findUniqueOrThrow({
    where: { id },
    include: { author: { include: { permissions: true } } },
  });
  const pending = await db.contentRevision.findUniqueOrThrow({
    where: { contentId_version: { contentId: id, version } },
  });
  if (pending.state !== "PENDING_HUMAN") throw new ArticleError("该版本已经审核，请刷新列表。");
  if (input.decision === "approve") {
    const author = content.author;
    const access = authorize(
      {
        id: author.id,
        role: "MEMBER",
        banned: author.banned,
        overrides: Object.fromEntries(author.permissions.map((p) => [p.capability, p.effect])),
      },
      "post.submit",
    );
    if (!access.allowed)
      throw new ArticleError(`作者当前不能发布：${access.reason}。可填写原因拒绝该投稿。`);
  }
  const state = input.decision === "approve" ? "PUBLISHED" : "REJECTED";
  const revision = await db.contentRevision.update({
    where: { contentId_version: { contentId: id, version } },
    data: { state },
  });
  await db.content.update({
    where: { id },
    data: { publishedVersion: state === "PUBLISHED" ? version : null },
  });
  await db.moderationReview.create({
    data: {
      revisionId: revision.id,
      targetVersion: version,
      result: state,
      reason: input.reason || "人工审核通过",
      reviewerId: reviewer.id,
    },
  });
  await db.auditLog.create({
    data: {
      actorId: reviewer.id,
      action: "article.review",
      targetId: id,
      before: { version, state: "PENDING_HUMAN" },
      after: { version, state },
    },
  });
  return { id, slug: content.slug, state };
}
export async function copyRejectedArticle(
  db: Db,
  actor: Actor | null,
  rawId: unknown,
  rawVersion: unknown,
) {
  const author = requireActor(actor);
  const edit = authorize(author, "content.editOwn");
  if (!edit.allowed) throw new ArticleError(edit.reason);
  const { id, version } = articleReference(rawId, rawVersion);
  const source = await db.content.findFirst({
    where: {
      id,
      authorId: author.id,
      kind: "POST",
      currentVersion: version,
      publishedVersion: null,
    },
    include: { revisions: { where: { version, state: "REJECTED" } } },
  });
  const revision = source?.revisions[0];
  if (!revision) throw new ArticleError("找不到可复制的本人已拒绝投稿。");
  const draft = await saveDraft(db, author, {
    version: 0,
    title: revision.title,
    markdown: revision.markdown,
  });
  await db.auditLog.create({
    data: {
      actorId: author.id,
      action: "article.copyRejected",
      targetId: draft.id,
      after: { sourceId: id, sourceVersion: version },
    },
  });
  return draft;
}

const latestRevision = {
  orderBy: { version: "desc" as const },
  take: 1,
  include: { reviews: { orderBy: { createdAt: "desc" as const }, take: 1 } },
};
export async function listMyArticles(db: Db, actor: Actor | null, page = 1) {
  const author = requireReader(actor);
  return db.content.findMany({
    where: { authorId: author.id, kind: "POST" },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 20,
    take: 21,
    include: { revisions: latestRevision },
  });
}
export async function readMyArticle(db: Db, actor: Actor | null, id: string) {
  const author = requireReader(actor);
  return db.content.findFirst({
    where: { id, authorId: author.id, kind: "POST" },
    include: { revisions: latestRevision },
  });
}
export async function listPendingArticles(db: Db, actor: Actor | null, page = 1) {
  requireActor(actor, true);
  return db.content.findMany({
    where: {
      kind: "POST",
      publishedVersion: null,
      revisions: { some: { state: "PENDING_HUMAN" } },
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    skip: (page - 1) * 20,
    take: 21,
    include: { author: { select: { name: true, banned: true } }, revisions: latestRevision },
  });
}
export async function readPendingArticle(db: Db, actor: Actor | null, id: string) {
  requireActor(actor, true);
  const content = await db.content.findFirst({
    where: { id, kind: "POST", publishedVersion: null },
    include: { author: { select: { name: true, banned: true } }, revisions: latestRevision },
  });
  return content?.revisions[0]?.state === "PENDING_HUMAN" ? content : null;
}

// Only read approved revisions and then select the exact published-version pointer.
const publicSelect = {
  id: true,
  slug: true,
  publishedVersion: true,
  updatedAt: true,
  author: { select: { name: true } },
  revisions: {
    where: { state: "PUBLISHED" as const },
    select: {
      version: true,
      title: true,
      markdown: true,
      reviews: {
        where: { result: "PUBLISHED" as const },
        orderBy: { createdAt: "desc" as const },
        take: 1,
        select: { createdAt: true },
      },
    },
  },
} satisfies Prisma.ContentSelect;
type PublicContent = Prisma.ContentGetPayload<{ select: typeof publicSelect }>;
function published(content: PublicContent) {
  const revision = content.revisions.find((r) => r.version === content.publishedVersion);
  if (!revision) return null;
  return {
    slug: content.slug,
    title: revision.title,
    markdown: revision.markdown,
    authorName: content.author.name,
    publishedAt: revision.reviews[0]?.createdAt ?? content.updatedAt,
  };
}
export async function listPublishedArticles(db: Db, page = 1) {
  const contents = await db.content.findMany({
    where: {
      kind: "POST",
      publishedVersion: { not: null },
      revisions: { some: { state: "PUBLISHED" } },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 20,
    take: 21,
    select: publicSelect,
  });
  return contents.map(published).filter((item): item is NonNullable<typeof item> => item !== null);
}
export async function readPublishedArticle(db: Db, slug: string) {
  const content = await db.content.findFirst({
    where: { slug, kind: "POST", publishedVersion: { not: null } },
    select: publicSelect,
  });
  return content ? published(content) : null;
}
