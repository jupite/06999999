"use server";

import { redirect } from "next/navigation";
import { defaultLocale, isLocale } from "@/i18n/messages";
import { localePath } from "@/i18n/routing";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { authorize } from "@/server/domain/permissions";
import { updateUserAccess, UserAccessError } from "@/server/services/user-access";

export async function saveUserAccess(locale: unknown, id: unknown, form: FormData) {
  const base = localePath(isLocale(locale) ? locale : defaultLocale, "/admin/users");
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) redirect(base);
  const page = `${base}/${id}`;
  const actor = await currentActor();
  if (!authorize(actor, "site.manage").allowed) redirect(page);

  let result = "saved";
  try {
    await getDb().$transaction((tx) =>
      updateUserAccess(tx, actor, id, process.env.OWNER_GITHUB_ID, form),
    );
  } catch (error) {
    result = error instanceof UserAccessError ? error.key : "userAccessSaveFailed";
  }
  redirect(`${page}?result=${result}`);
}
