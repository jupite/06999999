import { getI18n } from "@/i18n/server";
import { LocaleLink } from "@/i18n/link";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { listMyArticles } from "@/server/services/articles";
import {
  articlePage,
  articleStateLabels,
  articleFilter,
  articleFilters,
} from "@/server/domain/articles";
import { authorize } from "@/server/domain/permissions";
import { ArticlePagination, ArticleAccessNotice, ArticleNavigation } from "@/components/server";
import { DeletePublishedArticleButton, DeleteDraftButton } from "@/components";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("myArticles") };
}
export default async function MyArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const { t, system } = await getI18n();
  const actor = await currentActor();
  if (!actor || actor.banned)
    return (
      <>
        <ArticleNavigation active="mine" />
        <ArticleAccessNotice
          signedIn={!!actor}
          reason={actor ? system("accountBanned") : t("signInForArticles")}
        />
      </>
    );
  const query = await searchParams;
  const page = articlePage(query.page),
    status = articleFilter(query.status);
  const articles = await listMyArticles(getDb(), actor, page, status);
  const canEdit = authorize(actor, "content.editOwn").allowed;
  const canSubmit = authorize(actor, "post.submit").allowed;
  return (
    <>
      <div className="page-heading">
        <h1>{t("myArticles")}</h1>
        <p>{t("myArticlesDescription")}</p>
        <ArticleNavigation active="mine" />
      </div>
      <nav className="article-filters" aria-label={t("articleFilters")}>
        {Object.entries(articleFilters).map(([value, label]) => (
          <LocaleLink
            key={value}
            href={`/my-articles?status=${value}`}
            className={value === status ? "button" : "button secondary"}
            aria-current={value === status ? "page" : undefined}
          >
            {t(label)}
          </LocaleLink>
        ))}
      </nav>
      <div className="draft-list">
        {articles.slice(0, 20).map((article) => {
          const revision = article.revisions[0];
          const published = article.publishedVersion !== null;
          return (
            revision && (
              <article className="panel draft-card" key={article.id}>
                <h2>{revision.title}</h2>
                <p>
                  {published && revision.state !== "PUBLISHED"
                    ? t("editStatus", { status: t(articleStateLabels[revision.state]) })
                    : t(articleStateLabels[revision.state])}
                </p>
                <div className="draft-actions">
                  <LocaleLink
                    className="button secondary"
                    href={
                      revision.state === "DRAFT"
                        ? `/write?id=${article.id}`
                        : `/my-articles/${article.id}`
                    }
                  >
                    {revision.state === "DRAFT"
                      ? t("continueEditing")
                      : revision.state === "PUBLISHED"
                        ? t("viewArticle")
                        : t("viewSubmission")}
                  </LocaleLink>
                  {canEdit && revision.state === "DRAFT" && (
                    <DeleteDraftButton
                      id={article.id}
                      version={article.currentVersion}
                      title={revision.title}
                    />
                  )}
                  {published &&
                    canEdit &&
                    canSubmit &&
                    (revision.state === "PUBLISHED" || revision.state === "REJECTED") && (
                      <LocaleLink className="button secondary" href={`/write?id=${article.id}`}>
                        {t("editArticle")}
                      </LocaleLink>
                    )}
                  {published && canEdit && (
                    <DeletePublishedArticleButton
                      id={article.id}
                      version={article.currentVersion}
                      title={revision.title}
                    />
                  )}
                </div>
              </article>
            )
          );
        })}
      </div>
      {!articles.length && (
        <section className="panel empty-state">
          <h2>
            {status === "all"
              ? t("emptyArticles")
              : t("emptyFilteredArticles", { filter: t(articleFilters[status]) })}
          </h2>
          <p>{t("emptyMyArticlesHelp")}</p>
        </section>
      )}
      <ArticlePagination
        page={page}
        more={articles.length > 20}
        base={`/my-articles?status=${status}`}
      />
    </>
  );
}
