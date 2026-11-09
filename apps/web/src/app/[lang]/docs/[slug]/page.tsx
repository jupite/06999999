import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { documents } from "@/docs/catalog";
import { DocMarkdown } from "@/components/doc-markdown";
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
  return <DocMarkdown markdown={markdown} />;
}
