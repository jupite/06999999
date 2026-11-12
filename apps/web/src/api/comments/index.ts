import type { SystemKey } from "@/i18n/messages";
export type PublicComment = {
  id: string;
  body: string;
  createdAt: string;
  author: { name: string };
};
export type CommentPage = { comments: PublicComment[]; more: boolean; page: number };
export type CommentSubmission = { id: string; state: string };
export async function articleComments(
  slug: string,
  page: number,
  signal?: AbortSignal,
): Promise<CommentPage> {
  const response = await fetch(`/api/articles/${encodeURIComponent(slug)}/comments?page=${page}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw Error("Comment list unavailable");
  const result = await response.json();
  if (
    !Array.isArray(result.comments) ||
    typeof result.more !== "boolean" ||
    !Number.isSafeInteger(result.page)
  )
    throw Error("Invalid comment page");
  return result;
}
export async function postArticleComment(
  slug: string,
  id: string,
  body: string,
): Promise<CommentSubmission | { error: SystemKey }> {
  const response = await fetch(`/api/articles/${encodeURIComponent(slug)}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, body }),
  });
  const result = await response.json();
  if (!response.ok) return { error: result.error ?? "commentRequestFailed" };
  if (typeof result.id !== "string" || typeof result.state !== "string")
    throw Error("Invalid comment submission");
  return result;
}
