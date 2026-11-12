import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { SystemKey } from "@/i18n/messages";
import {
  authorize,
  editableCapabilities,
  isEditableCapability,
  isPermissionMode,
  type Actor,
  type EditableCapability,
} from "../domain/permissions";

type Db = Prisma.TransactionClient;
const accessAuditActions = ["user.updateBan", "user.updatePermission", "media.updateUserAccess"];
const accountDetails = {
  quota: true,
  permissions: { where: { capability: { in: editableCapabilities } } },
} satisfies Prisma.UserInclude;

export class UserAccessError extends Error {
  readonly key: SystemKey;

  constructor(key: SystemKey) {
    super(key);
    this.key = key;
  }
}

function requireOwner(actor: Actor | null) {
  const access = authorize(actor, "site.manage");
  if (!actor || !access.allowed) throw new UserAccessError(access.reason);
  return actor;
}

export async function lockUserAccount(tx: Db, userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
}

export function listUserAccounts(
  db: Db,
  actor: Actor | null,
  {
    page,
    search,
    status,
    capability,
    effect,
  }: {
    page: number;
    search: string;
    status?: "active" | "banned" | "custom";
    capability?: EditableCapability;
    effect?: "ALLOW" | "DENY";
  },
) {
  requireOwner(actor);
  return db.user.findMany({
    where: {
      ...(search && {
        OR: [{ githubId: search }, { name: { contains: search, mode: "insensitive" } }],
      }),
      ...(status === "active" && { banned: false }),
      ...(status === "banned" && { banned: true }),
      ...((status === "custom" || capability || effect) && {
        permissions: {
          some: {
            capability: capability ?? { in: editableCapabilities },
            effect,
          },
        },
      }),
    },
    select: {
      id: true,
      name: true,
      githubId: true,
      banned: true,
      permissions: {
        where: { capability: { in: editableCapabilities } },
        select: { effect: true },
      },
      quota: { select: { usedBytes: true, limitBytes: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 20,
    take: 21,
  });
}

export async function readUserAccount(db: Db, actor: Actor | null, id: string) {
  requireOwner(actor);
  const user = await db.user.findUnique({ where: { id }, include: accountDetails });
  if (!user) return null;
  const audit = await db.auditLog.findMany({
    where: { targetId: id, action: { in: accessAuditActions } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 10,
  });
  const operators = await db.user.findMany({
    where: { id: { in: [...new Set(audit.map(({ actorId }) => actorId))] } },
    select: { id: true, name: true },
  });
  return { user, audit, operators };
}

export async function updateUserAccess(
  tx: Db,
  actor: Actor | null,
  id: string,
  ownerGithubId: string | undefined,
  form: FormData,
) {
  const manager = requireOwner(actor);
  await lockUserAccount(tx, id);
  const user = await tx.user.findUnique({ where: { id }, include: accountDetails });
  if (!user) throw new UserAccessError("managedUserMissing");
  const expected = form.get("expected");
  const value = form.get("value");

  if (form.get("scope") === "account") {
    if (
      (expected !== "active" && expected !== "banned") ||
      (value !== "active" && value !== "banned")
    )
      throw new UserAccessError("invalidUserAccess");
    const banned = value === "banned";
    if (
      banned &&
      (id === manager.id ||
        user.githubId === ownerGithubId ||
        (user.githubId.startsWith("local:") && user.role === "OWNER"))
    )
      throw new UserAccessError("ownerAccountProtected");
    if ((expected === "banned") !== user.banned) throw new UserAccessError("userAccessConflict");
    if (banned === user.banned) return;

    await tx.user.update({
      where: { id },
      data: { banned, sessionVersion: { increment: 1 } },
    });
    await tx.auditLog.create({
      data: {
        actorId: manager.id,
        action: "user.updateBan",
        targetId: id,
        before: { banned: user.banned },
        after: { banned },
      },
    });
    return;
  }

  const capability = form.get("capability");
  if (
    form.get("scope") !== "permission" ||
    !isEditableCapability(capability) ||
    !isPermissionMode(expected) ||
    !isPermissionMode(value)
  )
    throw new UserAccessError("invalidUserAccess");

  const previous =
    user.permissions.find((permission) => permission.capability === capability)?.effect ??
    "inherit";
  if (previous !== expected) throw new UserAccessError("userAccessConflict");
  if (value === previous) return;
  if (value === "inherit") {
    await tx.permissionOverride.deleteMany({ where: { userId: id, capability } });
  } else {
    await tx.permissionOverride.upsert({
      where: { userId_capability: { userId: id, capability } },
      create: { userId: id, capability, effect: value },
      update: { effect: value },
    });
  }
  await tx.auditLog.create({
    data: {
      actorId: manager.id,
      action: "user.updatePermission",
      targetId: id,
      before: { capability, effect: previous },
      after: { capability, effect: value },
    },
  });
}
