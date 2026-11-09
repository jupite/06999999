"use client";

import { useActionState, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { MessageKey } from "@/i18n/messages";
import { maxProjectUrlLength } from "@/server/domain/project-sites";
import { testProjectSite } from "./actions";

const results = {
  allowed: "projectUrlAllowed",
  denied: "projectUrlDenied",
  unmatched: "projectUrlUnmatched",
  invalid: "projectUrlInvalid",
  unavailable: "projectUrlCheckUnavailable",
} satisfies Record<string, MessageKey>;

export function SiteChecker() {
  const { t } = useI18n();
  const [result, action, pending] = useActionState(testProjectSite, null);
  const [url, setUrl] = useState("");

  return (
    <form className="panel draft-card" action={action}>
      <h2>{t("testProjectWebsite")}</h2>
      <label className="draft-title">
        {t("projectWebsiteUrl")}
        <input
          name="url"
          type="url"
          maxLength={maxProjectUrlLength}
          required
          placeholder="https://example.com/project"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </label>
      <button type="submit" className="button secondary" disabled={pending}>
        {t(pending ? "checkingProjectWebsite" : "testProjectWebsite")}
      </button>
      {result && <p role="status">{t(results[result])}</p>}
    </form>
  );
}
