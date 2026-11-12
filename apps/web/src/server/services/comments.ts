import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { Actor } from "../domain/permissions";
import { accountActor, authorize } from "../domain/permissions";
import { ArticleError, reviewInput } from "../domain/articles";
import type { SystemKey } from "@/i18n/messages";
import { lockUserAccount } from "./user-access";
type Db = Prisma.TransactionClient;
export class CommentError extends Error {
  constructor(
    readonly key: SystemKey,
    readonly status = 400,
  ) {
    super(key);
  }
}
async function publishedArticle(db: Db, slug: string, lock = false) {
  const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT c.id FROM "Content" c JOIN "ContentRevision" r ON r."contentId"=c.id
      AND r.version=c."publishedVersion" AND r.state='PUBLISHED'
    WHERE c.slug=${slug} AND c.kind='POST' ${lock ? Prisma.sql`FOR SHARE OF c` : Prisma.empty}
  `);
  if (!rows[0]) throw new CommentError("likeArticleMissing", 404);
  return rows[0].id;
}
export async function listArticleComments(db: Db, slug: string, page = 1) {
  const contentId = await publishedArticle(db, slug);
  return db.comment.findMany({
    where: { contentId, state: "PUBLISHED" },
    select: { id: true, body: true, createdAt: true, author: { select: { name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 20,
    take: 21,
  });
}
export async function submitArticleComment(
  db: Db,
  actor: Actor | null,
  slug: string,
  input: unknown,
) {
  if (!actor) throw new CommentError("loginRequired", 401);
  if (!input || typeof input !== "object") throw new CommentError("invalidComment");
  const { id, body } = input as { id?: unknown; body?: unknown };
  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ||
    typeof body !== "string" ||
    !body.trim() ||
    body.trim().length > 2000
  )
    throw new CommentError("invalidComment");
  await lockUserAccount(db, actor.id);
  const user = await db.user.findUnique({
    where: { id: actor.id },
    include: { permissions: true },
  });
  if (!user) throw new CommentError("loginRequired", 401);
  const current = accountActor(user, process.env.OWNER_GITHUB_ID);
  const access = authorize(current, "comment.submit");
  if (!access.allowed) throw new CommentError(access.reason, 403);
  const contentId = await publishedArticle(db, slug, true);
  const previous = await db.comment.findUnique({ where: { id } });
  if (previous) {
    if (
      previous.authorId !== actor.id ||
      previous.contentId !== contentId ||
      previous.body !== body.trim()
    )
      throw new CommentError("commentConflict", 409);
    return { id: previous.id, state: previous.state };
  }
  if (
    (await db.comment.count({
      where: { authorId: actor.id, createdAt: { gte: new Date(Date.now() - 60000) } },
    })) >= 5
  )
    throw new CommentError("commentRateLimited", 429);
  const state = current.role === "OWNER" ? "PUBLISHED" : "PENDING_HUMAN";
  const comment = await db.comment.create({
    data: { id, contentId, authorId: actor.id, body: body.trim(), state },
  });
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: "comment.submit",
      targetId: id,
      after: { contentId, state },
    },
  });
  return { id: comment.id, state: comment.state };
}
export function listPendingComments(db: Db, actor: Actor | null, page = 1) {
  const access = authorize(actor, "site.manage");
  if (!access.allowed) throw new CommentError(access.reason, actor ? 403 : 401);
  return db.comment.findMany({
    where: { state: "PENDING_HUMAN", content: { kind: "POST" } },
    include: {
      author: { select: { name: true } },
      content: {
        select: {
          slug: true,
          revisions: { orderBy: { version: "desc" }, take: 1, select: { title: true } },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    skip: (page - 1) * 20,
    take: 21,
  });
}
export async function reviewArticleComment(
  db: Db,
  actor: Actor | null,
  id: string,
  version: number,
  decision: unknown,
  reason: unknown,
) {
  const access = authorize(actor, "site.manage");
  if (!actor || !access.allowed) throw new CommentError(access.reason, actor ? 403 : 401);
  let input;
  try {
    input = reviewInput(decision, reason);
  } catch (error) {
    if (error instanceof ArticleError && typeof error.notice === "string")
      throw new CommentError(error.notice);
    throw error;
  }
  const comment = await db.comment.findFirst({
    where: { id, version, state: "PENDING_HUMAN", content: { kind: "POST" } },
    include: { content: { select: { slug: true } } },
  });
  if (!comment) throw new CommentError("commentReviewConflict", 409);
  await lockUserAccount(db, comment.authorId);
  if (input.decision === "approve") {
    const author = await db.user.findUniqueOrThrow({
      where: { id: comment.authorId },
      include: { permissions: true },
    });
    const authorAccess = authorize(
      accountActor(author, process.env.OWNER_GITHUB_ID),
      "comment.submit",
    );
    if (!authorAccess.allowed) throw new CommentError(authorAccess.reason, 403);
    await publishedArticle(db, comment.content.slug, true);
  }
  const state = input.decision === "approve" ? "PUBLISHED" : "REJECTED";
  const changed = await db.comment.updateMany({
    where: { id, version, state: "PENDING_HUMAN" },
    data: { state, version: { increment: 1 } },
  });
  if (changed.count !== 1) throw new CommentError("commentReviewConflict", 409);
  await db.moderationReview.create({
    data: {
      commentId: id,
      targetVersion: version,
      result: state,
      reason: input.reason || "人工审核通过",
      reviewerId: actor.id,
    },
  });
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: "comment.review",
      targetId: id,
      before: { state: "PENDING_HUMAN", version },
      after: { state, version: version + 1 },
    },
  });
  return { slug: comment.content.slug, state };
}
