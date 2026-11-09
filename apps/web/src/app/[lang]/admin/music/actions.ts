"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { defaultLocale, isLocale } from "@/i18n/messages";
import { localePath } from "@/i18n/routing";
import { musicIdPattern, parseMusicSource } from "@/music/source";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { authorize } from "@/server/domain/permissions";
import { musicConfigured, musicQueue } from "@/server/services/music";
import { addLibraryTracks, removeLibraryTrack } from "@/server/services/music-library";

function adminMusicPath(locale: unknown) {
  return localePath(isLocale(locale) ? locale : defaultLocale, "/admin/music");
}

export async function importMusic(locale: unknown, form: FormData) {
  const path = adminMusicPath(locale);
  const actor = await currentActor();
  if (!actor || !authorize(actor, "site.manage").allowed) redirect(path);
  const link = form.get("url");
  const source = typeof link === "string" ? parseMusicSource(link) : null;
  if (!source) redirect(`${path}?result=musicInvalidLink`);
  if (!musicConfigured()) redirect(`${path}?result=musicServiceUnavailable`);

  const tracks = await musicQueue(source).catch(() => null);
  if (!tracks) redirect(`${path}?result=musicLookupFailed`);
  if (!tracks.length) redirect(`${path}?result=musicNoTracks`);
  let added: number;
  try {
    const db = getDb();
    added = await db.$transaction((tx) => addLibraryTracks(tx, actor.id, tracks));
  } catch {
    redirect(`${path}?result=musicSaveFailed`);
  }
  revalidatePath("/[lang]/music", "page");
  redirect(`${path}?result=${added ? "musicImported" : "musicAlreadyImported"}`);
}

export async function removeMusic(locale: unknown, form: FormData) {
  const path = adminMusicPath(locale);
  const actor = await currentActor();
  if (!actor || !authorize(actor, "site.manage").allowed) redirect(path);
  const id = form.get("id");
  if (typeof id !== "string" || !musicIdPattern.test(id))
    redirect(`${path}?result=musicSaveFailed`);
  try {
    const db = getDb();
    await db.$transaction((tx) => removeLibraryTrack(tx, actor.id, id));
  } catch {
    redirect(`${path}?result=musicSaveFailed`);
  }
  revalidatePath("/[lang]/music", "page");
  redirect(`${path}?result=musicRemoved`);
}
