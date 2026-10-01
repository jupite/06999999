export const capabilities = ["post.submit", "project.submit", "photo.submit", "music.submit", "friend.submit", "comment.submit", "image.upload", "content.editOwn", "like.toggle", "site.manage"] as const;
export type Capability = typeof capabilities[number];
export type Actor = { id: string; role: "OWNER" | "MEMBER"; banned: boolean; overrides: Partial<Record<Capability, "ALLOW" | "DENY">> };
export function authorize(actor: Actor | null, capability: Capability, ownerId?: string) {
  if (!actor) return { allowed: false, reason: "请先登录" };
  if (actor.banned) return { allowed: false, reason: "账号已封禁" };
  if (actor.overrides[capability] === "DENY") return { allowed: false, reason: "该权限已被禁止" };
  if (capability === "site.manage" && actor.role !== "OWNER") return { allowed: false, reason: "仅站主可操作" };
  if (ownerId && actor.id !== ownerId && actor.role !== "OWNER") return { allowed: false, reason: "只能操作自己的内容" };
  if (actor.role === "OWNER") return { allowed: true, reason: "站主权限" };
  if (actor.overrides[capability] === "ALLOW") return { allowed: true, reason: "用户白名单" };
  if (capability === "image.upload") return { allowed: false, reason: "需要站主授权图片上传" };
  return { allowed: true, reason: "普通用户默认权限" };
}
export function withinQuota(used: bigint, reserved: bigint, requested: bigint, limit: bigint) {
  return used >= 0n && reserved >= 0n && requested > 0n && limit > 0n && used + reserved + requested <= limit;
}
