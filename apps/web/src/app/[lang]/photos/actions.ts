"use server";
import { ResubmissionError } from "@/server/services/resubmission";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { defaultLocale, isLocale, type SystemKey } from "@/i18n/messages";
import { localePath } from "@/i18n/routing";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { PhotoError, submitPhoto, reviewPhoto } from "@/server/services/photos";
import { DraftError } from "@/server/domain/drafts";
import { ArticleError } from "@/server/domain/articles";
function failure(error: unknown): SystemKey {
  if (error instanceof ResubmissionError) return error.key;
  return error instanceof PhotoError
    ? error.key
    : error instanceof DraftError
      ? error.notice
      : error instanceof ArticleError && typeof error.notice === "string"
        ? error.notice
        : "photoActionFailed";
}
function refresh() {
  for (const path of [
    "/[lang]/photos",
    "/[lang]/photos/mine",
    "/[lang]/admin/photo-reviews",
    "/[lang]/admin",
  ])
    revalidatePath(path, "page");
}
export async function submitPhotoAction(
  locale: unknown,
  _state: SystemKey | null,
  form: FormData,
): Promise<SystemKey | null> {
  try {
    const actor = await currentActor();
    await getDb().$transaction((tx) => submitPhoto(tx, actor, form));
  } catch (error) {
    return failure(error);
  }
  refresh();
  redirect(localePath(isLocale(locale) ? locale : defaultLocale, "/photos/mine?submitted=1"));
}
export async function reviewPhotoAction(
  id: string,
  version: number,
  _state: SystemKey | null,
  form: FormData,
): Promise<SystemKey | null> {
  try {
    if (typeof id !== "string" || id.length > 100 || !Number.isSafeInteger(version) || version < 1)
      throw new PhotoError("photoReviewConflict");
    const actor = await currentActor();
    await getDb().$transaction((tx) => reviewPhoto(tx, actor, id, version, form));
  } catch (error) {
    return failure(error);
  }
  refresh();
  return null;
}
