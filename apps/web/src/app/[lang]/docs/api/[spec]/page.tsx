import { notFound } from "next/navigation";
import { OpenApiReference } from "@/components";
import { openApiBase, openApiDocuments } from "@/docs/openapi";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";

type Props = { params: Promise<{ spec: string }> };

function findSpec(id: string) {
  return openApiDocuments.find((spec) => spec.id === id) ?? notFound();
}

export async function generateMetadata({ params }: Props) {
  const [{ spec }, { t }] = await Promise.all([params, getI18n()]);
  return { title: t(findSpec(spec).title) };
}

export default async function ApiReferencePage({ params }: Props) {
  const [{ spec }, { t }] = await Promise.all([params, getI18n()]);
  const document = findSpec(spec);
  return (
    <section className="panel docs-content">
      <LocaleLink className="text-link" href="/docs/api">
        {t("docsApi")}
      </LocaleLink>
      <h1>{t(document.title)}</h1>
      <p>{t(document.draft ? "docsApiDraftStatus" : "docsApiImplementedStatus")}</p>
      <p>
        <a className="text-link" href={`${openApiBase}/${document.file}`}>
          {t("docsApiSource")}
        </a>
      </p>
      <OpenApiReference key={document.id} spec={document.file} />
    </section>
  );
}
