import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import {
  accountActor,
  isEditableCapability,
  type Actor,
  type Capability,
} from "../domain/permissions";
export async function loadFeatureFlags(db: Prisma.TransactionClient) {
  const rows = await db.featureFlag.findMany({ select: { key: true, enabled: true } });
  return Object.fromEntries(rows.map((row) => [row.key, row.enabled])) as Partial<
    Record<Capability, boolean>
  >;
}
async function loadRoleAssignment(db: Prisma.TransactionClient, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { assignedRole: { select: { id: true, name: true, permissions: true } } },
  });
  const role = user?.assignedRole;
  return {
    assignedRoleId: role?.id ?? null,
    assignedRoleName: role?.name ?? null,
    roleRules: Object.fromEntries(
      (role?.permissions ?? [])
        .filter((rule) => isEditableCapability(rule.capability))
        .map((rule) => [rule.capability, rule.effect]),
    ) as Actor["roleRules"],
  };
}
export function refreshActorFeatures(db: Prisma.TransactionClient, actor: Actor): Promise<Actor>;
export function refreshActorFeatures(
  db: Prisma.TransactionClient,
  actor: Actor | null,
): Promise<Actor | null>;
export async function refreshActorFeatures(
  db: Prisma.TransactionClient,
  actor: Actor | null,
): Promise<Actor | null> {
  return actor
    ? {
        ...actor,
        features: await loadFeatureFlags(db),
        ...(await loadRoleAssignment(db, actor.id)),
      }
    : null;
}
export async function resolveAccountActor(
  db: Prisma.TransactionClient,
  user: Parameters<typeof accountActor>[0],
  ownerGithubId?: string,
) {
  return refreshActorFeatures(db, accountActor(user, ownerGithubId));
}
