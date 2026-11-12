import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { authorize, type Actor, type Capability } from "../domain/permissions";
import type { SystemKey } from "@/i18n/messages";
export class ResubmissionError extends Error {
  constructor(readonly key: SystemKey) {
    super(key);
  }
}
export async function readRejectedSubmission(
  db: Prisma.TransactionClient,
  actor: Actor | null,
  id: unknown,
  kind: "PHOTO" | "FRIEND_LINK",
) {
  const checks: Capability[] = [
    "content.editOwn",
    kind === "PHOTO" ? "photo.submit" : "friend.submit",
    ...(kind === "PHOTO" ? ["image.upload" as const] : []),
  ];
  for (const capability of checks) {
    const access = authorize(actor, capability);
    if (!access.allowed) throw new ResubmissionError(access.reason);
  }
  if (!actor || typeof id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) return null;
  const content = await db.content.findFirst({
    where: { id, kind, authorId: actor.id, publishedVersion: null },
    include: {
      revisions: {
        orderBy: { version: "desc" },
        take: 1,
        include: {
          reviews: {
            where: { result: "REJECTED" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { reason: true },
          },
          tags: { orderBy: { name: "asc" }, select: { name: true } },
          media: { where: { ready: true }, select: { id: true }, orderBy: { id: "asc" } },
        },
      },
    },
  });
  return content?.revisions[0]?.version === content?.currentVersion &&
    content?.revisions[0]?.state === "REJECTED"
    ? content
    : null;
}
