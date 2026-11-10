import { getI18n } from "@/i18n/server";
import { localePath } from "@/i18n/routing";
import { LocaleLink } from "@/i18n/link";
import { getDb } from "@/server/db";
import { listPublishedArticles, listPublishedTerms } from "@/server/services/public-articles";
import { articlePage } from "@/server/domain/articles";
import { taxonomyId } from "@/server/domain/article-taxonomy";
import { ArticlePagination, ArticleTime, ArticleNavigation } from "@/components/server";
import { ArticleTopics } from "@/components";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("articles") };
}
export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string; tag?: string }>;
}) {
  const { locale, t } = await getI18n();
  const query = await searchParams;
  const page = articlePage(query.page);
  const categoryId = taxonomyId(query.category);
  const tagId = taxonomyId(query.tag);
  const filters = new URLSearchParams();
  if (categoryId) filters.set("category", categoryId);
  if (tagId) filters.set("tag", tagId);
  const db = getDb();
  const [articles, { categories, tags }] = await Promise.all([
    listPublishedArticles(db, page, { categoryId, tagId }),
    listPublishedTerms(db),
  ]);
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
      {(categories.length > 0 || tags.length > 0 || filters.size > 0) && (
        <form
          method="get"
          action={localePath(locale, "/articles")}
          className="panel draft-card article-filter-form"
        >
          <div className="article-taxonomy-fields">
            <label className="draft-title">
              {t("articleCategory")}
              <select name="category" defaultValue={categoryId ?? ""} key={categoryId ?? "all"}>
                <option value="">{t("allArticleCategories")}</option>
                {categoryId && !categories.some(({ id }) => id === categoryId) && (
                  <option value={categoryId}>{t("articleFilterUnavailable")}</option>
                )}
                {categories.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="draft-title">
              {t("articleTag")}
              <select name="tag" defaultValue={tagId ?? ""} key={tagId ?? "all"}>
                <option value="">{t("allArticleTags")}</option>
                {tagId && !tags.some(({ id }) => id === tagId) && (
                  <option value={tagId}>{t("articleFilterUnavailable")}</option>
                )}
                {tags.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="draft-actions">
            <button className="button" type="submit">
              {t("applyArticleFilters")}
            </button>
            {filters.size > 0 && (
              <LocaleLink className="button secondary" href="/articles">
                {t("clearArticleFilters")}
              </LocaleLink>
            )}
          </div>
        </form>
      )}
      <div className="draft-list">
        {articles.slice(0, 20).map((article) => (
          <article key={article.slug} className="panel draft-card">
            <h2>
              <LocaleLink href={`/articles/${article.slug}`}>{article.title}</LocaleLink>
            </h2>
            <p>
              {t("byline", { author: article.authorName })}
              <ArticleTime value={article.publishedAt} />
            </p>
            <ArticleTopics category={article.category} tags={article.tags} publicLinks />
            <LocaleLink className="button secondary" href={`/articles/${article.slug}`}>
              {t("readMore")}
            </LocaleLink>
          </article>
        ))}
      </div>
      {!articles.length && (
        <section className="panel empty-state">
          <h2>{t(filters.size ? "filteredArticlesEmpty" : "articlesEmpty")}</h2>
          <p>{t(filters.size ? "filteredArticlesEmptyDetails" : "articlesEmptyDetails")}</p>
        </section>
      )}
      <ArticlePagination
        page={page}
        more={articles.length > 20}
        base={filters.size ? `/articles?${filters}` : "/articles"}
      />
    </>
  );
}
