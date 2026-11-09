"use server";

import { redirect } from "next/navigation";
import { defaultLocale, isLocale } from "@/i18n/messages";
import { localePath } from "@/i18n/routing";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { DraftError } from "@/server/domain/drafts";
import { authorize } from "@/server/domain/permissions";
import { createArticleCategory } from "@/server/services/article-taxonomy";

export async function createCategoryAction(locale: unknown, form: FormData) {
  const page = localePath(isLocale(locale) ? locale : defaultLocale, "/admin/categories");
  const actor = await currentActor();
  if (!authorize(actor, "site.manage").allowed) redirect(page);

  let result = "saved";
  try {
    await getDb().$transaction((tx) => createArticleCategory(tx, actor, form.get("name")));
  } catch (error) {
    result = error instanceof DraftError ? error.notice : "categorySaveFailed";
  }
  redirect(`${page}?result=${result}`);
}
