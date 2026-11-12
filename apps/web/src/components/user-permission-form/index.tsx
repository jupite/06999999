"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { setUserPermissionOverride } from "@/api";
import { useI18n } from "@/i18n/client";
import type { SystemKey } from "@/i18n/messages";
import type { EditableCapability } from "@/server/domain/permissions";
import { roleModes, type RoleMode } from "@/server/domain/roles";
const labels = {
  inherit: "permissionInherit",
  allow: "permissionAllow",
  deny: "permissionDeny",
} as const;
export function UserPermissionForm({
  userId,
  capability,
  initialMode,
  label,
  roleMode,
  allowed,
  reason,
  quotaUnavailable,
}: {
  userId: string;
  capability: EditableCapability;
  initialMode: RoleMode;
  label: string;
  roleMode: RoleMode;
  allowed: boolean;
  reason: SystemKey;
  quotaUnavailable: boolean;
}) {
  const { t, notice } = useI18n(),
    router = useRouter();
  const [mode, setMode] = useState(initialMode),
    [expected, setExpected] = useState(initialMode),
    [effective, setEffective] = useState({ allowed, reason }),
    [pending, setPending] = useState(false),
    [error, setError] = useState<SystemKey | null>(null),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    setMode(initialMode);
    setExpected(initialMode);
    setEffective({ allowed, reason });
  }, [initialMode, allowed, reason]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const result = await setUserPermissionOverride(userId, capability, mode, expected);
      if ("error" in result) {
        setError(result.error);
        if (result.error === "userAccessConflict") router.refresh();
      } else {
        setExpected(result.userOverride);
        setMode(result.userOverride);
        setEffective({ allowed: result.allowed, reason: result.reason });
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError("userAccessSaveFailed");
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="access-setting" data-capability={capability} onSubmit={save}>
      <label className="draft-title">
        {label}
        <select
          name="permissionMode"
          value={mode}
          disabled={pending}
          onChange={(event) => {
            setMode(event.target.value as RoleMode);
            setSaved(false);
          }}
        >
          {roleModes.map((value) => (
            <option key={value} value={value}>
              {t(labels[value])}
            </option>
          ))}
        </select>
      </label>
      <p>
        {t(effective.allowed ? "permissionEffectiveAllow" : "permissionEffectiveDeny")} ·{" "}
        {notice({ system: effective.reason })}
      </p>
      <p className="muted">{t("roleRuleLabel", { mode: t(labels[roleMode]) })}</p>
      {quotaUnavailable && effective.allowed && (
        <p className="muted">{t("userImageQuotaUnavailable")}</p>
      )}
      <button className="button secondary" disabled={pending}>
        {t(pending ? "processing" : "saveUserSetting")}
      </button>
      {saved && <p role="status">{t("userAccessSaved")}</p>}
      {error && <p role="alert">{notice({ system: error })}</p>}
    </form>
  );
}
