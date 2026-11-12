import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { accountActor, type Actor, type Capability } from "../domain/permissions";
export async function loadFeatureFlags(db: Prisma.TransactionClient) {
  const rows = await db.featureFlag.findMany({ select: { key: true, enabled: true } });
  return Object.fromEntries(rows.map((row) => [row.key, row.enabled])) as Partial<
    Record<Capability, boolean>
  >;
}
export async function refreshActorFeatures(db: Prisma.TransactionClient, actor: Actor | null) {
  return actor ? { ...actor, features: await loadFeatureFlags(db) } : null;
}
export async function resolveAccountActor(
  db: Prisma.TransactionClient,
  user: Parameters<typeof accountActor>[0],
  ownerGithubId?: string,
) {
  return { ...accountActor(user, ownerGithubId), features: await loadFeatureFlags(db) };
}
