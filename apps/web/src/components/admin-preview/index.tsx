"use client";

import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  FileText,
  FolderKanban,
  Image,
  Music2,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useI18n } from "@/i18n/client";
import { LocaleLink } from "@/i18n/link";
import { AdminShell } from "../admin-shell";
import styles from "../admin-shell/admin.module.css";

const entries = [
  { title: "previewArticleOne", author: "Momo", kind: "articles" },
  { title: "previewProjectOne", author: "Haru", kind: "projects" },
  { title: "previewArticleTwo", author: "Yuki", kind: "articles" },
  { title: "previewProjectTwo", author: "Sora", kind: "projects" },
] as const;

export function AdminPreview() {
  const { t } = useI18n();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const rows = entries.filter(
    (entry) =>
      (filter === "all" || filter === entry.kind) &&
      `${t(entry.title)} ${entry.author}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <AdminShell preview>
      <div id="preview-overview">
        <div className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>WORKSPACE / OVERVIEW</span>
            <h1>{t("previewWelcome")}</h1>
            <p>{t("previewWelcomeHelp")}</p>
          </div>
          <span className={styles.previewBadge}>
            <span />
            {t("previewSampleData")}
          </span>
        </div>
        <div className={styles.stats}>
          {(
            [
              {
                label: "previewPending",
                value: "12",
                caption: "previewPendingHelp",
                icon: ShieldCheck,
              },
              {
                label: "previewPublished",
                value: "48",
                caption: "previewPublishedHelp",
                icon: FileText,
              },
              {
                label: "previewMembers",
                value: "26",
                caption: "previewMembersHelp",
                icon: Users,
              },
              {
                label: "previewStorage",
                value: "1.28",
                caption: "previewStorageHelp",
                icon: Image,
              },
            ] as const
          ).map(({ label, value, caption, icon: Icon }) => (
            <section className={styles.stat} key={label}>
              <div>
                <span>{t(label)}</span>
                <Icon size={19} />
              </div>
              <strong>
                {value}
                {label === "previewStorage" && <small>GB</small>}
              </strong>
              <p>{t(caption)}</p>
            </section>
          ))}
        </div>
        <div className={styles.columns}>
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h2>{t("previewPendingTitle")}</h2>
                <p>{t("previewPendingSubtitle")}</p>
              </div>
              <LocaleLink href="/admin/reviews">
                {t("previewViewAll")}
                <ArrowUpRight size={15} />
              </LocaleLink>
            </div>
            <div className={styles.filters}>
              <div className={styles.tabs}>
                {(
                  [
                    ["all", "previewAll"],
                    ["articles", "articles"],
                    ["projects", "projects"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
              <label className={styles.search}>
                <Search size={16} />
                <input
                  aria-label={t("previewSearch")}
                  placeholder={t("previewSearch")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </div>
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
                  {rows.map((entry) => (
                    <tr key={entry.title}>
                      <td>
                        <span className={styles.rowIcon}>
                          {entry.kind === "articles" ? (
                            <FileText size={18} />
                          ) : (
                            <FolderKanban size={18} />
                          )}
                        </span>
                        <span>
                          {t(entry.title)}
                          <small>{t(entry.kind)}</small>
                        </span>
                      </td>
                      <td>{entry.author}</td>
                      <td>
                        <span className={styles.status}>{t("previewAwaitingReview")}</span>
                      </td>
                      <td>
                        <LocaleLink
                          href={
                            entry.kind === "articles" ? "/admin/reviews" : "/admin/project-reviews"
                          }
                        >
                          {t("previewReview")}
                          <ChevronRight size={14} />
                        </LocaleLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && <p className={styles.empty}>{t("previewNoResults")}</p>}
            <div className={styles.panelFooter}>{t("previewTableHelp")}</div>
          </section>
          <div className={styles.rightColumn}>
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <h2>{t("previewQuickActions")}</h2>
                <ArrowUpRight size={17} />
              </div>
              <div className={styles.shortcuts}>
                {(
                  [
                    {
                      label: "writeArticle",
                      detail: "previewWriteHelp",
                      href: "/write",
                      icon: FileText,
                    },
                    {
                      label: "manageMusic",
                      detail: "previewMusicHelp",
                      href: "/admin/music",
                      icon: Music2,
                    },
                    {
                      label: "userAccessManagement",
                      detail: "previewUsersHelp",
                      href: "/admin/users",
                      icon: Users,
                    },
                  ] as const
                ).map(({ label, detail, href, icon: Icon }) => (
                  <LocaleLink key={href} href={href}>
                    <span className={styles.shortcutIcon}>
                      <Icon size={18} />
                    </span>
                    <span>
                      {t(label)}
                      <small>{t(detail)}</small>
                    </span>
                    <ArrowRight size={16} />
                  </LocaleLink>
                ))}
              </div>
            </section>
            <section className={styles.storage}>
              <div className={styles.storageIcon}>
                <Image size={21} />
              </div>
              <h2>{t("previewStorageTitle")}</h2>
              <p>{t("previewStorageSubtitle")}</p>
              <div className={styles.storageNumbers}>
                <strong>
                  1.28 <small>GB</small>
                </strong>
                <span>/ 5 GB</span>
              </div>
              <div
                className={styles.progress}
                role="progressbar"
                aria-label={t("previewStorage")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={26}
              >
                <span />
              </div>
              <LocaleLink href="/admin/media">
                {t("previewStorageManage")}
                <ArrowRight size={15} />
              </LocaleLink>
            </section>
          </div>
        </div>
        <footer className={styles.footer}>
          <span>{t("previewFootnote")}</span>
          <LocaleLink href="/docs">
            {t("docs")}
            <ArrowUpRight size={14} />
          </LocaleLink>
        </footer>
      </div>
    </AdminShell>
  );
}
