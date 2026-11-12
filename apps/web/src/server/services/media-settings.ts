import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { maxUploadMib, MediaError, quotaBytes } from "../domain/media";
import { authorize, isPermissionMode, type Actor } from "../domain/permissions";
import { lockUserAccount } from "./user-access";

export function isGithubId(value: unknown): value is string {
  return typeof value === "string" && /^(?:\d{1,20}|local:[A-Za-z0-9_-]{1,64})$/.test(value);
}

export async function saveMediaLimits(db: PrismaClient, actor: Actor, form: FormData) {
  const access = authorize(actor, "site.manage");
  if (!access.allowed) throw new MediaError(access.reason, 403);
  const maxImageBytes = quotaBytes(form.get("fileMib"), maxUploadMib);
  const totalMediaLimitBytes = quotaBytes(form.get("siteMib"));
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "SiteSettings" ("id", "updatedAt") VALUES ('site', CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO NOTHING
    `;
    const [previous] = await tx.$queryRaw<
      { maxImageBytes: bigint; totalMediaLimitBytes: bigint }[]
    >`
      SELECT "maxImageBytes", "totalMediaLimitBytes" FROM "SiteSettings"
      WHERE "id" = 'site' FOR UPDATE
    `;
    const limits = { maxImageBytes, totalMediaLimitBytes };
    await tx.siteSettings.update({ where: { id: "site" }, data: limits });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "media.updateLimits",
        targetId: "site",
        before: {
          maxImageBytes: String(previous?.maxImageBytes ?? 0n),
          totalMediaLimitBytes: String(previous?.totalMediaLimitBytes ?? 0n),
        },
        after: {
          maxImageBytes: String(maxImageBytes),
          totalMediaLimitBytes: String(totalMediaLimitBytes),
        },
      },
    });
  });
}

export async function saveUserMediaAccess(
  db: PrismaClient,
  actor: Actor,
  githubId: string,
  form: FormData,
) {
  const access = authorize(actor, "site.manage");
  if (!access.allowed) throw new MediaError(access.reason, 403);
  const limitBytes = quotaBytes(form.get("userMib"));
  const mode = form.get("permissionMode");
  if (mode !== null && !isPermissionMode(mode)) throw new MediaError("invalidMediaQuota");
  const effect = mode === null ? (form.get("enabled") === "on" ? "ALLOW" : "DENY") : mode;
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { githubId }, select: { id: true } });
    if (!user) throw new MediaError("mediaUserMissing");
    await lockUserAccount(tx, user.id);
    const where = { userId_capability: { userId: user.id, capability: "image.upload" } };
    const previous = await tx.permissionOverride.findUnique({ where });
    const quota = await tx.storageQuota.findUnique({ where: { userId: user.id } });
    if (effect === "inherit")
      await tx.permissionOverride.deleteMany({
        where: { userId: user.id, capability: "image.upload" },
      });
    else
      await tx.permissionOverride.upsert({
        where,
        create: { ...where.userId_capability, effect },
        update: { effect },
      });
    await tx.storageQuota.upsert({
      where: { userId: user.id },
      create: { userId: user.id, limitBytes },
      update: { limitBytes },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "media.updateUserAccess",
        targetId: user.id,
        before: { effect: previous?.effect ?? null, limitBytes: String(quota?.limitBytes ?? 0n) },
        after: { effect, limitBytes: String(limitBytes) },
      },
    });
  });
}
