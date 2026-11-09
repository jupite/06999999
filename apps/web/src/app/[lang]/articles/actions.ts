"use server";
import { revalidatePath } from "next/cache";
import { locales } from "@/i18n/messages";
import { localePath } from "@/i18n/routing";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { ArticleError } from "@/server/domain/articles";
import { DraftError } from "@/server/domain/drafts";
import { MediaError } from "@/server/domain/media";
import {
  submitArticle,
  submitArticleEdit,
  reviewArticle,
  copyRejectedArticle,
  deletePublishedArticle,
} from "@/server/services/articles";

function refreshArticles(slug?: string) {
  for (const path of ["/drafts", "/my-articles", "/articles", "/admin/reviews"])
    revalidatePath(`/[lang]${path}`, "page");
  revalidatePath("/[lang]/my-articles/[id]", "page");
  revalidatePath("/[lang]/admin/reviews/[id]", "page");
  if (slug) {
    for (const locale of locales) revalidatePath(localePath(locale, `/articles/${slug}`));
  }
}
function failure(error: unknown) {
  return {
    ok: false as const,
    error:
      error instanceof MediaError
        ? error.key
        : error instanceof ArticleError || error instanceof DraftError
          ? error.notice
          : ("articleActionFailed" as const),
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
export async function submitArticleEditAction(input: unknown) {
  try {
    const actor = await currentActor();
    const result = await getDb().$transaction((tx) => submitArticleEdit(tx, actor, input));
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

export async function deletePublishedArticleAction(id: unknown, version: unknown) {
  try {
    const actor = await currentActor();
    const result = await getDb().$transaction((tx) =>
      deletePublishedArticle(tx, actor, id, version),
    );
    refreshArticles(result.slug);
    return { ok: true as const };
  } catch (error) {
    return failure(error);
  }
}
