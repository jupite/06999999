"use client";

import { createContext, useContext, type ReactNode } from "react";
import { getTranslator, type Dictionary, type Locale, type MessageKey } from "./messages";
import { getSystemTranslator, type SystemNotice } from "./system-messages";

type LocaleData = { locale: Locale; dictionary: Dictionary };
const LocaleContext = createContext<LocaleData | null>(null);
export type Notice = MessageKey | { system: SystemNotice };

export function LocaleProvider({
  locale,
  dictionary,
  children,
}: LocaleData & { children: ReactNode }) {
  return <LocaleContext.Provider value={{ locale, dictionary }}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const data = useContext(LocaleContext);
  if (!data) throw new Error("useI18n requires a LocaleProvider");
  const { locale, dictionary } = data;
  const t = getTranslator(dictionary);
  const system = getSystemTranslator(dictionary);
  return {
    locale,
    t,
    notice: (value: Notice) => (typeof value === "string" ? t(value) : system(value.system)),
  };
}
