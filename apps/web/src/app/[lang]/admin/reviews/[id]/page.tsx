import { getI18n } from "@/i18n/server";
import { LocaleLink } from "@/i18n/link";

import { currentActor } from "@/server/auth";
import { authorize } from "@/server/domain/permissions";
import { getDb } from "@/server/db";
import { readPendingArticle } from "@/server/services/articles";
import { ArticleAccessNotice } from "@/components/article-shared";
import { ArticleBody } from "@/components/article-body";
import { ArticleTopics } from "@/components/article-topics";
import { ReviewArticleForm } from "@/components/article-controls";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("reviewSubmission") };
}
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { t, system } = await getI18n();
  const actor = await currentActor();
  const access = authorize(actor, "site.manage");
  if (!access.allowed)
    return <ArticleAccessNotice signedIn={!!actor} reason={system(access.reason)} />;
  const article = await readPendingArticle(getDb(), actor, (await params).id);
  if (!article)
    return (
      <section className="panel empty-state">
        <h1>{t("reviewUnavailable")}</h1>
        <LocaleLink className="button" href="/admin/reviews">
          {t("backToReviews")}
        </LocaleLink>
      </section>
    );
  const revision = article.revisions[0];
  return (
    <>
      <LocaleLink href="/admin/reviews">← {t("backToReviews")}</LocaleLink>
      <article className="panel draft-card">
        <h1>{revision.title}</h1>
        <p>{t("reviewVersion", { author: article.author.name, version: revision.version })}</p>
        {article.author.banned && <p className="notice">{t("authorBanned")}</p>}
        {article.publishedVersion !== null && <p>{t("reviewPublishedEdit")}</p>}
        <ArticleTopics category={revision.category} tags={revision.tags} />
        <ArticleBody markdown={revision.markdown} />
      </article>
      <ReviewArticleForm id={article.id} version={revision.version} />
    </>
  );
}
