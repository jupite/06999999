import type { SystemKey } from "@/i18n/messages";
export type ArticleLikeState = { count: number; liked: boolean };
export async function articleLike(
  slug: string,
  method: "GET" | "PUT" | "DELETE" = "GET",
  signal?: AbortSignal,
  content: "articles" | "projects" = "articles",
): Promise<ArticleLikeState | { error: SystemKey }> {
  const response = await fetch(`/api/${content}/${encodeURIComponent(slug)}/like`, {
    method,
    cache: "no-store",
    signal,
  });
  const result = await response.json();
  if (!response.ok)
    return {
      error:
        response.status === 401
          ? "loginRequired"
          : response.status === 403
            ? "permissionDenied"
            : response.status === 404
              ? content === "articles"
                ? "likeArticleMissing"
                : "likeProjectMissing"
              : "likeRequestFailed",
    };
  if (!Number.isSafeInteger(result.count) || result.count < 0 || typeof result.liked !== "boolean")
    throw Error("Invalid like response");
  return result;
}
