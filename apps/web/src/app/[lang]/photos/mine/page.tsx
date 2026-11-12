import { authorize } from "@/server/domain/permissions";
import { ArticleAccessNotice, ArticlePagination, ArticleTime } from "@/components/server";
import { ContentWithdrawal, ArticleImage, ArticleTopics } from "@/components";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";
import { imageUrl } from "@/media/urls";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { articlePage, articleStateLabels } from "@/server/domain/articles";
import { listMyPhotos } from "@/server/services/photos";
export const dynamic = "force-dynamic";
export default async function MyPhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; submitted?: string }>;
}) {
  const { t, system } = await getI18n(),
    actor = await currentActor();
  if (!actor) return <ArticleAccessNotice signedIn={false} reason={system("loginRequired")} />;
  const query = await searchParams,
    page = articlePage(query.page),
    photos = await listMyPhotos(getDb(), actor, page);
  return (
    <>
      <div className="page-heading">
        <h1>{t("myPhotos")}</h1>
        <div className="draft-actions">
          <LocaleLink href="/photos">{t("backToPhotos")}</LocaleLink>
          <LocaleLink className="button" href="/photos/submit">
            {t("submitPhoto")}
          </LocaleLink>
        </div>
      </div>
      {query.submitted === "1" && <p role="status">{t("photoSubmitted")}</p>}
      <div className="project-catalog">
        {photos.slice(0, 20).map((photo) => {
          const revision = photo.revisions[0];
          if (!revision) return null;
          return (
            <article className="panel draft-card" key={photo.id}>
              <h2>{revision.title}</h2>
              <p>
                {t(articleStateLabels[revision.state])} · <ArticleTime value={photo.createdAt} />
              </p>
              {revision.media[0] && (
                <div className="project-cover">
                  <ArticleImage
                    src={imageUrl(revision.media[0].id)}
                    alt={revision.title}
                    unavailable={t("imagesUnavailable")}
                  />
                </div>
              )}
              <p className="project-summary">{revision.summary}</p>
              {authorize(actor, "content.editOwn").allowed &&
                (revision.state === "PENDING_HUMAN" || revision.state === "PUBLISHED") && (
                  <ContentWithdrawal
                    id={photo.id}
                    version={revision.version}
                    kind="PHOTO"
                    state={revision.state}
                    title={revision.title}
                  />
                )}
              <ArticleTopics category={revision.category} tags={revision.tags} />
              {revision.state === "REJECTED" && (
                <p>{t("photoRejection", { reason: revision.reviews[0]?.reason ?? "" })}</p>
              )}
            </article>
          );
        })}
      </div>
      {!photos.length && (
        <section className="panel empty-state">
          <h2>{t("myPhotosEmpty")}</h2>
        </section>
      )}
      <ArticlePagination page={page} more={photos.length > 20} base="/photos/mine" />
    </>
  );
}
