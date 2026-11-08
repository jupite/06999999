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
export const articleStateLabels = {
  DRAFT: "draftState",
  PENDING_AI: "pendingAIState",
  PENDING_HUMAN: "pendingHumanState",
  PUBLISHED: "publishedState",
  REJECTED: "rejectedState",
  WITHDRAWN: "withdrawnState",
} as const;

export const articleFilters = {
  all: "allFilter",
  draft: "draftFilter",
  pending: "pendingFilter",
  published: "publishedFilter",
  rejected: "rejectedFilter",
} as const;
export type ArticleFilter = keyof typeof articleFilters;
export function articleFilter(value: unknown): ArticleFilter {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(articleFilters, value)
    ? (value as ArticleFilter)
    : "all";
}
