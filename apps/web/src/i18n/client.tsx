"use client";

import { createContext, useContext, type ReactNode } from "react";
import { defaultLocale, getTranslator, type Locale, type MessageKey } from "./messages";
import { translateSystemMessage } from "./system-messages";

const LocaleContext = createContext<Locale>(defaultLocale);
export type Notice = MessageKey | { system: string };

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const locale = useContext(LocaleContext);
  const t = getTranslator(locale);
  return {
    locale,
    t,
    notice: (value: Notice) =>
      typeof value === "string" ? t(value) : translateSystemMessage(locale, value.system),
  };
}
