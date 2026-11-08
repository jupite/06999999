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
export type Actor = {
  id: string;
  role: "OWNER" | "MEMBER";
  banned: boolean;
  overrides: Partial<Record<Capability, "ALLOW" | "DENY">>;
};
export function authorize(
  actor: Actor | null,
  capability: Capability,
  ownerId?: string,
): { allowed: boolean; reason: SystemKey } {
  if (!actor) return { allowed: false, reason: "loginRequired" };
  if (actor.banned) return { allowed: false, reason: "accountBanned" };
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
