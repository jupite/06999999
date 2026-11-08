export class ArticleError extends Error {}
export function articleReference(id: unknown, version: unknown) {
  if (
    typeof id !== "string" ||
    !id ||
    id.length > 100 ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 1
  )
    throw new ArticleError("文章编号或版本无效。");
  return { id, version };
}
export function reviewInput(decision: unknown, reason: unknown) {
  if (decision !== "approve" && decision !== "reject") throw new ArticleError("审核操作无效。");
  if (typeof reason !== "string" || reason.trim().length > 2000)
    throw new ArticleError("审核说明不能超过 2000 字。");
  if (decision === "reject" && !reason.trim())
    throw new ArticleError("请填写拒绝原因，帮助作者修改。");
  return { decision, reason: reason.trim() };
}
export function articlePage(value: unknown) {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : 1;
  return Number.isSafeInteger(n) && n > 0 && n <= 100000 ? n : 1;
}
export const articleStateLabels: Record<string, string> = {
  DRAFT: "草稿",
  PENDING_AI: "等待 AI 审核",
  PENDING_HUMAN: "等待人工审核",
  PUBLISHED: "已发布",
  REJECTED: "已拒绝",
  WITHDRAWN: "已撤回",
};

export const articleFilters = {
  all: "全部",
  draft: "草稿",
  pending: "待审核",
  published: "已发布",
  rejected: "已拒绝",
} as const;
export type ArticleFilter = keyof typeof articleFilters;
export function articleFilter(value: unknown): ArticleFilter {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(articleFilters, value)
    ? (value as ArticleFilter)
    : "all";
}
