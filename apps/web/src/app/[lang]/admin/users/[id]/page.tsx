import { notFound } from "next/navigation";
import { ArticleAccessNotice, ArticleTime } from "@/components/server";
import type { Prisma } from "@/generated/prisma/client";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import {
  accountActor,
  authorize,
  editableCapabilities,
  isEditableCapability,
  isPermissionMode,
  permissionModes,
} from "@/server/domain/permissions";
import { readUserAccount } from "@/server/services/user-access";
import { capabilityLabels, permissionModeLabels } from "../labels";
import { saveUserAccess } from "./actions";

export const dynamic = "force-dynamic";

function auditField(value: Prisma.JsonValue, key: string) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value[key]
    : undefined;
}

export default async function UserAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const { locale, t, system } = await getI18n();
  const manager = await currentActor();
  const access = authorize(manager, "site.manage");
  if (!access.allowed)
    return <ArticleAccessNotice signedIn={!!manager} reason={system(access.reason)} />;

  const { id } = await params;
  const data = await readUserAccount(getDb(), manager, id);
  if (!data) notFound();
  const { user, audit, operators } = data;
  const ownerGithubId = process.env.OWNER_GITHUB_ID;
  const account = accountActor(user, ownerGithubId);
  const action = saveUserAccess.bind(null, locale, id);
  const bytes = new Intl.NumberFormat(locale, { style: "unit", unit: "byte" });
  const used = user.quota?.usedBytes ?? 0n;
  const limit = user.quota?.limitBytes ?? 0n;
  const reserved = user.quota?.reservedBytes ?? 0n;
  const status = user.banned ? "banned" : "active";
  const { result } = await searchParams;
  const error =
    result === "invalidUserAccess" ||
    result === "ownerAccountProtected" ||
    result === "userAccessConflict" ||
    result === "userAccessSaveFailed"
      ? system(result)
      : null;

  const statusLabel = (banned: unknown) => t(banned === true ? "bannedUser" : "activeUser");
  const modeLabel = (effect: unknown) =>
    t(permissionModeLabels[isPermissionMode(effect) ? effect : "inherit"]);
  function auditValue(value: Prisma.JsonValue, actionName: string) {
    if (actionName === "user.updateBan") return statusLabel(auditField(value, "banned"));
    const mode = modeLabel(auditField(value, "effect"));
    if (actionName !== "media.updateUserAccess") return mode;
    const quota = auditField(value, "limitBytes");
    return typeof quota === "string" && /^\d+$/.test(quota)
      ? `${mode} · ${bytes.format(BigInt(quota))}`
      : mode;
  }

  return (
    <>
      <LocaleLink href="/admin/users">{t("backToUsers")}</LocaleLink>
      <div className="page-heading">
        <h1>{user.name}</h1>
        <p>
          {t(user.githubId.startsWith("local:") ? "localAccountName" : "userGithubId", {
            id: user.githubId.replace(/^local:/, ""),
          })}
        </p>
      </div>
      {result === "saved" && <p role="status">{t("userAccessSaved")}</p>}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <div className="draft-list">
        <section className="panel draft-card">
          <h2>{t("userStatus")}</h2>
          <p>{statusLabel(user.banned)}</p>
          {account.role === "OWNER" || manager?.id === user.id ? (
            <p className="muted">{system("ownerAccountProtected")}</p>
          ) : (
            <form action={action}>
              <input type="hidden" name="scope" value="account" />
              <input type="hidden" name="expected" value={status} />
              <input type="hidden" name="value" value={user.banned ? "active" : "banned"} />
              <button type="submit" className="button secondary">
                {t(user.banned ? "unbanUser" : "banUser")}
              </button>
            </form>
          )}
          <p>{t("userImageUsage", { used: bytes.format(used), limit: bytes.format(limit) })}</p>
          <LocaleLink
            className="button secondary"
            href={`/admin/media?githubId=${encodeURIComponent(user.githubId)}`}
          >
            {t("editUserQuota")}
          </LocaleLink>
        </section>
        <section className="panel draft-card">
          <h2>{t("userCapability")}</h2>
          <p>{t("userPermissionHelp")}</p>
          <div className="access-settings">
            {editableCapabilities.map((capability) => {
              const current = account.overrides[capability] ?? "inherit";
              const effective = authorize(account, capability);
              return (
                <form className="access-setting" action={action} key={`${capability}:${current}`}>
                  <input type="hidden" name="scope" value="permission" />
                  <input type="hidden" name="capability" value={capability} />
                  <input type="hidden" name="expected" value={current} />
                  <label className="draft-title">
                    {t(capabilityLabels[capability])}
                    <select name="value" defaultValue={current}>
                      {permissionModes.map((mode) => (
                        <option key={mode} value={mode}>
                          {t(permissionModeLabels[mode])}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    {t(effective.allowed ? "permissionEffectiveAllow" : "permissionEffectiveDeny")}{" "}
                    · {system(effective.reason)}
                  </p>
                  {capability === "image.upload" &&
                    effective.allowed &&
                    used + reserved >= limit && (
                      <p className="muted">{t("userImageQuotaUnavailable")}</p>
                    )}
                  <button type="submit" className="button secondary">
                    {t("saveUserSetting")}
                  </button>
                </form>
              );
            })}
          </div>
        </section>
        <section className="panel draft-card">
          <h2>{t("userAuditLog")}</h2>
          {audit.length ? (
            <ul className="user-audit">
              {audit.map((item) => {
                const capability = auditField(item.after, "capability");
                const label =
                  item.action === "user.updateBan"
                    ? t("userStatus")
                    : item.action === "media.updateUserAccess"
                      ? t("mediaSettings")
                      : t(
                          isEditableCapability(capability)
                            ? capabilityLabels[capability]
                            : "userCapability",
                        );
                return (
                  <li key={item.id}>
                    <p>
                      {t("userAuditChange", {
                        setting: label,
                        before: auditValue(item.before, item.action),
                        after: auditValue(item.after, item.action),
                      })}
                    </p>
                    <p className="muted">
                      {t("userAuditOperator", {
                        name:
                          operators.find((operator) => operator.id === item.actorId)?.name ??
                          item.actorId,
                      })}{" "}
                      · <ArticleTime value={item.createdAt} />
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>{t("userAuditEmpty")}</p>
          )}
        </section>
      </div>
    </>
  );
}
