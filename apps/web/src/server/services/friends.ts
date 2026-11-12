import { readRejectedSubmission, ResubmissionError } from "./resubmission";
import { resolveAccountActor } from "../access";
import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { SystemKey } from "@/i18n/messages";
import { imageIdFromUrl } from "@/media/urls";
import { authorize, type Actor } from "../domain/permissions";
import { parseProjectUrl } from "../domain/project-sites";
import { reviewInput } from "../domain/articles";
import { lockUserAccount } from "./user-access";
type Db = Prisma.TransactionClient;
export class FriendError extends Error {
  constructor(readonly key: SystemKey) {
    super(key);
  }
}
function requireActor(actor: Actor | null, manage = false) {
  const access = authorize(actor, manage ? "site.manage" : "friend.submit");
  if (!actor || !access.allowed) throw new FriendError(access.reason);
  return actor;
}
async function authorActor(db: Db, id: string) {
  await lockUserAccount(db, id);
  const user = await db.user.findUniqueOrThrow({ where: { id }, include: { permissions: true } });
  return requireActor(await resolveAccountActor(db, user, process.env.OWNER_GITHUB_ID));
}
async function requireIcon(db: Db, actor: Actor, mediaId: string) {
  const access = authorize(actor, "image.upload");
  if (!access.allowed) throw new FriendError(access.reason);
  if (
    !(await db.media.findFirst({
      where: { id: mediaId, ownerId: actor.id, ready: true, mimeType: "image/webp" },
    }))
  )
    throw new FriendError("friendIconUnavailable");
}
export async function submitFriend(db: Db, actor: Actor | null, form: FormData) {
  const author = requireActor(actor);
  const slug = form.get("submissionId"),
    title = form.get("title"),
    summary = form.get("summary"),
    icon = form.get("iconUrl") ?? "";
  const url = parseProjectUrl(form.get("url"));
  if (
    typeof slug !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug) ||
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > 160 ||
    typeof summary !== "string" ||
    summary.trim().length > 2000 ||
    !url ||
    typeof icon !== "string"
  )
    throw new FriendError("invalidFriend");
  const mediaId = icon ? imageIdFromUrl(icon) : undefined;
  if (icon && !mediaId) throw new FriendError("friendIconUnavailable");
  const current = await authorActor(db, author.id);
  const sourceId = form.get("sourceId");
  if (sourceId !== null && !(await readRejectedSubmission(db, current, sourceId, "FRIEND_LINK")))
    throw new ResubmissionError("submissionCopyUnavailable");
  if (mediaId) await requireIcon(db, current, mediaId);
  const previous = await db.content.findUnique({
    where: { slug },
    include: { revisions: { include: { media: { select: { id: true } } } } },
  });
  if (previous) {
    const revision = previous.revisions[0];
    if (
      previous.kind !== "FRIEND_LINK" ||
      previous.authorId !== author.id ||
      revision?.title !== title.trim() ||
      revision.summary !== summary.trim() ||
      revision.targetUrl !== url.href ||
      revision.media[0]?.id !== mediaId
    )
      throw new FriendError("friendSubmissionConflict");
    return previous;
  }
  const state = current.role === "OWNER" ? "PUBLISHED" : "PENDING_HUMAN";
  const content = await db.content.create({
    data: {
      authorId: author.id,
      kind: "FRIEND_LINK",
      slug,
      publishedVersion: state === "PUBLISHED" ? 1 : null,
      revisions: {
        create: {
          version: 1,
          title: title.trim(),
          summary: summary.trim(),
          targetUrl: url.href,
          state,
          ...(mediaId ? { media: { connect: { id: mediaId } } } : {}),
        },
      },
    },
  });
  await db.auditLog.create({
    data: {
      actorId: author.id,
      action: "friend.submit",
      targetId: content.id,
      after: {
        state,
        version: 1,
        url: url.href,
        ...(typeof sourceId === "string" ? { sourceId } : {}),
      },
    },
  });
  return content;
}
const detail = {
  author: { select: { name: true } },
  revisions: {
    orderBy: { version: "desc" as const },
    take: 1,
    include: {
      media: { where: { ready: true }, select: { id: true } },
      reviews: { orderBy: { createdAt: "desc" as const }, take: 1 },
    },
  },
};
export function listMyFriends(db: Db, actor: Actor | null, page = 1) {
  if (!actor || actor.banned) throw new FriendError(actor ? "accountBanned" : "loginRequired");
  return db.content.findMany({
    where: { authorId: actor.id, kind: "FRIEND_LINK" },
    include: detail,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 20,
    take: 21,
  });
}
export function listPendingFriends(db: Db, actor: Actor | null, page = 1) {
  requireActor(actor, true);
  return db.content.findMany({
    where: { kind: "FRIEND_LINK", revisions: { some: { state: "PENDING_HUMAN" } } },
    include: detail,
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    skip: (page - 1) * 20,
    take: 21,
  });
}
export async function reviewFriend(
  db: Db,
  actor: Actor | null,
  id: string,
  version: number,
  form: FormData,
) {
  const manager = requireActor(actor, true),
    input = reviewInput(form.get("decision"), form.get("reason"));
  const content = await db.content.findFirst({
    where: { id, kind: "FRIEND_LINK", currentVersion: version },
    include: detail,
  });
  const revision = content?.revisions[0];
  if (!content || !revision || revision.version !== version || revision.state !== "PENDING_HUMAN")
    throw new FriendError("friendReviewConflict");
  if (input.decision === "approve") {
    const author = await authorActor(db, content.authorId);
    if (!parseProjectUrl(revision.targetUrl)) throw new FriendError("invalidFriend");
    // Query every association so a missing/not-ready icon cannot silently become an icon-free submission.
    const media = await db.contentRevision.findUniqueOrThrow({
      where: { id: revision.id },
      select: { media: { select: { id: true } } },
    });
    if (media.media.length > 1) throw new FriendError("friendIconUnavailable");
    if (media.media[0]) await requireIcon(db, author, media.media[0].id);
  }
  const state = input.decision === "approve" ? "PUBLISHED" : "REJECTED";
  const changed = await db.contentRevision.updateMany({
    where: { id: revision.id, version, state: "PENDING_HUMAN" },
    data: { state },
  });
  if (changed.count !== 1) throw new FriendError("friendReviewConflict");
  const claimed = await db.content.updateMany({
    where: { id, kind: "FRIEND_LINK", currentVersion: version, publishedVersion: null },
    data: { publishedVersion: state === "PUBLISHED" ? version : null, updatedAt: new Date() },
  });
  if (claimed.count !== 1) throw new FriendError("friendReviewConflict");
  await db.moderationReview.create({
    data: {
      revisionId: revision.id,
      targetVersion: version,
      result: state,
      reason: input.reason || "人工审核通过",
      reviewerId: manager.id,
    },
  });
  await db.auditLog.create({
    data: {
      actorId: manager.id,
      action: "friend.review",
      targetId: id,
      before: { state: "PENDING_HUMAN", version },
      after: { state, version },
    },
  });
}
type PublicFriend = {
  id: string;
  title: string;
  summary: string;
  targetUrl: string;
  authorName: string;
  iconId: string | null;
};
export function listPublicFriends(db: Db, page = 1) {
  return db.$queryRaw<PublicFriend[]>`
    SELECT c.id,r.title,r.summary,r."targetUrl",u.name AS "authorName",
    (SELECT m.id FROM "_ContentRevisionToMedia" rm JOIN "Media" m ON m.id=rm."B" WHERE rm."A"=r.id AND m.ready ORDER BY m.id LIMIT 1) AS "iconId"
    FROM "Content" c JOIN "ContentRevision" r ON r."contentId"=c.id AND r.version=c."publishedVersion" AND r.state='PUBLISHED'
    JOIN "User" u ON u.id=c."authorId" WHERE c.kind='FRIEND_LINK' AND r."targetUrl" IS NOT NULL
    ORDER BY c."updatedAt" DESC,c.id DESC LIMIT 21 OFFSET ${(page - 1) * 20}`;
}
