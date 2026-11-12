import { readRejectedSubmission, ResubmissionError } from "./resubmission";
import { resolveAccountActor } from "../access";
import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { SystemKey } from "@/i18n/messages";
import { imageIdFromUrl } from "@/media/urls";
import { authorize, type Actor } from "../domain/permissions";
import { parseDraft } from "../domain/drafts";
import { reviewInput } from "../domain/articles";
import { resolveArticleTaxonomy, articleTaxonomy } from "./article-taxonomy";
import { lockUserAccount } from "./user-access";
type Db = Prisma.TransactionClient;
export class PhotoError extends Error {
  constructor(readonly key: SystemKey) {
    super(key);
  }
}
function requireActor(actor: Actor | null, manage = false) {
  const access = authorize(actor, manage ? "site.manage" : "photo.submit");
  if (!actor || !access.allowed) throw new PhotoError(access.reason);
  return actor;
}
async function currentAuthor(db: Db, id: string) {
  await lockUserAccount(db, id);
  const user = await db.user.findUniqueOrThrow({ where: { id }, include: { permissions: true } });
  const actor = await resolveAccountActor(db, user, process.env.OWNER_GITHUB_ID);
  requireActor(actor);
  const upload = authorize(actor, "image.upload");
  if (!upload.allowed) throw new PhotoError(upload.reason);
  return actor;
}
export async function submitPhoto(db: Db, actor: Actor | null, form: FormData) {
  const author = requireActor(actor);
  const slug = form.get("submissionId"),
    url = form.get("imageUrl"),
    summary = form.get("summary");
  if (
    typeof slug !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug) ||
    typeof summary !== "string" ||
    summary.trim().length > 2000
  )
    throw new PhotoError("invalidPhoto");
  const input = parseDraft({
    title: form.get("title"),
    markdown: "",
    version: 0,
    categoryId: form.get("categoryId") || null,
    tagText: form.get("tagText") ?? "",
  });
  const mediaId = imageIdFromUrl(url);
  if (!mediaId) throw new PhotoError("photoImageRequired");
  const current = await currentAuthor(db, author.id);
  const sourceId = form.get("sourceId");
  if (sourceId !== null && !(await readRejectedSubmission(db, current, sourceId, "PHOTO")))
    throw new ResubmissionError("submissionCopyUnavailable");
  const previous = await db.content.findUnique({
    where: { slug },
    include: { revisions: { include: { media: true, tags: true } } },
  });
  if (previous) {
    const revision = previous.revisions[0];
    if (
      previous.kind !== "PHOTO" ||
      previous.authorId !== author.id ||
      revision?.title !== input.title ||
      revision.summary !== summary.trim() ||
      revision.media[0]?.id !== mediaId ||
      revision.categoryId !== (input.categoryId ?? null) ||
      revision.tags
        .map((tag) => tag.name)
        .sort()
        .join(", ") !== (input.tagText ?? "").split(", ").filter(Boolean).sort().join(", ")
    )
      throw new PhotoError("photoSubmissionConflict");
    return previous;
  }
  const media = await db.media.findFirst({
    where: { id: mediaId, ownerId: author.id, ready: true, mimeType: "image/webp" },
  });
  if (!media) throw new PhotoError("photoImageUnavailable");
  const taxonomy = await resolveArticleTaxonomy(db, input);
  const state = current.role === "OWNER" ? "PUBLISHED" : "PENDING_HUMAN";
  const content = await db.content.create({
    data: {
      authorId: author.id,
      kind: "PHOTO",
      slug,
      publishedVersion: state === "PUBLISHED" ? 1 : null,
      revisions: {
        create: {
          version: 1,
          title: input.title,
          summary: summary.trim(),
          state,
          ...taxonomy.relations,
          media: { connect: { id: mediaId } },
        },
      },
    },
  });
  await db.auditLog.create({
    data: {
      actorId: author.id,
      action: "photo.submit",
      targetId: content.id,
      after: { state, version: 1, mediaId, ...(typeof sourceId === "string" ? { sourceId } : {}) },
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
      ...articleTaxonomy,
      media: { where: { ready: true }, select: { id: true } },
      reviews: { orderBy: { createdAt: "desc" as const }, take: 1 },
    },
  },
};
export function listMyPhotos(db: Db, actor: Actor | null, page = 1) {
  if (!actor || actor.banned) throw new PhotoError(actor ? "accountBanned" : "loginRequired");
  return db.content.findMany({
    where: { authorId: actor.id, kind: "PHOTO" },
    include: detail,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 20,
    take: 21,
  });
}
export function listPendingPhotos(db: Db, actor: Actor | null, page = 1) {
  requireActor(actor, true);
  return db.content.findMany({
    where: { kind: "PHOTO", revisions: { some: { state: "PENDING_HUMAN" } } },
    include: detail,
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    skip: (page - 1) * 20,
    take: 21,
  });
}
export async function reviewPhoto(
  db: Db,
  actor: Actor | null,
  id: string,
  version: number,
  form: FormData,
) {
  const manager = requireActor(actor, true),
    input = reviewInput(form.get("decision"), form.get("reason"));
  const photo = await db.content.findFirst({
    where: { id, kind: "PHOTO", currentVersion: version },
    include: detail,
  });
  const revision = photo?.revisions[0];
  if (!photo || !revision || revision.version !== version || revision.state !== "PENDING_HUMAN")
    throw new PhotoError("photoReviewConflict");
  if (input.decision === "approve") {
    await currentAuthor(db, photo.authorId);
    if (
      revision.media.length !== 1 ||
      !(await db.media.findFirst({
        where: {
          id: revision.media[0].id,
          ownerId: photo.authorId,
          ready: true,
          mimeType: "image/webp",
        },
      }))
    )
      throw new PhotoError("photoImageUnavailable");
  }
  const state = input.decision === "approve" ? "PUBLISHED" : "REJECTED";
  const claimed = await db.contentRevision.updateMany({
    where: { id: revision.id, version, state: "PENDING_HUMAN" },
    data: { state },
  });
  if (claimed.count !== 1) throw new PhotoError("photoReviewConflict");
  const changed = await db.content.updateMany({
    where: { id, kind: "PHOTO", currentVersion: version, publishedVersion: null },
    data: { updatedAt: new Date(), publishedVersion: state === "PUBLISHED" ? version : null },
  });
  if (changed.count !== 1) throw new PhotoError("photoReviewConflict");
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
      action: "photo.review",
      targetId: id,
      before: { state: "PENDING_HUMAN", version },
      after: { state, version },
    },
  });
}
const publication = Prisma.sql`FROM "Content" c JOIN "ContentRevision" r ON r."contentId"=c.id AND r.version=c."publishedVersion" AND r.state='PUBLISHED' WHERE c.kind='PHOTO' AND EXISTS(SELECT 1 FROM "_ContentRevisionToMedia" rm JOIN "Media" m ON m.id=rm."B" WHERE rm."A"=r.id AND m.ready)`;
export async function listPublicPhotos(
  db: Db,
  page = 1,
  filters: { categoryId?: string; tagId?: string } = {},
) {
  const ids = await db.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT c.id ${publication}
    ${filters.categoryId ? Prisma.sql`AND r."categoryId"=${filters.categoryId}` : Prisma.empty}
    ${filters.tagId ? Prisma.sql`AND EXISTS(SELECT 1 FROM "_ContentRevisionToTag" rt WHERE rt."A"=r.id AND rt."B"=${filters.tagId})` : Prisma.empty}
    ORDER BY c."updatedAt" DESC,c.id DESC LIMIT 21 OFFSET ${(page - 1) * 20}`);
  const contents = await db.content.findMany({
    where: { id: { in: ids.map((row) => row.id) } },
    include: {
      author: { select: { name: true } },
      revisions: {
        where: { state: "PUBLISHED" },
        include: {
          ...articleTaxonomy,
          media: { where: { ready: true }, select: { id: true }, orderBy: { id: "asc" } },
        },
      },
    },
  });
  const byId = new Map(contents.map((content) => [content.id, content]));
  return ids.flatMap(({ id }) => {
    const content = byId.get(id);
    const revision = content?.revisions.find((row) => row.version === content.publishedVersion);
    return content && revision && revision.media[0]
      ? [
          {
            id,
            title: revision.title,
            summary: revision.summary,
            authorName: content.author.name,
            mediaId: revision.media[0].id,
            category: revision.category,
            tags: revision.tags,
          },
        ]
      : [];
  });
}
export async function listPhotoTerms(db: Db) {
  const terms = await db.$queryRaw<{ kind: string; id: string; name: string }[]>(Prisma.sql`
    WITH published AS (SELECT r.id,r."categoryId" ${publication})
    SELECT DISTINCT 'category' AS kind,cat.id,cat.name FROM published p JOIN "Category" cat ON cat.id=p."categoryId"
    UNION ALL SELECT DISTINCT 'tag' AS kind,tag.id,tag.name FROM published p JOIN "_ContentRevisionToTag" rt ON rt."A"=p.id JOIN "Tag" tag ON tag.id=rt."B" ORDER BY name,id`);
  return {
    categories: terms.filter((term) => term.kind === "category"),
    tags: terms.filter((term) => term.kind === "tag"),
  };
}
