import { getI18n } from "@/i18n/server";
import { LocaleLink } from "@/i18n/link";
import { currentActor } from "@/server/auth";
import { authorize } from "@/server/domain/permissions";
import { getDb } from "@/server/db";
import { listPendingArticles } from "@/server/services/articles";
import { articlePage } from "@/server/domain/articles";
import { ArticleAccessNotice, ArticlePagination } from "@/components/article-shared";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("articleReview") };
}
export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { t, system } = await getI18n();
  const actor = await currentActor();
  const access = authorize(actor, "site.manage");
  if (!access.allowed)
    return <ArticleAccessNotice signedIn={!!actor} reason={system(access.reason)} />;
  const page = articlePage((await searchParams).page);
  const articles = await listPendingArticles(getDb(), actor, page);
  return (
    <>
      <LocaleLink href="/admin">{t("backToAdmin")}</LocaleLink>
      <div className="page-heading">
        <h1>{t("articleReview")}</h1>
        <p>{t("reviewsDescription")}</p>
      </div>
      <div className="draft-list">
        {articles.slice(0, 20).map((article) => (
          <article key={article.id} className="panel draft-card">
            <h2>{article.revisions[0]?.title}</h2>
            <p>
              {t("authorLabel", { author: article.author.name })}
              {article.author.banned ? t("bannedMarker") : ""}
            </p>
            <LocaleLink className="button" href={`/admin/reviews/${article.id}`}>
              {t("openReview")}
            </LocaleLink>
          </article>
        ))}
      </div>
      {!articles.length && (
        <section className="panel empty-state">
          <h2>{t("emptyReviews")}</h2>
        </section>
      )}
      <ArticlePagination page={page} more={articles.length > 20} base="/admin/reviews" />
    </>
  );
}
