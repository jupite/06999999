import styles from "@/components/admin-shell/admin.module.css";
import { ArticleAccessNotice, ArticlePagination } from "@/components/server";
import { LocaleLink } from "@/i18n/link";
import { localePath } from "@/i18n/routing";
import { getI18n } from "@/i18n/server";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { articlePage } from "@/server/domain/articles";
import { authorize, editableCapabilities, isEditableCapability } from "@/server/domain/permissions";
import { listUserAccounts } from "@/server/services/user-access";
import { capabilityLabels } from "./labels";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    capability?: string;
    effect?: string;
  }>;
}) {
  const { locale, t, system } = await getI18n();
  const actor = await currentActor();
  const access = authorize(actor, "site.manage");
  if (!access.allowed)
    return <ArticleAccessNotice signedIn={!!actor} reason={system(access.reason)} />;

  const query = await searchParams;
  const page = articlePage(query.page);
  const search = typeof query.search === "string" ? query.search.trim().slice(0, 100) : "";
  const status =
    query.status === "active" || query.status === "banned" || query.status === "custom"
      ? query.status
      : undefined;
  const capability = isEditableCapability(query.capability) ? query.capability : undefined;
  const effect = query.effect === "ALLOW" || query.effect === "DENY" ? query.effect : undefined;
  const users = await listUserAccounts(getDb(), actor, {
    page,
    search,
    status,
    capability,
    effect,
  });
  const filters = new URLSearchParams();
  if (search) filters.set("search", search);
  if (status) filters.set("status", status);
  if (capability) filters.set("capability", capability);
  if (effect) filters.set("effect", effect);
  const bytes = new Intl.NumberFormat(locale, { style: "unit", unit: "byte" });

  return (
    <>
      <LocaleLink href="/admin">{t("backToAdmin")}</LocaleLink>
      <div className="page-heading">
        <h1>{t("userAccessManagement")}</h1>
        <p>{t("userAccessManagementHelp")}</p>
      </div>
      <form
        method="get"
        action={localePath(locale, "/admin/users")}
        className="panel draft-card article-filter-form"
      >
        <div className="article-taxonomy-fields">
          <label className="draft-title">
            {t("searchUsers")}
            <input name="search" maxLength={100} defaultValue={search} />
          </label>
          <label className="draft-title">
            {t("userStatus")}
            <select name="status" defaultValue={status ?? ""}>
              <option value="">{t("allUsers")}</option>
              <option value="active">{t("activeUser")}</option>
              <option value="banned">{t("bannedUser")}</option>
              <option value="custom">{t("customPermissions")}</option>
            </select>
          </label>
          <label className="draft-title">
            {t("userCapability")}
            <select name="capability" defaultValue={capability ?? ""}>
              <option value="">{t("allCapabilities")}</option>
              {editableCapabilities.map((key) => (
                <option key={key} value={key}>
                  {t(capabilityLabels[key])}
                </option>
              ))}
            </select>
          </label>
          <label className="draft-title">
            {t("userPermissionMode")}
            <select name="effect" defaultValue={effect ?? ""}>
              <option value="">{t("allPermissionModes")}</option>
              <option value="ALLOW">{t("permissionAllow")}</option>
              <option value="DENY">{t("permissionDeny")}</option>
            </select>
          </label>
        </div>
        <div className="draft-actions">
          <button className="button" type="submit">
            {t("filterUsers")}
          </button>
          {filters.size > 0 && (
            <LocaleLink className="button secondary" href="/admin/users">
              {t("clearArticleFilters")}
            </LocaleLink>
          )}
        </div>
      </form>
      {users.length > 0 && (
        <section className="panel">
          <div
            className={styles.tableWrap}
            tabIndex={0}
            role="region"
            aria-label={t("userAccessManagement")}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("userAccount")}</th>
                  <th scope="col">{t("userStatus")}</th>
                  <th scope="col">{t("customPermissions")}</th>
                  <th scope="col">{t("userStorage")}</th>
                  <th scope="col">{t("userActions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(0, 20).map((user) => (
                  <tr key={user.id}>
                    <td>
                      <span className={styles.pendingTitle}>{user.name}</span>
                      <small>{t("userGithubId", { id: user.githubId })}</small>
                    </td>
                    <td>{t(user.banned ? "bannedUser" : "activeUser")}</td>
                    <td>
                      {user.permissions.length
                        ? t("userPermissionCounts", {
                            allow: user.permissions.filter(({ effect }) => effect === "ALLOW")
                              .length,
                            deny: user.permissions.filter(({ effect }) => effect === "DENY").length,
                          })
                        : t("permissionInherit")}
                    </td>
                    <td>
                      {t("userImageUsage", {
                        used: bytes.format(user.quota?.usedBytes ?? 0n),
                        limit: bytes.format(user.quota?.limitBytes ?? 0n),
                      })}
                    </td>
                    <td>
                      <LocaleLink href={`/admin/users/${user.id}`}>
                        {t("editUserAccess")}
                        <span className="sr-only"> · {user.name}</span>
                      </LocaleLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {!users.length && (
        <section className="panel empty-state">
          <h2>{t("usersEmpty")}</h2>
        </section>
      )}
      <ArticlePagination
        page={page}
        more={users.length > 20}
        base={filters.size ? `/admin/users?${filters}` : "/admin/users"}
      />
    </>
  );
}
