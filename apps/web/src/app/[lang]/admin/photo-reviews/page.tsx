import { ArticleAccessNotice, ArticlePagination, ArticleTime } from "@/components/server";
import { ArticleImage, ArticleTopics, PhotoReviewForm } from "@/components";
import { getI18n } from "@/i18n/server";
import { imageUrl } from "@/media/urls";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { authorize } from "@/server/domain/permissions";
import { articlePage } from "@/server/domain/articles";
import { listPendingPhotos } from "@/server/services/photos";
export const dynamic = "force-dynamic";
export default async function PhotoReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { t, system } = await getI18n(),
    actor = await currentActor(),
    access = authorize(actor, "site.manage");
  if (!access.allowed)
    return <ArticleAccessNotice signedIn={!!actor} reason={system(access.reason)} />;
  const page = articlePage((await searchParams).page),
    photos = await listPendingPhotos(getDb(), actor, page);
  return (
    <>
      <div className="page-heading">
        <h1>{t("photoReviews")}</h1>
        <p>{t("photoReviewHelp")}</p>
      </div>
      <div className="draft-list">
        {photos.slice(0, 20).map((photo) => {
          const revision = photo.revisions[0];
          if (!revision) return null;
          return (
            <article className="panel draft-card" key={photo.id}>
              <h2>{revision.title}</h2>
              <p>
                {t("authorLabel", { author: photo.author.name })} ·{" "}
                <ArticleTime value={photo.createdAt} />
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
              <ArticleTopics category={revision.category} tags={revision.tags} />
              <PhotoReviewForm id={photo.id} version={revision.version} />
            </article>
          );
        })}
      </div>
      {!photos.length && (
        <section className="panel empty-state">
          <h2>{t("photoReviewsEmpty")}</h2>
        </section>
      )}
      <ArticlePagination page={page} more={photos.length > 20} base="/admin/photo-reviews" />
    </>
  );
}
