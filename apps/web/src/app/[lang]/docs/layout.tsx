import type { ReactNode } from "react";
import { apiDoc, functionDocs } from "@/docs/catalog";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";

export default async function DocsLayout({ children }: { children: ReactNode }) {
  const { t } = await getI18n();
  return (
    <div className="docs-layout">
      <nav className="panel docs-nav" aria-label={t("docs")}>
        <LocaleLink href="/docs">{t("docsOverview")}</LocaleLink>
        <h2>{t("docsFeatures")}</h2>
        <ul>
          {functionDocs.map((document) => (
            <li key={document.slug}>
              <LocaleLink href={`/docs/${document.slug}`}>{t(document.title)}</LocaleLink>
            </li>
          ))}
        </ul>
        <LocaleLink href={`/docs/${apiDoc.slug}`}>{t(apiDoc.title)}</LocaleLink>
      </nav>
      {children}
    </div>
  );
}
