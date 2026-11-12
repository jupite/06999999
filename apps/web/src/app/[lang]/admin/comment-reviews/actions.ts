"use server";
import type { SystemKey } from "@/i18n/messages";
import { revalidatePath } from "next/cache";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { CommentError, reviewArticleComment } from "@/server/services/comments";
export async function reviewCommentAction(
  id: string,
  version: number,
  _previous: SystemKey | null,
  form: FormData,
): Promise<SystemKey | null> {
  try {
    if (typeof id !== "string" || id.length > 100 || !Number.isSafeInteger(version) || version < 1)
      throw new CommentError("commentReviewConflict");
    const actor = await currentActor();
    const result = await getDb().$transaction((tx) =>
      reviewArticleComment(tx, actor, id, version, form.get("decision"), form.get("reason")),
    );
    revalidatePath("/[lang]/admin/comment-reviews", "page");
    revalidatePath(`/[lang]/articles/${result.slug}`, "page");
    return null;
  } catch (error) {
    return error instanceof CommentError ? error.key : "commentRequestFailed";
  }
}
