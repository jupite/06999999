import { getI18n } from "@/i18n/server";
import Link from "next/link";
import { getDb } from "@/server/db";
import { listPublishedArticles } from "@/server/services/articles";
import { articlePage } from "@/server/domain/articles";
import { ArticlePagination, ArticleTime, ArticleNavigation } from "@/components/article-shared";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("articles") };
}
export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { t } = await getI18n();
  const page = articlePage((await searchParams).page);
  const articles = await listPublishedArticles(getDb(), page);
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">WORDS THAT STAY</span>
        <h1>
          {t("articles")}
          <span className="brand-dot">.</span>
        </h1>
        <p>{t("articlesDescription")}</p>
        <ArticleNavigation />
      </div>
      <div className="draft-list">
        {articles.slice(0, 20).map((article) => (
          <article key={article.slug} className="panel draft-card">
            <h2>
              <Link href={`/articles/${article.slug}`}>{article.title}</Link>
            </h2>
            <p>
              {t("byline", { author: article.authorName })}
              <ArticleTime value={article.publishedAt} />
            </p>
            <Link className="button secondary" href={`/articles/${article.slug}`}>
              {t("readMore")}
            </Link>
          </article>
        ))}
      </div>
      {!articles.length && (
        <section className="panel empty-state">
          <h2>{t("articlesEmpty")}</h2>
          <p>{t("articlesEmptyDetails")}</p>
        </section>
      )}
      <ArticlePagination page={page} more={articles.length > 20} base="/articles" />
    </>
  );
}
