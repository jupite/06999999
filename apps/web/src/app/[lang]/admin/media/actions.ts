"use server";

import { redirect } from "next/navigation";
import { defaultLocale, isLocale } from "@/i18n/messages";
import { localePath } from "@/i18n/routing";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { MediaError } from "@/server/domain/media";
import { authorize } from "@/server/domain/permissions";
import { isGithubId, saveMediaLimits, saveUserMediaAccess } from "@/server/services/media-settings";

export async function updateMediaSettings(locale: unknown, form: FormData) {
  const page = localePath(isLocale(locale) ? locale : defaultLocale, "/admin/media");
  const actor = await currentActor();
  if (!actor || !authorize(actor, "site.manage").allowed) redirect(page);

  const githubId = form.get("githubId");
  const query = new URLSearchParams();
  if (isGithubId(githubId)) query.set("githubId", githubId);
  try {
    const scope = form.get("scope");
    if (scope === "site") await saveMediaLimits(getDb(), actor, form);
    else if (scope === "user" && isGithubId(githubId)) {
      await saveUserMediaAccess(getDb(), actor, githubId, form);
    } else throw new MediaError("mediaUserMissing");
    query.set("result", "saved");
  } catch (error) {
    query.set("result", error instanceof MediaError ? error.key : "mediaSettingsFailed");
  }
  redirect(`${page}?${query}`);
}
