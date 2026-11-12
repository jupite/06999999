"use client";
import { LocaleLink } from "@/i18n/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { savePermissionRole, removePermissionRole } from "@/api";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/routing";
import type { SystemKey } from "@/i18n/messages";
import { editableCapabilities } from "@/server/domain/permissions";
import { roleModes, type PermissionRole, type RoleRules } from "@/server/domain/roles";
import { capabilityLabels } from "@/app/[lang]/admin/users/labels";
const modeLabels = {
  inherit: "permissionInherit",
  allow: "permissionAllow",
  deny: "permissionDeny",
} as const;
const defaults = () =>
  Object.fromEntries(editableCapabilities.map((key) => [key, "inherit"])) as RoleRules;
export function RoleEditor({ role }: { role?: PermissionRole }) {
  const { locale, t, notice } = useI18n(),
    router = useRouter();
  const [name, setName] = useState(role?.name ?? ""),
    [permissions, setPermissions] = useState<RoleRules>(role?.permissions ?? defaults());
  const [pending, setPending] = useState(false),
    [error, setError] = useState<SystemKey | null>(null),
    [saved, setSaved] = useState(false),
    [deleting, setDeleting] = useState(false);
  useEffect(() => {
    setName(role?.name ?? "");
    setPermissions(role?.permissions ?? defaults());
    setDeleting(false);
  }, [role?.id, role?.version]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const result = await savePermissionRole(role?.id ?? null, {
        name,
        permissions,
        ...(role ? { expectedVersion: role.version } : {}),
      });
      if ("error" in result) {
        setError(result.error);
        if (result.error === "roleConflict") router.refresh();
      } else {
        setSaved(true);
        if (!role) router.push(localePath(locale, `/admin/roles/${result.id}`));
        else router.refresh();
      }
    } catch {
      setError("roleRequestFailed");
    } finally {
      setPending(false);
    }
  }
  async function remove() {
    if (!role || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await removePermissionRole(role.id, role.version);
      if ("error" in result) {
        setError(result.error);
        router.refresh();
      } else {
        router.push(localePath(locale, "/admin/roles"));
        router.refresh();
      }
    } catch {
      setError("roleRequestFailed");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel draft-card">
      <form onSubmit={save}>
        <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <label className="draft-title">
            {t("roleName")}
            <input
              name="roleName"
              required
              maxLength={64}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="access-settings">
            {editableCapabilities.map((key) => (
              <label className="access-setting draft-title" key={key}>
                {t(capabilityLabels[key])}
                <select
                  name={key}
                  value={permissions[key]}
                  onChange={(event) =>
                    setPermissions({
                      ...permissions,
                      [key]: event.target.value as RoleRules[typeof key],
                    })
                  }
                >
                  {roleModes.map((mode) => (
                    <option key={mode} value={mode}>
                      {t(modeLabels[mode])}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button className="button" disabled={!name.trim()}>
            {t(pending ? "processing" : "roleSave")}
          </button>
        </fieldset>
      </form>
      {role && (
        <div>
          {role.userCount > 0 ? (
            <>
              <p>{t("roleAssignedCount", { count: role.userCount })}</p>
              <LocaleLink href={`/admin/users?roleId=${role.id}`} className="button secondary">
                {t("roleViewUsers")}
              </LocaleLink>
            </>
          ) : deleting ? (
            <div className="draft-actions">
              <p>{t("roleDeleteConfirm", { name: role.name })}</p>
              <button
                type="button"
                className="button secondary"
                disabled={pending}
                onClick={remove}
              >
                {t("roleDelete")}
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={pending}
                onClick={() => setDeleting(false)}
              >
                {t("withdrawalCancel")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="button secondary"
              disabled={pending}
              onClick={() => setDeleting(true)}
            >
              {t("roleDelete")}
            </button>
          )}
        </div>
      )}
      {error && <p role="alert">{notice({ system: error })}</p>}
      {saved && <p role="status">{t("roleSaved")}</p>}
    </section>
  );
}
