import type { Metadata } from "next";
import { LocaleLink } from "@/i18n/link";
import { Navigation, MusicProvider } from "@/components";
import { authConfigured } from "@/server/auth";
import { LocaleProvider } from "@/i18n/client";
import { getI18n } from "@/i18n/server";
import "../globals.css";
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t("siteName"), template: `%s · ${t("siteShortName")}` },
    description: t("siteDescription"),
    icons: { icon: "/favicon.svg" },
  };
}
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, dictionary, t } = await getI18n();
  return (
    <html lang={locale}>
      <body>
        <div className="ambient" aria-hidden="true" />
        <a href="#main" className="skip-link">
          {t("skipToContent")}
        </a>
        <LocaleProvider locale={locale} dictionary={dictionary}>
          <MusicProvider>
            <Navigation authEnabled={authConfigured()} />
            <main id="main" className="site-main">
              {children}
            </main>
            <footer className="footer">
              <span>
                {t("siteName")} <span className="muted"> / {t("workingTitle")}</span>
              </span>
              <span>{t("footerLine")}</span>
              <LocaleLink href="/about">{t("aboutHere")}</LocaleLink>
            </footer>
          </MusicProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
