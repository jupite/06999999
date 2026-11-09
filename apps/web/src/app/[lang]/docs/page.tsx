import { apiDoc, functionDocs } from "@/docs/catalog";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("docs") };
}

export default async function DocsPage() {
  const { t } = await getI18n();
  return (
    <section className="panel docs-content">
      <h1>{t("docs")}</h1>
      <h2>{t("docsFeatures")}</h2>
      <p>{t("docsFeaturesDescription")}</p>
      <ul className="docs-index">
        {functionDocs.map((document) => (
          <li key={document.slug}>
            <LocaleLink href={`/docs/${document.slug}`}>{t(document.title)}</LocaleLink>
          </li>
        ))}
      </ul>
      <h2>{t("docsApi")}</h2>
      <p>{t("docsApiDescription")}</p>
      <LocaleLink className="text-link" href={`/docs/${apiDoc.slug}`}>
        {t("docsApi")}
      </LocaleLink>
    </section>
  );
}
