import type { Locale } from "./messages";

export const localeCookie = "site-locale";

export function localePath(locale: Locale, path: string = "/") {
  return `/${locale}${path === "/" ? "" : path}`;
}
