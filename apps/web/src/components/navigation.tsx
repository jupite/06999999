"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon } from "lucide-react";
import { AccountMenu } from "./account-menu";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "@/i18n/client";
const navigation = [
  ["/", "home"],
  ["/projects", "projects"],
  ["/articles", "articles"],
  ["/photos", "photos"],
  ["/music", "music"],
  ["/friends", "friends"],
  ["/about", "about"],
] as const;
export function Navigation({ authEnabled }: { authEnabled: boolean }) {
  const { t } = useI18n();
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/">
          <Moon size={22} />
          <span>
            {t("siteName")}
            <span className="brand-dot">.</span>
          </span>
        </Link>
        <nav aria-label={t("primaryNav")}>
          {navigation.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={pathname === href ? "active" : ""}
            >
              {t(label)}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <LanguageSwitcher />
          <AccountMenu enabled={authEnabled} />
        </div>
      </div>
    </header>
  );
}
