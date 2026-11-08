"use server";
import { revalidatePath } from "next/cache";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { ArticleError } from "@/server/domain/articles";
import { DraftError } from "@/server/domain/drafts";
import { submitArticle, reviewArticle, copyRejectedArticle } from "@/server/services/articles";

function refreshArticles(slug?: string) {
  for (const path of ["/drafts", "/my-articles", "/articles", "/admin/reviews"])
    revalidatePath(path);
  revalidatePath("/my-articles/[id]", "page");
  revalidatePath("/admin/reviews/[id]", "page");
  if (slug) revalidatePath(`/articles/${slug}`);
}
function failure(error: unknown) {
  return {
    ok: false as const,
    error:
      error instanceof ArticleError || error instanceof DraftError
        ? error.message
        : "操作失败，请稍后重试。",
  };
}
export async function submitArticleAction(id: unknown, version: unknown) {
  try {
    const actor = await currentActor();
    const result = await getDb().$transaction((tx) => submitArticle(tx, actor, id, version));
    refreshArticles(result.slug);
    return { ok: true as const, ...result };
  } catch (error) {
    return failure(error);
  }
}
export async function reviewArticleAction(
  id: unknown,
  version: unknown,
  decision: unknown,
  reason: unknown,
) {
  try {
    const actor = await currentActor();
    const result = await getDb().$transaction((tx) =>
      reviewArticle(tx, actor, id, version, decision, reason),
    );
    refreshArticles(result.slug);
    return { ok: true as const, ...result };
  } catch (error) {
    return failure(error);
  }
}
export async function copyRejectedArticleAction(id: unknown, version: unknown) {
  try {
    const actor = await currentActor();
    const draft = await getDb().$transaction((tx) => copyRejectedArticle(tx, actor, id, version));
    refreshArticles();
    return { ok: true as const, id: draft.id };
  } catch (error) {
    return failure(error);
  }
}
