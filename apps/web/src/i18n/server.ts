import "server-only";
import { cookies } from "next/headers";
import { defaultLocale, getTranslator, isLocale } from "./messages";
import { translateSystemMessage } from "./system-messages";

export const localeCookie = "site-locale";

export async function getI18n() {
  const value = (await cookies()).get(localeCookie)?.value;
  const locale = isLocale(value) ? value : defaultLocale;
  return {
    locale,
    t: getTranslator(locale),
    system: (message: string) => translateSystemMessage(locale, message),
  };
}
