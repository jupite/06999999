import { resolveAccountActor, refreshActorFeatures } from "../access";
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { authorize, type Actor } from "../domain/permissions";
import { parseDraft } from "../domain/drafts";
import {
  ArticleError,
  articleReference,
  reviewInput,
  type ArticleFilter,
} from "../domain/articles";
import { saveDraft } from "./drafts";
import { articleMedia } from "./article-media";
import { articleTaxonomy, resolveArticleTaxonomy } from "./article-taxonomy";
import { lockUserAccount } from "./user-access";

type Db = Prisma.TransactionClient;
function requireActor(actor: Actor | null, manage = false): Actor {
  const access = authorize(actor, manage ? "site.manage" : "post.submit");
  if (!actor || !access.allowed) throw new ArticleError(access.reason);
  return actor;
}
function requireReader(actor: Actor | null): Actor {
  if (!actor || actor.banned) throw new ArticleError(actor ? "accountBanned" : "loginRequired");
  return actor;
}
// All writes must run inside a transaction. Claim the content row before changing a revision.
export async function submitArticle(
  db: Db,
  actor: Actor | null,
  rawId: unknown,
  rawVersion: unknown,
) {
  actor = await refreshActorFeatures(db, actor);
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
  if (claimed.count !== 1) throw new ArticleError("articleSubmitConflict");
  const revision = await db.contentRevision.findUniqueOrThrow({
    where: { contentId_version: { contentId: id, version } },
  });
  if (revision.state !== "DRAFT") throw new ArticleError("articleAlreadySubmitted");
  if (!revision.title.trim() || !revision.markdown.trim())
    throw new ArticleError("articleContentRequired");
  const state = author.role === "OWNER" ? "PUBLISHED" : "PENDING_HUMAN";
  const media = await articleMedia(db, author.id, revision.markdown);
  await db.contentRevision.update({
    where: { id: revision.id },
    data: { state, media: { set: media?.connect ?? [] } },
  });
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

export async function submitArticleEdit(db: Db, actor: Actor | null, value: unknown) {
  actor = await refreshActorFeatures(db, actor);
  const author = requireActor(actor);
  const access = authorize(author, "content.editOwn");
  if (!access.allowed) throw new ArticleError(access.reason);
  const input = parseDraft(value);
  const { id, version } = articleReference(input.id, input.version);
  if (!input.markdown.trim()) throw new ArticleError("articleBodyRequired");

  const state = author.role === "OWNER" ? "PUBLISHED" : "PENDING_HUMAN";
  const nextVersion = version + 1;
  const media = await articleMedia(db, author.id, input.markdown);
  const claimed = await db.content.updateMany({
    where: {
      id,
      authorId: author.id,
      kind: "POST",
      currentVersion: version,
      publishedVersion: { not: null },
      revisions: { some: { version, state: { in: ["PUBLISHED", "REJECTED"] } } },
    },
    data: {
      currentVersion: nextVersion,
      ...(state === "PUBLISHED" && { publishedVersion: nextVersion }),
    },
  });
  if (claimed.count !== 1) throw new ArticleError("articleEditConflict");
  const { relations } = await resolveArticleTaxonomy(db, input, { id, version });
  const revision = await db.contentRevision.create({
    data: {
      contentId: id,
      version: nextVersion,
      title: input.title,
      markdown: input.markdown,
      media,
      ...relations,
      state,
    },
    include: { content: { select: { slug: true } } },
  });
  if (state === "PUBLISHED") {
    await db.moderationReview.create({
      data: {
        revisionId: revision.id,
        targetVersion: nextVersion,
        result: state,
        reason: "站主直接发布修改",
        reviewerId: author.id,
      },
    });
  }
  await db.auditLog.create({
    data: {
      actorId: author.id,
      action: state === "PUBLISHED" ? "article.publishEdit" : "article.submitEdit",
      targetId: id,
      before: { version },
      after: { version: nextVersion, state },
    },
  });
  return { id, slug: revision.content.slug, state };
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
      revisions: { some: { version, state: "PENDING_HUMAN" } },
    },
    data: { updatedAt: new Date() },
  });
  if (claimed.count !== 1) throw new ArticleError("articleReviewConflict");
  const content = await db.content.findUniqueOrThrow({
    where: { id },
    select: { slug: true, authorId: true },
  });
  const pending = await db.contentRevision.findUniqueOrThrow({
    where: { contentId_version: { contentId: id, version } },
  });
  if (pending.state !== "PENDING_HUMAN") throw new ArticleError("articleAlreadyReviewed");
  if (input.decision === "approve") {
    await lockUserAccount(db, content.authorId);
    const author = await db.user.findUniqueOrThrow({
      where: { id: content.authorId },
      include: { permissions: true },
    });
    const access = authorize(await resolveAccountActor(db, author, undefined), "post.submit");
    if (!access.allowed)
      throw new ArticleError({ key: "authorCannotPublish", reason: access.reason });
  }
  const state = input.decision === "approve" ? "PUBLISHED" : "REJECTED";
  const revision = await db.contentRevision.update({
    where: { contentId_version: { contentId: id, version } },
    data: { state },
  });
  if (state === "PUBLISHED") {
    await db.content.update({ where: { id }, data: { publishedVersion: version } });
  }
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
  actor = await refreshActorFeatures(db, actor);
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
      revisions: { none: { state: "WITHDRAWN" } },
    },
    include: { revisions: { where: { version, state: "REJECTED" }, include: articleTaxonomy } },
  });
  const revision = source?.revisions[0];
  if (!revision) throw new ArticleError("rejectedArticleMissing");
  const draft = await saveDraft(db, author, {
    version: 0,
    title: revision.title,
    markdown: revision.markdown,
    categoryId: revision.categoryId,
    tagText: revision.tags.map((tag) => tag.name).join(", "),
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
  include: { ...articleTaxonomy, reviews: { orderBy: { createdAt: "desc" as const }, take: 1 } },
};
export async function listMyArticles(
  db: Db,
  actor: Actor | null,
  page = 1,
  filter: ArticleFilter = "all",
) {
  const author = requireReader(actor);
  return db.content.findMany({
    where: {
      authorId: author.id,
      kind: "POST",
      revisions: { none: { state: "WITHDRAWN" } },
      AND:
        filter === "draft"
          ? {
              publishedVersion: null,
              revisions: { some: { state: "DRAFT" }, every: { state: "DRAFT" } },
            }
          : filter === "published"
            ? { publishedVersion: { not: null } }
            : filter === "pending"
              ? {
                  revisions: { some: { state: { in: ["PENDING_AI", "PENDING_HUMAN"] } } },
                }
              : filter === "rejected"
                ? { publishedVersion: null, revisions: { some: { state: "REJECTED" } } }
                : {},
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 20,
    take: 21,
    include: { revisions: latestRevision },
  });
}
export async function readMyArticle(db: Db, actor: Actor | null, id: string) {
  const author = requireReader(actor);
  return db.content.findFirst({
    where: { id, authorId: author.id, kind: "POST", revisions: { none: { state: "WITHDRAWN" } } },
    include: { revisions: latestRevision },
  });
}
export async function listPendingArticles(db: Db, actor: Actor | null, page = 1) {
  requireActor(actor, true);
  return db.content.findMany({
    where: {
      kind: "POST",
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
    where: { id, kind: "POST" },
    include: { author: { select: { name: true, banned: true } }, revisions: latestRevision },
  });
  return content?.revisions[0]?.state === "PENDING_HUMAN" ? content : null;
}

export { listPublishedArticles, readPublishedArticle } from "./public-articles";

// Keep revisions/review history, but remove the publication and hide the article from the workspace.
export async function deletePublishedArticle(
  db: Db,
  actor: Actor | null,
  rawId: unknown,
  rawVersion: unknown,
) {
  actor = await refreshActorFeatures(db, actor);
  const author = requireReader(actor);
  const access = authorize(author, "content.editOwn");
  if (!access.allowed) throw new ArticleError(access.reason);
  const { id, version } = articleReference(rawId, rawVersion);
  const content = await db.content.findFirst({
    where: { id, authorId: author.id, kind: "POST", currentVersion: version },
    select: { publishedVersion: true, slug: true },
  });
  const conflict = "articleDeleteConflict";
  if (!content || content.publishedVersion === null) throw new ArticleError(conflict);
  const { publishedVersion } = content;
  const claimed = await db.content.updateMany({
    where: {
      id,
      authorId: author.id,
      kind: "POST",
      currentVersion: version,
      publishedVersion,
      revisions: { some: { version: publishedVersion, state: "PUBLISHED" } },
    },
    data: { publishedVersion: null, updatedAt: new Date() },
  });
  if (claimed.count !== 1) throw new ArticleError(conflict);
  const revision = await db.contentRevision.update({
    where: { contentId_version: { contentId: id, version: publishedVersion } },
    data: { state: "WITHDRAWN" },
  });
  await db.contentRevision.updateMany({
    where: { contentId: id, version, state: { in: ["PENDING_AI", "PENDING_HUMAN"] } },
    data: { state: "WITHDRAWN" },
  });
  await db.moderationReview.create({
    data: {
      revisionId: revision.id,
      targetVersion: publishedVersion,
      result: "WITHDRAWN",
      reason: "作者删除已发布文章",
      reviewerId: author.id,
    },
  });
  await db.auditLog.create({
    data: {
      actorId: author.id,
      action: "article.delete",
      targetId: id,
      before: { version: publishedVersion, state: "PUBLISHED" },
      after: { version: publishedVersion, state: "WITHDRAWN" },
    },
  });
  return { slug: content.slug };
}
