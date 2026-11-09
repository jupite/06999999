import "server-only";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { getTranslator, isLocale, type Dictionary, type Locale } from "./messages";
import { getSystemTranslator } from "./system-messages";

const dictionaries = {
  zh: () => import("./dictionaries/zh.json").then((module) => module.default),
  en: () => import("./dictionaries/en.json").then((module) => module.default),
} satisfies Record<Locale, () => Promise<Dictionary>>;

export async function getI18n() {
  const locale = await lang();
  if (!isLocale(locale)) notFound();
  const dictionary = await dictionaries[locale]();
  return {
    locale,
    dictionary,
    t: getTranslator(dictionary),
    system: getSystemTranslator(dictionary),
  };
}
