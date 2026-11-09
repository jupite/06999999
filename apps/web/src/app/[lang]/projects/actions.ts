"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { defaultLocale, isLocale } from "@/i18n/messages";
import { localePath } from "@/i18n/routing";
import type { SystemNotice } from "@/i18n/system-messages";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { ArticleError } from "@/server/domain/articles";
import { ProjectError, reviewProject, submitProject } from "@/server/services/projects";

function refreshProjectPages() {
  for (const path of ["/[lang]/projects", "/[lang]/projects/mine", "/[lang]/admin/project-reviews"])
    revalidatePath(path, "page");
}

function projectFailure(error: unknown) {
  return error instanceof ProjectError || error instanceof ArticleError
    ? error.notice
    : ("projectActionFailed" as const);
}

export async function submitProjectAction(
  locale: unknown,
  _state: SystemNotice | null,
  form: FormData,
): Promise<SystemNotice | null> {
  try {
    const actor = await currentActor();
    if (!actor) return "loginRequired";
    await getDb().$transaction((tx) => submitProject(tx, actor, form));
  } catch (error) {
    return projectFailure(error);
  }
  refreshProjectPages();
  redirect(localePath(isLocale(locale) ? locale : defaultLocale, "/projects/mine?submitted=1"));
}

export async function reviewProjectAction(
  locale: unknown,
  id: unknown,
  version: unknown,
  _state: SystemNotice | null,
  form: FormData,
): Promise<SystemNotice | null> {
  try {
    const actor = await currentActor();
    if (!actor) return "loginRequired";
    await getDb().$transaction((tx) => reviewProject(tx, actor, id, version, form));
  } catch (error) {
    return projectFailure(error);
  }
  refreshProjectPages();
  redirect(localePath(isLocale(locale) ? locale : defaultLocale, "/admin/project-reviews"));
}
