"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { setUserRole } from "@/api";
import { useI18n } from "@/i18n/client";
import type { SystemKey } from "@/i18n/messages";
export function UserRoleForm({
  userId,
  currentRoleId,
  roles,
}: {
  userId: string;
  currentRoleId: string | null;
  roles: { id: string; name: string }[];
}) {
  const { t, notice } = useI18n(),
    router = useRouter();
  const [roleId, setRoleId] = useState(currentRoleId ?? ""),
    [pending, setPending] = useState(false),
    [error, setError] = useState<SystemKey | null>(null),
    [saved, setSaved] = useState(false);
  useEffect(() => setRoleId(currentRoleId ?? ""), [currentRoleId]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const result = await setUserRole(userId, roleId || null, currentRoleId);
      if ("error" in result) {
        setError(result.error);
        if (result.error === "roleAssignmentConflict") router.refresh();
      } else {
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError("roleRequestFailed");
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={save}>
      <label className="draft-title">
        {t("userAssignedRole")}
        <select
          name="assignedRole"
          value={roleId}
          disabled={pending}
          onChange={(event) => setRoleId(event.target.value)}
        >
          <option value="">{t("roleNone")}</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </label>
      <button className="button secondary" disabled={pending}>
        {t(pending ? "processing" : "roleAssignSave")}
      </button>
      {error && <p role="alert">{notice({ system: error })}</p>}
      {saved && <p role="status">{t("roleSaved")}</p>}
    </form>
  );
}
