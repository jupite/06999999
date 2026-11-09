"use server";

import { redirect } from "next/navigation";
import { defaultLocale, isLocale } from "@/i18n/messages";
import { localePath } from "@/i18n/routing";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { authorize } from "@/server/domain/permissions";
import type { ProjectUrlDecision } from "@/server/domain/project-sites";
import {
  checkProjectWebsite,
  ProjectSiteError,
  saveProjectSiteRule,
} from "@/server/services/project-sites";

type ProbeResult = ProjectUrlDecision | "unavailable" | null;

export async function testProjectSite(
  _previous: ProbeResult,
  form: FormData,
): Promise<ProbeResult> {
  const actor = await currentActor();
  if (!authorize(actor, "site.manage").allowed) return "unavailable";
  try {
    return await checkProjectWebsite(getDb(), form.get("url"));
  } catch {
    return "unavailable";
  }
}

export async function updateProjectSite(locale: unknown, form: FormData) {
  const page = localePath(isLocale(locale) ? locale : defaultLocale, "/admin/project-sites");
  const actor = await currentActor();
  if (!authorize(actor, "site.manage").allowed) redirect(page);

  let result = "saved";
  try {
    await getDb().$transaction((tx) => saveProjectSiteRule(tx, actor, form));
  } catch (error) {
    result = error instanceof ProjectSiteError ? error.key : "projectRuleSaveFailed";
  }
  redirect(`${page}?result=${result}`);
}
