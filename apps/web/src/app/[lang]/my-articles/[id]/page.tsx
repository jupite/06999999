import { getI18n } from "@/i18n/server";
import { LocaleLink } from "@/i18n/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { readMyArticle } from "@/server/services/articles";
import { articleStateLabels } from "@/server/domain/articles";
import { authorize } from "@/server/domain/permissions";
import { ArticleBody, ArticleAccessNotice, ArticleNavigation } from "@/components/server";
import { ArticleTopics, CopyRejectedButton } from "@/components";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("mySubmission") };
}
export default async function MyArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { t, system } = await getI18n();
  const actor = await currentActor();
  if (!actor || actor.banned)
    return (
      <ArticleAccessNotice
        signedIn={!!actor}
        reason={actor ? system("accountBanned") : t("signInRequired")}
      />
    );
  const article = await readMyArticle(getDb(), actor, (await params).id);
  if (!article || !article.revisions[0]) notFound();
  const revision = article.revisions[0];
  const published = article.publishedVersion !== null;
  const canEditPublished =
    published &&
    (revision.state === "PUBLISHED" || revision.state === "REJECTED") &&
    authorize(actor, "content.editOwn").allowed &&
    authorize(actor, "post.submit").allowed;
  return (
    <>
      <ArticleNavigation active="mine" />
      <section className="panel draft-card">
        <h1>{revision.title}</h1>
        <p>
          {t("statusLabel", {
            status:
              published && revision.state !== "PUBLISHED"
                ? t("editStatus", { status: t(articleStateLabels[revision.state]) })
                : t(articleStateLabels[revision.state]),
          })}
        </p>
        {revision.state === "PENDING_HUMAN" && (
          <p>{published ? t("editUnderReview") : t("submissionUnderReview")}</p>
        )}
        {revision.state === "REJECTED" && (
          <>
            <p className="notice">
              {t("rejectionReason", {
                reason: revision.reviews[0]?.reason ?? t("rejectionReasonFallback"),
              })}
            </p>
            {published ? (
              <p>{t("previousVersionVisible")}</p>
            ) : (
              <>
                <CopyRejectedButton id={article.id} version={article.currentVersion} />
                <p>{t("copyRejectedHelp")}</p>
              </>
            )}
          </>
        )}
        {revision.state === "DRAFT" && (
          <LocaleLink className="button" href={`/write?id=${article.id}`}>
            {t("continueEditing")}
          </LocaleLink>
        )}
        {canEditPublished && (
          <LocaleLink className="button" href={`/write?id=${article.id}`}>
            {revision.state === "REJECTED" ? t("editAndResubmit") : t("editArticle")}
          </LocaleLink>
        )}
        {published && (
          <LocaleLink className="button" href={`/articles/${article.slug}`}>
            {t("viewPublished")}
          </LocaleLink>
        )}
        <ArticleTopics category={revision.category} tags={revision.tags} />
        <ArticleBody markdown={revision.markdown} />
      </section>
    </>
  );
}
