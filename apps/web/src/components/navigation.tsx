"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon } from "lucide-react";
import { AccountMenu } from "./account-menu";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/routing";
const navigation = [
  ["/", "home"],
  ["/projects", "projects"],
  ["/articles", "articles"],
  ["/photos", "photos"],
  ["/music", "music"],
  ["/friends", "friends"],
  ["/about", "about"],
  ["/docs", "docs"],
] as const;
export function Navigation({ authEnabled }: { authEnabled: boolean }) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href={localePath(locale)}>
          <Moon size={22} />
          <span>
            {t("siteName")}
            <span className="brand-dot">.</span>
          </span>
        </Link>
        <nav aria-label={t("primaryNav")}>
          {navigation.map(([path, label]) => {
            const href = localePath(locale, path);
            const active =
              pathname === href || (path === "/docs" && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={active ? "active" : ""}
              >
                {t(label)}
              </Link>
            );
          })}
        </nav>
        <div className="header-actions">
          <LanguageSwitcher />
          <AccountMenu enabled={authEnabled} />
        </div>
      </div>
    </header>
  );
}
