import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { authorize, type Actor } from "../domain/permissions";

export const auditGroups = ["user", "media", "music", "article", "project", "comment"] as const;
export type AuditGroup = (typeof auditGroups)[number];
export function isAuditGroup(value: unknown): value is AuditGroup {
  return auditGroups.some((group) => group === value);
}
export async function listAuditRecords(
  db: Prisma.TransactionClient,
  actor: Actor | null,
  filters: { page: number; group?: AuditGroup; actorId?: string; targetId?: string },
) {
  const access = authorize(actor, "site.manage");
  if (!access.allowed) throw new Error(access.reason);
  const records = await db.auditLog.findMany({
    where: {
      ...(filters.group && { action: { startsWith: `${filters.group}.` } }),
      ...(filters.actorId && { actorId: filters.actorId }),
      ...(filters.targetId && { targetId: filters.targetId }),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (filters.page - 1) * 20,
    take: 21,
  });
  const operators = await db.user.findMany({
    where: { id: { in: [...new Set(records.map((record) => record.actorId))] } },
    select: { id: true, name: true },
  });
  return { records, operators };
}
