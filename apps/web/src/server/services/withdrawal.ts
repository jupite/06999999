import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { SystemKey } from "@/i18n/messages";
import { accountActor, authorize, type Actor } from "../domain/permissions";
import { lockUserAccount } from "./user-access";
export type WithdrawableKind = "PHOTO" | "FRIEND_LINK" | "PROJECT";
export type WithdrawableState = "PENDING_HUMAN" | "PUBLISHED";
export class WithdrawalError extends Error {
  constructor(readonly key: SystemKey) {
    super(key);
  }
}
export async function withdrawOwnSubmission(
  db: Prisma.TransactionClient,
  actor: Actor | null,
  id: unknown,
  version: unknown,
  kind: unknown,
  state: unknown,
) {
  if (!actor) throw new WithdrawalError("loginRequired");
  if (
    typeof id !== "string" ||
    !id ||
    id.length > 100 ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    (kind !== "PHOTO" && kind !== "FRIEND_LINK" && kind !== "PROJECT") ||
    (state !== "PENDING_HUMAN" && state !== "PUBLISHED")
  )
    throw new WithdrawalError("withdrawalConflict");
  await lockUserAccount(db, actor.id);
  const user = await db.user.findUnique({
    where: { id: actor.id },
    include: { permissions: true },
  });
  if (!user) throw new WithdrawalError("loginRequired");
  const access = authorize(accountActor(user, process.env.OWNER_GITHUB_ID), "content.editOwn");
  if (!access.allowed) throw new WithdrawalError(access.reason);
  const content = await db.content.findFirst({
    where: { id, kind, authorId: actor.id, currentVersion: version },
    select: {
      publishedVersion: true,
      revisions: { where: { version, state }, select: { id: true } },
    },
  });
  const revision = content?.revisions[0];
  if (
    !content ||
    !revision ||
    (state === "PUBLISHED"
      ? content.publishedVersion !== version
      : content.publishedVersion !== null)
  )
    throw new WithdrawalError("withdrawalConflict");
  // Lock the revision before the content, matching the reviewer transaction order.
  const changed = await db.contentRevision.updateMany({
    where: { id: revision.id, version, state },
    data: { state: "WITHDRAWN" },
  });
  if (changed.count !== 1) throw new WithdrawalError("withdrawalConflict");
  const claimed = await db.content.updateMany({
    where: {
      id,
      kind,
      authorId: actor.id,
      currentVersion: version,
      publishedVersion: content.publishedVersion,
    },
    data: { publishedVersion: null, updatedAt: new Date() },
  });
  if (claimed.count !== 1) throw new WithdrawalError("withdrawalConflict");
  await db.moderationReview.create({
    data: {
      revisionId: revision.id,
      targetVersion: version,
      result: "WITHDRAWN",
      reason: state === "PUBLISHED" ? "作者撤下已公开内容" : "作者撤回投稿",
      reviewerId: actor.id,
    },
  });
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action:
        kind === "PHOTO"
          ? "photo.withdraw"
          : kind === "PROJECT"
            ? "project.withdraw"
            : "friend.withdraw",
      targetId: id,
      before: { version, state, publishedVersion: content.publishedVersion },
      after: { version, state: "WITHDRAWN", publishedVersion: null },
    },
  });
}
