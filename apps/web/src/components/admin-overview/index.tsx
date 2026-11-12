import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  FolderKanban,
  Image,
  Music2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";
import type { getAdminOverview } from "@/server/services/admin-overview";
import styles from "../admin-shell/admin.module.css";

export async function AdminOverview({
  overview,
}: {
  overview: Awaited<ReturnType<typeof getAdminOverview>>;
}) {
  const { locale, t } = await getI18n();
  const number = new Intl.NumberFormat(locale);
  const storage = (value: bigint) =>
    new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "megabyte",
      maximumFractionDigits: 1,
    }).format(Number(value) / 1_000_000);
  const usage =
    overview.limitBytes > 0n ? Number((overview.usedBytes * 100n) / overview.limitBytes) : null;
  return (
    <>
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>WORKSPACE / OVERVIEW</span>
          <h1>{t("previewWelcome")}</h1>
          <p>{t("adminOverviewHelp")}</p>
        </div>
        <LocaleLink className="button" href="/write">
          {t("writeArticle")}
          <ArrowUpRight size={15} />
        </LocaleLink>
      </div>
      <div className={styles.stats}>
        <section className={styles.stat}>
          <div>
            <span>{t("previewPending")}</span>
            <ShieldCheck size={19} />
          </div>
          <strong>{number.format(overview.pendingArticles + overview.pendingProjects)}</strong>
          <p>
            {t("adminPendingBreakdown", {
              articles: overview.pendingArticles,
              projects: overview.pendingProjects,
            })}
          </p>
        </section>
        <section className={styles.stat}>
          <div>
            <span>{t("previewPublished")}</span>
            <FileText size={19} />
          </div>
          <strong>{number.format(overview.published)}</strong>
          <p>{t("previewPublishedHelp")}</p>
        </section>
        <section className={styles.stat}>
          <div>
            <span>{t("previewMembers")}</span>
            <Users size={19} />
          </div>
          <strong>{number.format(overview.users)}</strong>
          <p>{t("adminUsersHelp")}</p>
        </section>
        <section className={styles.stat}>
          <div>
            <span>{t("previewStorage")}</span>
            <Image size={19} />
          </div>
          <strong>{storage(overview.usedBytes)}</strong>
          <p>
            {usage === null ? t("adminLimitUnset") : t("adminStoragePercent", { percent: usage })}
          </p>
        </section>
      </div>
      <div className={styles.columns}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>{t("previewPendingTitle")}</h2>
              <p>{t("adminPendingOrder")}</p>
            </div>
            <LocaleLink href="/admin/reviews">
              {t("articleReview")}
              <ArrowUpRight size={15} />
            </LocaleLink>
          </div>
          {overview.pending.length ? (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>{t("previewTitle")}</th>
                    <th>{t("previewAuthor")}</th>
                    <th>{t("previewStatus")}</th>
                    <th>{t("previewAction")}</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.pending.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className={styles.rowIcon}>
                          {item.kind === "POST" ? (
                            <FileText size={18} />
                          ) : (
                            <FolderKanban size={18} />
                          )}
                        </span>
                        <span className={styles.pendingTitle}>
                          {item.title}
                          <small>{t(item.kind === "POST" ? "articles" : "projects")}</small>
                        </span>
                      </td>
                      <td>{item.author}</td>
                      <td>
                        <span className={styles.status}>{t("previewAwaitingReview")}</span>
                      </td>
                      <td>
                        <LocaleLink
                          href={
                            item.kind === "POST"
                              ? `/admin/reviews/${item.id}`
                              : "/admin/project-reviews"
                          }
                        >
                          {t("previewReview")}
                          <ArrowRight size={14} />
                        </LocaleLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.empty}>{t("adminPendingEmpty")}</p>
          )}
          <div className={styles.panelFooter}>
            <LocaleLink href="/admin/project-reviews">{t("projectReviews")} →</LocaleLink>
          </div>
        </section>
        <div className={styles.rightColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <h2>{t("previewQuickActions")}</h2>
              <ArrowUpRight size={17} />
            </div>
            <div className={styles.shortcuts}>
              <LocaleLink href="/admin/music">
                <span className={styles.shortcutIcon}>
                  <Music2 size={18} />
                </span>
                <span>
                  {t("manageMusic")}
                  <small>{t("previewMusicHelp")}</small>
                </span>
                <ArrowRight size={16} />
              </LocaleLink>
              <LocaleLink href="/admin/users">
                <span className={styles.shortcutIcon}>
                  <Users size={18} />
                </span>
                <span>
                  {t("userAccessManagement")}
                  <small>{t("previewUsersHelp")}</small>
                </span>
                <ArrowRight size={16} />
              </LocaleLink>
            </div>
          </section>
          <section className={styles.storage}>
            <div className={styles.storageIcon}>
              <Image size={21} />
            </div>
            <h2>{t("previewStorageTitle")}</h2>
            <p>{t("adminStorageHelp")}</p>
            <div className={styles.storageNumbers}>
              <strong>{storage(overview.usedBytes)}</strong>
              <span>
                {overview.limitBytes > 0n
                  ? `/ ${storage(overview.limitBytes)}`
                  : t("adminLimitUnset")}
              </span>
            </div>
            {usage !== null && (
              <div
                className={styles.progress}
                role="progressbar"
                aria-label={t("previewStorage")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, usage)}
              >
                <span style={{ width: `${Math.min(100, usage)}%` }} />
              </div>
            )}
            <LocaleLink href="/admin/media">
              {t("previewStorageManage")}
              <ArrowRight size={15} />
            </LocaleLink>
          </section>
        </div>
      </div>
    </>
  );
}
