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
    return { ok: true as const, draft };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof DraftError
          ? error.message
          : "保存失败，请稍后重试；当前输入仍保留在页面中。",
    };
  }
}
export async function deleteDraftAction(id: unknown, version: unknown) {
  try {
    const actor = await currentActor();
    await getDb().$transaction((tx) => deleteDraft(tx, actor, id, version));
    revalidatePath("/drafts");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof DraftError ? error.message : "删除失败，请稍后重试。",
    };
  }
}
