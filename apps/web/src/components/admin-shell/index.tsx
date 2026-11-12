"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  History,
  BookOpen,
  ChevronRight,
  FileText,
  FolderKanban,
  Image,
  LayoutDashboard,
  Menu,
  Moon,
  Music2,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { useI18n } from "@/i18n/client";
import { LocaleLink } from "@/i18n/link";
import { localePath } from "@/i18n/routing";
import { AccountMenu } from "../account-menu";
import { LanguageSwitcher } from "../language-switcher";
import styles from "./admin.module.css";

const groups = [
  {
    label: "previewContent",
    links: [
      { href: "/my-articles", label: "myArticles", icon: FileText },
      { href: "/friends/mine", label: "myFriends", icon: BookOpen },
      { href: "/photos/mine", label: "myPhotos", icon: Image },
      { href: "/projects/mine", label: "myProjects", icon: FolderKanban },
      { href: "/admin/music", label: "manageMusic", icon: Music2 },
      { href: "/admin/categories", label: "manageCategories", icon: BookOpen },
    ],
  },
  {
    label: "previewManagement",
    links: [
      { href: "/admin/friend-reviews", label: "friendReviews", icon: ShieldCheck },
      { href: "/admin/photo-reviews", label: "photoReviews", icon: ShieldCheck },
      { href: "/admin/comment-reviews", label: "commentReviews", icon: ShieldCheck },
      { href: "/admin/reviews", label: "articleReview", icon: ShieldCheck },
      { href: "/admin/project-reviews", label: "projectReviews", icon: FolderKanban },
      { href: "/admin/features", label: "featureSettings", icon: Settings2 },
      { href: "/admin/audit", label: "auditTitle", icon: History },
      { href: "/admin/users", label: "userAccessManagement", icon: Users },
      { href: "/admin/media", label: "previewMedia", icon: Image },
      { href: "/admin/project-sites", label: "projectWebsiteRules", icon: SlidersHorizontal },
    ],
  },
] as const;

export function AdminShell({
  children,
  preview = false,
  authEnabled = false,
}: {
  children: ReactNode;
  preview?: boolean;
  authEnabled?: boolean;
}) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (href: string) => {
    const target = localePath(locale, href);
    return pathname === target || (href !== "/admin" && pathname.startsWith(`${target}/`));
  };
  const activeLink = groups
    .map((group) => group.links.find((link) => isActive(link.href)))
    .find(Boolean);
  const closeMenu = () => setMenuOpen(false);

  if (!preview && pathname === localePath(locale, "/admin/preview")) return children;

  return (
    <div
      className={styles.shell}
      onKeyDown={(event) => {
        if (event.key === "Escape") closeMenu();
      }}
    >
      <aside id="admin-sidebar" className={styles.sidebar} data-open={menuOpen}>
        <LocaleLink href="/" className={styles.brand}>
          <Moon size={24} />
          <span>
            {t("siteShortName")}
            <small>{t("previewWorkspace")}</small>
          </span>
        </LocaleLink>
        <button className={styles.closeMenu} onClick={closeMenu} aria-label={t("previewCloseMenu")}>
          <X size={20} />
        </button>
        <nav aria-label={t("admin")}>
          <LocaleLink
            className={preview || isActive("/admin") ? styles.active : undefined}
            href={preview ? "/admin/preview" : "/admin"}
            onClick={closeMenu}
            aria-current={preview || isActive("/admin") ? "page" : undefined}
          >
            <LayoutDashboard size={18} />
            {t("previewOverview")}
          </LocaleLink>
          {groups.map((group) => (
            <div className={styles.navGroup} key={group.label}>
              <span className={styles.navLabel}>{t(group.label)}</span>
              {group.links.map(({ href, label, icon: Icon }) => (
                <LocaleLink
                  key={href}
                  href={href}
                  className={isActive(href) ? styles.active : undefined}
                  aria-current={isActive(href) ? "page" : undefined}
                  onClick={closeMenu}
                >
                  <Icon size={18} />
                  {t(label)}
                </LocaleLink>
              ))}
            </div>
          ))}
        </nav>
        <LocaleLink className={styles.sidebarNote} href="/admin/preview">
          <Settings2 size={18} />
          <div>
            {t("previewStyleTitle")}
            <small>{t("previewStyleHelp")}</small>
          </div>
        </LocaleLink>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.toolbar}>
          <div className={styles.breadcrumb}>
            <button
              className={styles.openMenu}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={t("previewToggleMenu")}
              aria-expanded={menuOpen}
              aria-controls="admin-sidebar"
            >
              <Menu size={20} />
            </button>
            <span>{t("admin")}</span>
            <ChevronRight size={14} />
            <strong>{t(activeLink?.label ?? "previewOverview")}</strong>
          </div>
          <div className={styles.toolbarActions}>
            <LocaleLink className={styles.visitSite} href="/">
              {t("previewVisitSite")}
              <ArrowUpRight size={15} />
            </LocaleLink>
            <LanguageSwitcher />
            {preview ? (
              <LocaleLink className={styles.account} href="/login">
                <span>H</span>
                <span>{t("previewOwner")}</span>
              </LocaleLink>
            ) : (
              <div className={styles.account}>
                <AccountMenu enabled={authEnabled} />
              </div>
            )}
          </div>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
