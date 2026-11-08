"use server";

import { revalidatePath } from "next/cache";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { DraftError } from "@/server/domain/drafts";
import { saveDraft, deleteDraft } from "@/server/services/drafts";

export async function saveDraftAction(input: unknown) {
  try {
    const actor = await currentActor();
    const draft = await getDb().$transaction((tx) => saveDraft(tx, actor, input));
    revalidatePath("/drafts");
    revalidatePath("/my-articles");
    return { ok: true as const, draft };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof DraftError ? error.notice : ("draftSaveFailed" as const),
    };
  }
}
export async function deleteDraftAction(id: unknown, version: unknown) {
  try {
    const actor = await currentActor();
    await getDb().$transaction((tx) => deleteDraft(tx, actor, id, version));
    revalidatePath("/drafts");
    revalidatePath("/my-articles");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof DraftError ? error.notice : ("draftDeleteFailed" as const),
    };
  }
}
