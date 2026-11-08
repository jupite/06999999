import "server-only";
import { cookies } from "next/headers";
import { defaultLocale, getTranslator, isLocale, type Dictionary, type Locale } from "./messages";
import { getSystemTranslator } from "./system-messages";

export const localeCookie = "site-locale";

const dictionaries = {
  "zh-CN": () => import("./dictionaries/zh.json").then((module) => module.default),
  en: () => import("./dictionaries/en.json").then((module) => module.default),
} satisfies Record<Locale, () => Promise<Dictionary>>;

export async function getI18n() {
  const value = (await cookies()).get(localeCookie)?.value;
  const locale = isLocale(value) ? value : defaultLocale;
  const dictionary = await dictionaries[locale]();
  return {
    locale,
    dictionary,
    t: getTranslator(dictionary),
    system: getSystemTranslator(dictionary),
  };
}
