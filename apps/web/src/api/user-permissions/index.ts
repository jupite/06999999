import type { EditableCapability } from "@/server/domain/permissions";
import type { RoleMode } from "@/server/domain/roles";
import type { SystemKey } from "@/i18n/messages";
export type EffectiveUserPermission = {
  key: string;
  featureEnabled: boolean;
  roleRule: RoleMode;
  userOverride: RoleMode;
  allowed: boolean;
  source: string;
  reason: SystemKey;
};
export async function setUserPermissionOverride(
  id: string,
  key: EditableCapability,
  mode: RoleMode,
  expectedMode: RoleMode,
): Promise<EffectiveUserPermission | { error: SystemKey }> {
  const response = await fetch(
    `/api/admin/users/${encodeURIComponent(id)}/permissions/${encodeURIComponent(key)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, expectedMode }),
    },
  );
  const result = await response.json();
  if (!response.ok) return { error: result.error ?? "userAccessSaveFailed" };
  if (
    result.key !== key ||
    typeof result.allowed !== "boolean" ||
    typeof result.reason !== "string"
  )
    throw Error("Invalid permission response");
  return result;
}
