import type chinese from "./dictionaries/zh.json";
import type english from "./dictionaries/en.json";

export const locales = ["zh", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "zh";

export type MessageKey = keyof typeof chinese.messages | keyof typeof english.messages;
export type SystemKey = keyof typeof chinese.system | keyof typeof english.system;

export type Dictionary = {
  messages: Record<MessageKey, string>;
  system: Record<SystemKey, string>;
};

export function isLocale(value: unknown): value is Locale {
  return locales.some((locale) => locale === value);
}

type Values = Record<string, string | number>;

export function getTranslator(dictionary: Dictionary) {
  return (key: MessageKey, values: Values = {}) =>
    dictionary.messages[key].replace(/\{(\w+)\}/g, (match, name: string) =>
      Object.hasOwn(values, name) ? String(values[name]) : match,
    );
}
