import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { apiDoc, documents } from "@/docs/catalog";
import { openApiDocuments } from "@/docs/openapi";
import { DocMarkdown } from "@/components/server";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";

type Props = { params: Promise<{ slug: string }> };

function findDocument(slug: string) {
  return documents.find((document) => document.slug === slug) ?? notFound();
}

export async function generateMetadata({ params }: Props) {
  const [{ slug }, { t }] = await Promise.all([params, getI18n()]);
  return { title: t(findDocument(slug).title) };
}

export default async function DocumentPage({ params }: Props) {
  const { slug } = await params;
  const document = findDocument(slug);
  // The standalone build includes the files named in the docs catalog.
  const file = join(/*turbopackIgnore: true*/ process.cwd(), "../../doc", document.file);
  const markdown = await readFile(/*turbopackIgnore: true*/ file, "utf8");
  if (document.slug !== apiDoc.slug) return <DocMarkdown markdown={markdown} />;

  const { t } = await getI18n();
  return (
    <div>
      <nav className="panel docs-content docs-api-nav" aria-label={t("docsApi")}>
        {openApiDocuments.map((spec) => (
          <LocaleLink key={spec.id} className="button secondary" href={`/docs/api/${spec.id}`}>
            {t(spec.title)}
          </LocaleLink>
        ))}
      </nav>
      <DocMarkdown markdown={markdown} />
    </div>
  );
}
