import { getI18n } from "@/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db";
import { readPublishedArticle } from "@/server/services/articles";
import { ArticleBody } from "@/components/article-body";
import { ArticleTime, ArticleNavigation } from "@/components/article-shared";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { t } = await getI18n();
  const article = await readPublishedArticle(getDb(), (await params).slug);
  return { title: article?.title ?? t("articleMissing") };
}
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { t } = await getI18n();
  const article = await readPublishedArticle(getDb(), (await params).slug);
  if (!article) notFound();
  return (
    <>
      <ArticleNavigation />
      <Link href="/articles">{t("backToArticles")}</Link>
      <article className="panel draft-card">
        <h1>{article.title}</h1>
        <p>
          {t("byline", { author: article.authorName })}
          <ArticleTime value={article.publishedAt} />
        </p>
        <ArticleBody markdown={article.markdown} />
      </article>
    </>
  );
}
