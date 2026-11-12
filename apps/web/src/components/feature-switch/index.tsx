"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateFeatureFlag } from "@/api";
import { useI18n } from "@/i18n/client";
import type { FeatureKey } from "@/server/domain/features";
import type { SystemKey } from "@/i18n/messages";
export function FeatureSwitch({ feature }: { feature: { key: FeatureKey; enabled: boolean } }) {
  const { t, notice } = useI18n(),
    router = useRouter();
  const [enabled, setEnabled] = useState(feature.enabled),
    [pending, setPending] = useState(false),
    [error, setError] = useState<SystemKey | null>(null),
    [saved, setSaved] = useState(false);
  useEffect(() => setEnabled(feature.enabled), [feature.enabled]);
  async function toggle() {
    if (pending) return;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateFeatureFlag(feature.key, !enabled, enabled);
      if ("error" in result) {
        setError(result.error);
        if (result.error === "featureConflict") router.refresh();
      } else {
        setEnabled(result.enabled);
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError("featureRequestFailed");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={feature.key}
        className={enabled ? "button" : "button secondary"}
        disabled={pending}
        onClick={toggle}
      >
        {t(pending ? "processing" : enabled ? "featureOn" : "featureOff")}
      </button>
      {error && <p role="alert">{notice({ system: error })}</p>}
      {saved && <small role="status">{t("featureSaved")}</small>}
    </div>
  );
}
