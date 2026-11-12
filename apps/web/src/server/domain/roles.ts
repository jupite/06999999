import type { EditableCapability } from "./permissions";
export const roleModes = ["inherit", "allow", "deny"] as const;
export type RoleMode = (typeof roleModes)[number];
export type RoleRules = Record<EditableCapability, RoleMode>;
export type PermissionRole = {
  id: string;
  name: string;
  version: number;
  permissions: RoleRules;
  userCount: number;
};
