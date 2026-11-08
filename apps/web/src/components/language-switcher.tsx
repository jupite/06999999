"use client";

import { useState, useTransition } from "react";
import { setSiteLocale } from "@/i18n/actions";
import { useI18n } from "@/i18n/client";
import { locales, type Locale } from "@/i18n/messages";

const labels: Record<Locale, string> = { "zh-CN": "简体中文", en: "English" };

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
          setFailed(false);
          startTransition(async () => {
            try {
              setFailed(!(await setSiteLocale(selected)));
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
