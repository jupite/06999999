import type { SystemKey } from "../../i18n/messages";

export const capabilities = [
  "post.submit",
  "project.submit",
  "photo.submit",
  "music.submit",
  "friend.submit",
  "comment.submit",
  "image.upload",
  "content.editOwn",
  "like.toggle",
  "site.manage",
] as const;
export type Capability = (typeof capabilities)[number];
export const editableCapabilities = capabilities.filter(
  (capability) => capability !== "site.manage",
);
export type EditableCapability = (typeof editableCapabilities)[number];

export function isEditableCapability(value: unknown): value is EditableCapability {
  return editableCapabilities.some((capability) => capability === value);
}

export const permissionModes = ["inherit", "ALLOW", "DENY"] as const;
export type PermissionMode = (typeof permissionModes)[number];

export function isPermissionMode(value: unknown): value is PermissionMode {
  return permissionModes.some((mode) => mode === value);
}
export type Actor = {
  id: string;
  role: "OWNER" | "MEMBER";
  banned: boolean;
  overrides: Partial<Record<Capability, "ALLOW" | "DENY">>;
};

export function accountActor(
  user: {
    id: string;
    githubId: string;
    role?: "OWNER" | "MEMBER";
    banned: boolean;
    permissions: { capability: string; effect: "ALLOW" | "DENY" }[];
  },
  ownerGithubId: string | undefined,
): Actor {
  return {
    id: user.id,
    role:
      user.githubId === ownerGithubId ||
      (user.githubId.startsWith("local:") && user.role === "OWNER")
        ? "OWNER"
        : "MEMBER",
    banned: user.banned,
    overrides: Object.fromEntries(
      user.permissions.map(({ capability, effect }) => [capability, effect]),
    ),
  };
}

export function hasCurrentSession(
  user: { banned: boolean; sessionVersion: number } | null,
  version: unknown,
) {
  return !!user && !user.banned && user.sessionVersion === (version === undefined ? 0 : version);
}
export function authorize(
  actor: Actor | null,
  capability: Capability,
  ownerId?: string,
): { allowed: boolean; reason: SystemKey } {
  if (!actor) return { allowed: false, reason: "loginRequired" };
  if (actor.banned) return { allowed: false, reason: "accountBanned" };
  if (!capabilities.includes(capability)) return { allowed: false, reason: "permissionDenied" };
  if (actor.overrides[capability] === "DENY") return { allowed: false, reason: "permissionDenied" };
  if (capability === "site.manage" && actor.role !== "OWNER")
    return { allowed: false, reason: "ownerOnly" };
  if (ownerId && actor.id !== ownerId && actor.role !== "OWNER")
    return { allowed: false, reason: "ownershipRequired" };
  if (actor.role === "OWNER") return { allowed: true, reason: "ownerPermission" };
  if (actor.overrides[capability] === "ALLOW")
    return { allowed: true, reason: "permissionGranted" };
  if (capability === "image.upload") return { allowed: false, reason: "imagePermissionRequired" };
  return { allowed: true, reason: "memberPermission" };
}
export function withinQuota(used: bigint, reserved: bigint, requested: bigint, limit: bigint) {
  return (
    used >= 0n &&
    reserved >= 0n &&
    requested > 0n &&
    limit > 0n &&
    used + reserved + requested <= limit
  );
}
