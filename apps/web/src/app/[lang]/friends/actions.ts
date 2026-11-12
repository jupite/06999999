"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { defaultLocale, isLocale, type SystemKey } from "@/i18n/messages";
import { localePath } from "@/i18n/routing";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { FriendError, submitFriend, reviewFriend } from "@/server/services/friends";
import { ArticleError } from "@/server/domain/articles";
function failure(error: unknown): SystemKey {
  return error instanceof FriendError
    ? error.key
    : error instanceof ArticleError && typeof error.notice === "string"
      ? error.notice
      : "friendActionFailed";
}
function refresh() {
  for (const path of [
    "/[lang]/friends",
    "/[lang]/friends/mine",
    "/[lang]/admin/friend-reviews",
    "/[lang]/admin",
  ])
    revalidatePath(path, "page");
}
export async function submitFriendAction(
  locale: unknown,
  _state: SystemKey | null,
  form: FormData,
): Promise<SystemKey | null> {
  try {
    const actor = await currentActor();
    await getDb().$transaction((tx) => submitFriend(tx, actor, form));
  } catch (error) {
    return failure(error);
  }
  refresh();
  redirect(localePath(isLocale(locale) ? locale : defaultLocale, "/friends/mine?submitted=1"));
}
export async function reviewFriendAction(
  id: string,
  version: number,
  _state: SystemKey | null,
  form: FormData,
): Promise<SystemKey | null> {
  try {
    if (typeof id !== "string" || id.length > 100 || !Number.isSafeInteger(version) || version < 1)
      throw new FriendError("friendReviewConflict");
    const actor = await currentActor();
    await getDb().$transaction((tx) => reviewFriend(tx, actor, id, version, form));
  } catch (error) {
    return failure(error);
  }
  refresh();
  return null;
}
