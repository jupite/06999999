import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "../domain/permissions";
import { authorize } from "../domain/permissions";
import { featureKeys, isFeatureKey } from "../domain/features";
import type { SystemKey } from "@/i18n/messages";
import { loadFeatureFlags } from "../access";
export class FeatureError extends Error {
  constructor(
    readonly key: SystemKey,
    readonly status: number,
  ) {
    super(key);
  }
}
function requireManager(actor: Actor | null) {
  const access = authorize(actor, "site.manage");
  if (!actor || !access.allowed) throw new FeatureError(access.reason, actor ? 403 : 401);
  return actor;
}
export async function listFeatures(db: Prisma.TransactionClient, actor: Actor | null) {
  requireManager(actor);
  const flags = await loadFeatureFlags(db);
  return featureKeys.map((key) => ({ key, enabled: flags[key] !== false }));
}
export async function updateFeature(
  db: Prisma.TransactionClient,
  actor: Actor | null,
  key: unknown,
  input: unknown,
) {
  const manager = requireManager(actor);
  if (!isFeatureKey(key)) throw new FeatureError("featureUnknown", 404);
  if (!input || typeof input !== "object") throw new FeatureError("featureInvalid", 400);
  const { enabled, expectedEnabled } = input as { enabled?: unknown; expectedEnabled?: unknown };
  if (typeof enabled !== "boolean" || typeof expectedEnabled !== "boolean")
    throw new FeatureError("featureInvalid", 400);
  await db.featureFlag.createMany({ data: [{ key, enabled: true }], skipDuplicates: true });
  const [previous] = await db.$queryRaw<
    { enabled: boolean }[]
  >`SELECT enabled FROM "FeatureFlag" WHERE key=${key} FOR UPDATE`;
  if (previous.enabled !== expectedEnabled) throw new FeatureError("featureConflict", 409);
  if (enabled === previous.enabled) return { key, enabled };
  await db.featureFlag.update({ where: { key }, data: { enabled } });
  await db.auditLog.create({
    data: {
      actorId: manager.id,
      action: "feature.update",
      targetId: key,
      before: { enabled: previous.enabled },
      after: { enabled },
    },
  });
  return { key, enabled };
}
