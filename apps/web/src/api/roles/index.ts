import type { PermissionRole, RoleRules } from "@/server/domain/roles";
import type { SystemKey } from "@/i18n/messages";
type Failure = { error: SystemKey };
export async function savePermissionRole(
  id: string | null,
  input: { name: string; permissions: RoleRules; expectedVersion?: number },
): Promise<PermissionRole | Failure> {
  const response = await fetch(
    id ? `/api/admin/roles/${encodeURIComponent(id)}` : "/api/admin/roles",
    {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  const result = await response.json();
  if (!response.ok) return { error: result.error ?? "roleRequestFailed" };
  if (typeof result.id !== "string" || typeof result.version !== "number")
    throw Error("Invalid role response");
  return result;
}
export async function removePermissionRole(
  id: string,
  expectedVersion: number,
): Promise<{ ok: true } | Failure> {
  const response = await fetch(
    `/api/admin/roles/${encodeURIComponent(id)}?expectedVersion=${expectedVersion}`,
    { method: "DELETE" },
  );
  if (response.status === 204) return { ok: true };
  const result = await response.json();
  return { error: result.error ?? "roleRequestFailed" };
}
export async function setUserRole(
  id: string,
  roleId: string | null,
  expectedRoleId: string | null,
): Promise<{ roleId: string | null } | Failure> {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roleId, expectedRoleId }),
  });
  const result = await response.json();
  if (!response.ok) return { error: result.error ?? "roleRequestFailed" };
  if (result.roleId !== null && typeof result.roleId !== "string")
    throw Error("Invalid role assignment");
  return result;
}
