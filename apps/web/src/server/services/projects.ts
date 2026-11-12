import { resolveAccountActor } from "../access";
import "server-only";
import type { SystemNotice } from "@/i18n/system-messages";
import { Prisma } from "@/generated/prisma/client";
import { imageIdFromUrl } from "@/media/urls";
import { reviewInput } from "../domain/articles";
import { authorize, type Actor } from "../domain/permissions";
import { parseProjectUrl } from "../domain/project-sites";
import { checkProjectWebsite } from "./project-sites";
import { lockUserAccount } from "./user-access";

type Db = Prisma.TransactionClient;
const submissionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class ProjectError extends Error {
  readonly notice: SystemNotice;

  constructor(notice: SystemNotice) {
    super(typeof notice === "string" ? notice : notice.key);
    this.notice = notice;
  }
}

function requireProjectActor(actor: Actor | null, capability: "project.submit" | "site.manage") {
  const access = authorize(actor, capability);
  if (!actor || !access.allowed) throw new ProjectError(access.reason);
  return actor;
}

async function lockedAuthor(tx: Db, id: string, owner = false) {
  await lockUserAccount(tx, id);
  const user = await tx.user.findUnique({ where: { id }, include: { permissions: true } });
  return user
    ? await resolveAccountActor(tx, user, owner ? user.githubId : process.env.OWNER_GITHUB_ID)
    : null;
}

async function requireAllowedWebsite(tx: Db, url: string | null) {
  // A rule edit must commit before this check or wait until this publication commits.
  await tx.$executeRaw`LOCK TABLE "ProjectSiteRule" IN SHARE MODE`;
  const result = await checkProjectWebsite(tx, url);
  if (result === "invalid") throw new ProjectError("invalidProjectUrl");
  if (result === "denied") throw new ProjectError("projectWebsiteDenied");
  if (result === "unmatched") throw new ProjectError("projectWebsiteUnmatched");
}

export async function submitProject(tx: Db, actor: Actor | null, form: FormData) {
  const requested = requireProjectActor(actor, "project.submit");
  const title = form.get("title");
  const summary = form.get("summary");
  const targetUrl = parseProjectUrl(form.get("url"));
  const cover = form.get("cover");
  const slug = form.get("submissionId");
  if (typeof title !== "string" || !title.trim() || title.trim().length > 100)
    throw new ProjectError("invalidProjectTitle");
  if (typeof summary !== "string" || !summary.trim() || summary.trim().length > 500)
    throw new ProjectError("invalidProjectSummary");
  if (!targetUrl) throw new ProjectError("invalidProjectUrl");
  if (typeof slug !== "string" || !submissionIdPattern.test(slug))
    throw new ProjectError("invalidProjectSubmission");
  const coverId = cover ? imageIdFromUrl(cover) : undefined;
  if (cover && !coverId) throw new ProjectError("invalidProjectCover");

  const author = requireProjectActor(
    await lockedAuthor(tx, requested.id, requested.role === "OWNER"),
    "project.submit",
  );
  const existing = await tx.content.findUnique({
    where: { slug },
    select: { id: true, kind: true, authorId: true },
  });
  if (existing) {
    if (existing.kind !== "PROJECT" || existing.authorId !== author.id)
      throw new ProjectError("invalidProjectSubmission");
    return existing.id;
  }

  await requireAllowedWebsite(tx, targetUrl.href);
  if (
    coverId &&
    !(await tx.media.findFirst({
      where: { id: coverId, ownerId: author.id, ready: true },
      select: { id: true },
    }))
  )
    throw new ProjectError("invalidProjectCover");

  const state = author.role === "OWNER" ? "PUBLISHED" : "PENDING_HUMAN";
  const project = await tx.content.create({
    data: {
      authorId: author.id,
      kind: "PROJECT",
      slug,
      publishedVersion: state === "PUBLISHED" ? 1 : null,
      revisions: {
        create: {
          version: 1,
          title: title.trim(),
          summary: summary.trim(),
          targetUrl: targetUrl.href,
          state,
          ...(coverId && { media: { connect: { id: coverId } } }),
          ...(state === "PUBLISHED" && {
            reviews: {
              create: {
                targetVersion: 1,
                result: state,
                reviewerId: author.id,
                reason: "站主直接发布",
              },
            },
          }),
        },
      },
    },
    select: { id: true },
  });
  await tx.auditLog.create({
    data: {
      actorId: author.id,
      action: state === "PUBLISHED" ? "project.publish" : "project.submit",
      targetId: project.id,
      after: { version: 1, state },
    },
  });
  return project.id;
}

export async function reviewProject(
  tx: Db,
  actor: Actor | null,
  id: unknown,
  version: unknown,
  form: FormData,
) {
  const reviewer = requireProjectActor(actor, "site.manage");
  if (
    typeof id !== "string" ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(id) ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 1
  )
    throw new ProjectError("invalidProjectSubmission");
  const input = reviewInput(form.get("decision"), form.get("reason"));
  // Serialize review and author withdrawal before locking the content/revision.
  const submission = await tx.content.findFirst({
    where: { id, kind: "PROJECT", currentVersion: version },
    select: { authorId: true },
  });
  if (!submission) throw new ProjectError("projectReviewConflict");
  await lockUserAccount(tx, submission.authorId);
  const claimed = await tx.content.updateMany({
    where: {
      id,
      kind: "PROJECT",
      currentVersion: version,
      revisions: { some: { version, state: "PENDING_HUMAN" } },
    },
    data: { updatedAt: new Date() },
  });
  if (claimed.count !== 1) throw new ProjectError("projectReviewConflict");
  const pending = await tx.contentRevision.findUniqueOrThrow({
    where: { contentId_version: { contentId: id, version } },
    include: { content: { select: { authorId: true } } },
  });
  if (pending.state !== "PENDING_HUMAN") throw new ProjectError("projectReviewConflict");
  if (input.decision === "approve") {
    const author = await lockedAuthor(tx, pending.content.authorId);
    const access = authorize(author, "project.submit");
    if (!access.allowed)
      throw new ProjectError({ key: "authorCannotPublish", reason: access.reason });
    await requireAllowedWebsite(tx, pending.targetUrl);
  }
  const state = input.decision === "approve" ? "PUBLISHED" : "REJECTED";
  await tx.contentRevision.update({
    where: { id: pending.id },
    data: {
      state,
      reviews: {
        create: {
          targetVersion: version,
          result: state,
          reason: input.reason,
          reviewerId: reviewer.id,
        },
      },
    },
  });
  if (state === "PUBLISHED")
    await tx.content.update({ where: { id }, data: { publishedVersion: version } });
  await tx.auditLog.create({
    data: {
      actorId: reviewer.id,
      action: "project.review",
      targetId: id,
      before: { version, state: "PENDING_HUMAN" },
      after: { version, state },
    },
  });
}

const latest = {
  orderBy: { version: "desc" },
  take: 1,
  include: {
    media: { where: { ready: true }, select: { id: true }, take: 1 },
    reviews: { orderBy: { createdAt: "desc" }, take: 1 },
  },
} satisfies Prisma.Content$revisionsArgs;

export function listOwnProjects(db: Db, actor: Actor | null, page: number) {
  if (!actor || actor.banned) throw new ProjectError(actor ? "accountBanned" : "loginRequired");
  return db.content.findMany({
    where: { kind: "PROJECT", authorId: actor.id },
    include: { revisions: latest },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 21,
    skip: (page - 1) * 20,
  });
}

export function listPendingProjects(db: Db, actor: Actor | null, page: number) {
  requireProjectActor(actor, "site.manage");
  return db.content.findMany({
    where: { kind: "PROJECT", revisions: { some: { state: "PENDING_HUMAN" } } },
    include: { revisions: latest, author: { select: { name: true } } },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: 21,
    skip: (page - 1) * 20,
  });
}

type PublicProject = {
  id: string;
  title: string;
  summary: string;
  targetUrl: string;
  authorName: string;
  coverId: string | null;
};

export function listPublishedProjects(db: Db, page = 1) {
  return db.$queryRaw<PublicProject[]>`
    SELECT c.id, r.title, r.summary, r."targetUrl", u.name AS "authorName",
      (SELECT m.id FROM "_ContentRevisionToMedia" rm JOIN "Media" m ON m.id = rm."B"
       WHERE rm."A" = r.id AND m.ready ORDER BY m.id LIMIT 1) AS "coverId"
    FROM "Content" c JOIN "ContentRevision" r ON r."contentId" = c.id
      AND r.version = c."publishedVersion" AND r.state = 'PUBLISHED'
    JOIN "User" u ON u.id = c."authorId"
    WHERE c.kind = 'PROJECT' AND r."targetUrl" IS NOT NULL
    ORDER BY c."updatedAt" DESC, c.id DESC
    LIMIT 21 OFFSET ${(page - 1) * 20}
  `;
}
