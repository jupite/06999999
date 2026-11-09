"use server";

import { cookies } from "next/headers";
import { isLocale } from "./messages";
import { localeCookie } from "./routing";

export async function setSiteLocale(locale: unknown) {
  if (!isLocale(locale)) return false;
  (await cookies()).set(localeCookie, locale, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return true;
}
