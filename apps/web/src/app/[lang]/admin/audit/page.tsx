import { ArticleAccessNotice, ArticlePagination, ArticleTime } from "@/components/server";
import styles from "@/components/admin-shell/admin.module.css";
import { LocaleLink } from "@/i18n/link";
import { localePath } from "@/i18n/routing";
import { getI18n } from "@/i18n/server";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { articlePage } from "@/server/domain/articles";
import { authorize } from "@/server/domain/permissions";
import { auditGroups, isAuditGroup, listAuditRecords } from "@/server/services/audit";
import local from "./audit.module.css";

export const dynamic = "force-dynamic";
const labels = {
  user: "auditUsers",
  media: "auditMedia",
  music: "auditMusic",
  article: "auditArticles",
  project: "auditProjects",
  comment: "commentReviews",
} as const;
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; group?: string; actorId?: string; targetId?: string }>;
}) {
  const { locale, t, system } = await getI18n();
  const actor = await currentActor();
  const access = authorize(actor, "site.manage");
  if (!access.allowed)
    return <ArticleAccessNotice signedIn={!!actor} reason={system(access.reason)} />;
  const query = await searchParams;
  const page = articlePage(query.page);
  const group = isAuditGroup(query.group) ? query.group : undefined;
  const actorId = typeof query.actorId === "string" ? query.actorId.trim().slice(0, 100) : "";
  const targetId = typeof query.targetId === "string" ? query.targetId.trim().slice(0, 100) : "";
  const { records, operators } = await listAuditRecords(getDb(), actor, {
    page,
    group,
    actorId,
    targetId,
  });
  const names = new Map(operators.map((user) => [user.id, user.name]));
  const filters = new URLSearchParams();
  if (group) filters.set("group", group);
  if (actorId) filters.set("actorId", actorId);
  if (targetId) filters.set("targetId", targetId);
  return (
    <>
      <div className="page-heading">
        <h1>{t("auditTitle")}</h1>
        <p>{t("auditHelp")}</p>
      </div>
      <form
        method="get"
        action={localePath(locale, "/admin/audit")}
        className="panel draft-card article-filter-form"
      >
        <div className="article-taxonomy-fields">
          <label className="draft-title">
            {t("auditGroup")}
            <select name="group" defaultValue={group ?? ""}>
              <option value="">{t("auditAllGroups")}</option>
              {auditGroups.map((value) => (
                <option key={value} value={value}>
                  {t(labels[value])}
                </option>
              ))}
            </select>
          </label>
          <label className="draft-title">
            {t("auditOperatorId")}
            <input name="actorId" defaultValue={actorId} maxLength={100} />
          </label>
          <label className="draft-title">
            {t("auditTarget")}
            <input name="targetId" defaultValue={targetId} maxLength={100} />
          </label>
        </div>
        <div className="draft-actions">
          <button className="button">{t("auditFilter")}</button>
          {filters.size > 0 && (
            <LocaleLink className="button secondary" href="/admin/audit">
              {t("clearArticleFilters")}
            </LocaleLink>
          )}
        </div>
      </form>
      {records.length ? (
        <section className="panel">
          <div className={styles.tableWrap} role="region" tabIndex={0} aria-label={t("auditTitle")}>
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("auditTime")}</th>
                  <th scope="col">{t("auditOperator")}</th>
                  <th scope="col">{t("auditAction")}</th>
                  <th scope="col">{t("auditTarget")}</th>
                  <th scope="col">{t("auditChanges")}</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 20).map((record) => (
                  <tr key={record.id}>
                    <td>
                      <ArticleTime value={record.createdAt} />
                    </td>
                    <td>
                      <span className={styles.pendingTitle}>
                        {names.get(record.actorId) ?? t("auditMissingOperator")}
                      </span>
                      <small>{record.actorId}</small>
                    </td>
                    <td>
                      <code>{record.action}</code>
                    </td>
                    <td>
                      <code>{record.targetId}</code>
                    </td>
                    <td>
                      <details>
                        <summary>{t("auditExpand")}</summary>
                        <div className={local.changes}>
                          <strong>{t("auditBefore")}</strong>
                          <pre>{JSON.stringify(record.before, null, 2)}</pre>
                          <strong>{t("auditAfter")}</strong>
                          <pre>{JSON.stringify(record.after, null, 2)}</pre>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="panel empty-state">
          <h2>{t("auditEmpty")}</h2>
        </section>
      )}
      <ArticlePagination
        page={page}
        more={records.length > 20}
        base={filters.size ? `/admin/audit?${filters}` : "/admin/audit"}
      />
    </>
  );
}
