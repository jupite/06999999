"use client";

import { useState, useTransition } from "react";
import { setSiteLocale } from "@/i18n/actions";
import { useI18n } from "@/i18n/client";
import { isLocale, locales, type Locale } from "@/i18n/messages";
import { localePath } from "@/i18n/routing";

const labels: Record<Locale, string> = { zh: "简体中文", en: "English" };

export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <div className="language-switcher">
      <select
        aria-label={t("language")}
        value={locale}
        disabled={pending}
        onChange={(event) => {
          const selected = event.currentTarget.value;
          if (!isLocale(selected) || selected === locale) return;
          setFailed(false);
          startTransition(async () => {
            try {
              if (!(await setSiteLocale(selected))) {
                setFailed(true);
                return;
              }
              const { pathname, search, hash } = window.location;
              const path = pathname.slice(locale.length + 1);
              window.location.assign(`${localePath(selected, path)}${search}${hash}`);
            } catch {
              setFailed(true);
            }
          });
        }}
      >
        {locales.map((option) => (
          <option key={option} value={option} lang={option}>
            {labels[option]}
          </option>
        ))}
      </select>
      {failed && (
        <span className="language-error" role="alert">
          {t("localeFailed")}
        </span>
      )}
    </div>
  );
}
