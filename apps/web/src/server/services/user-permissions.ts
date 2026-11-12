import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { authorize, isEditableCapability, type Actor } from "../domain/permissions";
import { RoleError, effectivePermissions } from "./roles";
import { UserAccessError, updateUserAccess } from "./user-access";
import type { RoleMode } from "../domain/roles";
const validMode = (value: unknown): value is RoleMode =>
  value === "inherit" || value === "allow" || value === "deny";
export async function updatePersonalPermission(
  db: Prisma.TransactionClient,
  actor: Actor | null,
  id: string,
  key: unknown,
  input: unknown,
) {
  const access = authorize(actor, "site.manage");
  if (!actor || !access.allowed) throw new RoleError(access.reason, actor ? 403 : 401);
  if (!isEditableCapability(key)) throw new RoleError("permissionCapabilityUnknown", 404);
  if (
    !/^[A-Za-z0-9_-]{1,100}$/.test(id) ||
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  )
    throw new RoleError("invalidUserAccess", 400);
  const data = input as Record<string, unknown>;
  if (
    Object.keys(data).some((name) => !["mode", "expectedMode"].includes(name)) ||
    !validMode(data.mode) ||
    !validMode(data.expectedMode)
  )
    throw new RoleError("invalidUserAccess", 400);
  const convert = (mode: RoleMode) =>
    mode === "allow" ? "ALLOW" : mode === "deny" ? "DENY" : "inherit";
  const form = new FormData();
  form.set("scope", "permission");
  form.set("capability", key);
  form.set("value", convert(data.mode));
  form.set("expected", convert(data.expectedMode));
  try {
    await updateUserAccess(db, actor, id, process.env.OWNER_GITHUB_ID, form);
  } catch (error) {
    if (error instanceof UserAccessError)
      throw new RoleError(
        error.key,
        error.key === "managedUserMissing"
          ? 404
          : error.key === "userAccessConflict"
            ? 409
            : error.key === "invalidUserAccess"
              ? 400
              : 403,
      );
    throw error;
  }
  return (await effectivePermissions(db, actor, id)).permissions.find((item) => item.key === key)!;
}
