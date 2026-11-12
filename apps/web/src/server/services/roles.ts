import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { SystemKey } from "@/i18n/messages";
import {
  accountActor,
  authorize,
  capabilities,
  editableCapabilities,
  isEditableCapability,
  type Actor,
} from "../domain/permissions";
import type { RoleMode, PermissionRole } from "../domain/roles";
import { resolveAccountActor } from "../access";
import { lockUserAccount } from "./user-access";
type Db = Prisma.TransactionClient;
export class RoleError extends Error {
  constructor(
    readonly key: SystemKey,
    readonly status: number,
  ) {
    super(key);
  }
}
function manager(actor: Actor | null) {
  const access = authorize(actor, "site.manage");
  if (!actor || !access.allowed) throw new RoleError(access.reason, actor ? 403 : 401);
  return actor;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new RoleError("roleInvalid", 400);
  return value as Record<string, unknown>;
}
function identifier(id: unknown): asserts id is string {
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(id))
    throw new RoleError("roleMissing", 404);
}
function name(value: unknown) {
  if (typeof value !== "string") throw new RoleError("roleInvalid", 400);
  const result = value.trim().normalize("NFC");
  if (!result || Array.from(result).length > 64 || /[\p{Cc}]/u.test(result))
    throw new RoleError("roleInvalid", 400);
  return result;
}
function rules(value: unknown) {
  const data = record(value);
  return Object.entries(data).flatMap(([capability, mode]) => {
    if (
      !isEditableCapability(capability) ||
      !["inherit", "allow", "deny"].includes(String(mode)) ||
      typeof mode !== "string"
    )
      throw new RoleError("roleInvalid", 400);
    return mode === "inherit"
      ? []
      : [{ capability, effect: mode === "allow" ? ("ALLOW" as const) : ("DENY" as const) }];
  });
}
const include = {
  permissions: true,
  _count: { select: { users: true } },
} satisfies Prisma.PermissionRoleInclude;
function result(role: {
  id: string;
  name: string;
  version: number;
  permissions: { capability: string; effect: "ALLOW" | "DENY" }[];
  _count: { users: number };
}): PermissionRole {
  return {
    id: role.id,
    name: role.name,
    version: role.version,
    userCount: role._count.users,
    permissions: Object.fromEntries(
      editableCapabilities.map((key) => [
        key,
        role.permissions.find((rule) => rule.capability === key)?.effect === "ALLOW"
          ? "allow"
          : role.permissions.find((rule) => rule.capability === key)?.effect === "DENY"
            ? "deny"
            : "inherit",
      ]),
    ) as PermissionRole["permissions"],
  };
}
function version(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    throw new RoleError("roleInvalid", 400);
}
async function lockRole(db: Db, id: string) {
  const rows = await db.$queryRaw<
    { id: string }[]
  >`SELECT id FROM "PermissionRole" WHERE id=${id} FOR UPDATE`;
  if (!rows.length) throw new RoleError("roleMissing", 404);
}
function unique(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    throw new RoleError("roleNameTaken", 409);
  throw error;
}
export async function listRoles(db: Db, actor: Actor | null) {
  manager(actor);
  return (
    await db.permissionRole.findMany({ include, orderBy: [{ name: "asc" }, { id: "asc" }] })
  ).map(result);
}
export async function getRole(db: Db, actor: Actor | null, id: unknown) {
  manager(actor);
  identifier(id);
  const role = await db.permissionRole.findUnique({ where: { id }, include });
  if (!role) throw new RoleError("roleMissing", 404);
  return result(role);
}
export async function createRole(db: Db, actor: Actor | null, input: unknown) {
  const author = manager(actor),
    data = record(input);
  if (Object.keys(data).some((key) => !["name", "permissions"].includes(key)))
    throw new RoleError("roleInvalid", 400);
  const roleName = name(data.name),
    permissions = rules(data.permissions);
  try {
    const role = await db.permissionRole.create({
      data: { name: roleName, permissions: { create: permissions } },
      include,
    });
    const output = result(role);
    await db.auditLog.create({
      data: {
        actorId: author.id,
        action: "role.create",
        targetId: role.id,
        after: { name: roleName, version: 1, permissions: output.permissions },
      },
    });
    return output;
  } catch (error) {
    unique(error);
  }
}
export async function updateRole(db: Db, actor: Actor | null, id: unknown, input: unknown) {
  const author = manager(actor);
  identifier(id);
  const data = record(input);
  version(data.expectedVersion);
  if (
    Object.keys(data).some((key) => !["name", "permissions", "expectedVersion"].includes(key)) ||
    (!Object.hasOwn(data, "name") && !Object.hasOwn(data, "permissions"))
  )
    throw new RoleError("roleInvalid", 400);
  const roleName = Object.hasOwn(data, "name") ? name(data.name) : undefined,
    permissions = Object.hasOwn(data, "permissions") ? rules(data.permissions) : undefined;
  await lockRole(db, id);
  const previous = await getRole(db, actor, id);
  if (previous.version !== data.expectedVersion) throw new RoleError("roleConflict", 409);
  try {
    if (permissions) {
      await db.rolePermission.deleteMany({ where: { roleId: id } });
      if (permissions.length)
        await db.rolePermission.createMany({
          data: permissions.map((rule) => ({ ...rule, roleId: id })),
        });
    }
    const role = await db.permissionRole.update({
      where: { id },
      data: { ...(roleName !== undefined ? { name: roleName } : {}), version: { increment: 1 } },
      include,
    });
    const output = result(role);
    await db.auditLog.create({
      data: {
        actorId: author.id,
        action: "role.update",
        targetId: id,
        before: {
          name: previous.name,
          version: previous.version,
          permissions: previous.permissions,
        },
        after: { name: output.name, version: output.version, permissions: output.permissions },
      },
    });
    return output;
  } catch (error) {
    unique(error);
  }
}
export async function deleteRole(
  db: Db,
  actor: Actor | null,
  id: unknown,
  expectedVersion: unknown,
) {
  const author = manager(actor);
  identifier(id);
  version(expectedVersion);
  await lockRole(db, id);
  const role = await getRole(db, actor, id);
  if (role.version !== expectedVersion) throw new RoleError("roleConflict", 409);
  if (role.userCount) throw new RoleError("roleInUse", 409);
  await db.permissionRole.delete({ where: { id } });
  await db.auditLog.create({
    data: {
      actorId: author.id,
      action: "role.delete",
      targetId: id,
      before: { name: role.name, version: role.version, permissions: role.permissions },
    },
  });
}
export async function assignUserRole(db: Db, actor: Actor | null, id: unknown, input: unknown) {
  const author = manager(actor);
  identifier(id);
  const data = record(input);
  if (
    Object.keys(data).some((key) => !["roleId", "expectedRoleId"].includes(key)) ||
    !Object.hasOwn(data, "roleId") ||
    !Object.hasOwn(data, "expectedRoleId")
  )
    throw new RoleError("roleInvalid", 400);
  const roleId = data.roleId,
    expected = data.expectedRoleId;
  if (
    (roleId !== null && (typeof roleId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(roleId))) ||
    (expected !== null &&
      (typeof expected !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(expected)))
  )
    throw new RoleError("roleInvalid", 400);
  await lockUserAccount(db, id);
  const user = await db.user.findUnique({ where: { id }, include: { permissions: true } });
  if (!user) throw new RoleError("managedUserMissing", 404);
  if (accountActor(user, process.env.OWNER_GITHUB_ID).role === "OWNER")
    throw new RoleError("ownerAccountProtected", 403);
  if (user.assignedRoleId !== expected) throw new RoleError("roleAssignmentConflict", 409);
  if (roleId !== null) {
    const roles = await db.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "PermissionRole" WHERE id=${roleId} FOR SHARE`;
    if (!roles.length) throw new RoleError("roleMissing", 404);
  }
  if (roleId === user.assignedRoleId) return { roleId };
  await db.user.update({ where: { id }, data: { assignedRoleId: roleId } });
  await db.auditLog.create({
    data: {
      actorId: author.id,
      action: "user.assignRole",
      targetId: id,
      before: { roleId: user.assignedRoleId },
      after: { roleId },
    },
  });
  return { roleId };
}
export async function effectivePermissions(db: Db, actor: Actor | null, id: unknown) {
  manager(actor);
  identifier(id);
  const user = await db.user.findUnique({ where: { id }, include: { permissions: true } });
  if (!user) throw new RoleError("managedUserMissing", 404);
  const account = await resolveAccountActor(db, user, process.env.OWNER_GITHUB_ID);
  const mode = (value: "ALLOW" | "DENY" | undefined): RoleMode =>
    value === "ALLOW" ? "allow" : value === "DENY" ? "deny" : "inherit";
  return {
    roleId: account.assignedRoleId ?? null,
    permissions: capabilities.map((key) => {
      const access = authorize(account, key);
      const source =
        access.reason === "accountBanned"
          ? "account_banned"
          : access.reason === "featureDisabled"
            ? "feature_disabled"
            : access.reason === "ownerPermission"
              ? "owner"
              : access.reason === "rolePermissionGranted" ||
                  access.reason === "rolePermissionDenied"
                ? "role"
                : account.overrides[key]
                  ? "user_override"
                  : "default";
      return {
        key,
        featureEnabled: key === "site.manage" || account.features?.[key] !== false,
        roleRule: mode(account.roleRules?.[key]),
        userOverride: mode(account.overrides[key]),
        allowed: access.allowed,
        source,
        reason: access.reason,
      };
    }),
  };
}
