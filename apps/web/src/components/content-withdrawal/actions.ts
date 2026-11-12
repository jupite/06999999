"use server";
import { revalidatePath } from "next/cache";
import type { SystemKey } from "@/i18n/messages";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { withdrawOwnSubmission, WithdrawalError } from "@/server/services/withdrawal";
export async function withdrawSubmissionAction(
  id: unknown,
  version: unknown,
  kind: unknown,
  state: unknown,
  _previous: SystemKey | null,
  form: FormData,
): Promise<SystemKey | null> {
  try {
    if (form.get("confirm") !== "yes") throw new WithdrawalError("withdrawalConfirmationRequired");
    const actor = await currentActor();
    await getDb().$transaction((tx) => withdrawOwnSubmission(tx, actor, id, version, kind, state));
  } catch (error) {
    return error instanceof WithdrawalError ? error.key : "withdrawalFailed";
  }
  const section = kind === "PHOTO" ? "photos" : kind === "PROJECT" ? "projects" : "friends";
  const review =
    kind === "PHOTO" ? "photo-reviews" : kind === "PROJECT" ? "project-reviews" : "friend-reviews";
  for (const path of [
    `/[lang]/${section}`,
    `/[lang]/${section}/mine`,
    `/[lang]/admin/${review}`,
    "/[lang]/admin",
    "/[lang]/admin/audit",
  ])
    revalidatePath(path, "page");
  return null;
}
