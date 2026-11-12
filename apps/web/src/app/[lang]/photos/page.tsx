import { ArticlePagination } from "@/components/server";
import { ArticleImage, ArticleTopics } from "@/components";
import { LocaleLink } from "@/i18n/link";
import { localePath } from "@/i18n/routing";
import { getI18n } from "@/i18n/server";
import { imageUrl } from "@/media/urls";
import { getDb } from "@/server/db";
import { articlePage } from "@/server/domain/articles";
import { taxonomyId } from "@/server/domain/article-taxonomy";
import { listPublicPhotos, listPhotoTerms } from "@/server/services/photos";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("photos") };
}
export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string; tag?: string }>;
}) {
  const { locale, t } = await getI18n(),
    query = await searchParams;
  const page = articlePage(query.page),
    categoryId = taxonomyId(query.category),
    tagId = taxonomyId(query.tag);
  const filters = new URLSearchParams();
  if (categoryId) filters.set("category", categoryId);
  if (tagId) filters.set("tag", tagId);
  const [photos, { categories, tags }] = process.env.DATABASE_URL
    ? await Promise.all([
        listPublicPhotos(getDb(), page, { categoryId, tagId }),
        listPhotoTerms(getDb()),
      ])
    : [[], { categories: [], tags: [] }];
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">COLLECTING LITTLE MOMENTS</span>
        <h1>
          {t("photos")}
          <span className="brand-dot">.</span>
        </h1>
        <p>{t("photosDescription")}</p>
        <div className="draft-actions">
          <LocaleLink className="button" href="/photos/submit">
            {t("submitPhoto")}
          </LocaleLink>
          <LocaleLink className="button secondary" href="/photos/mine">
            {t("myPhotos")}
          </LocaleLink>
        </div>
      </div>
      {(categories.length > 0 || tags.length > 0 || filters.size > 0) && (
        <form
          method="get"
          action={localePath(locale, "/photos")}
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
              <LocaleLink className="button secondary" href="/photos">
                {t("clearArticleFilters")}
              </LocaleLink>
            )}
          </div>
        </form>
      )}
      {photos.length ? (
        <div className="project-catalog">
          {photos.slice(0, 20).map((photo) => (
            <article className="panel draft-card" key={photo.id}>
              <div className="project-cover">
                <ArticleImage
                  src={imageUrl(photo.mediaId)}
                  alt={photo.title}
                  unavailable={t("imagesUnavailable")}
                />
              </div>
              <h2>{photo.title}</h2>
              <p className="project-summary">{photo.summary}</p>
              <p className="muted">{t("authorLabel", { author: photo.authorName })}</p>
              <ArticleTopics
                category={photo.category}
                tags={photo.tags}
                publicLinks
                base="/photos"
              />
            </article>
          ))}
        </div>
      ) : (
        <section className="panel empty-state">
          <h2>{t("photosEmpty")}</h2>
        </section>
      )}
      <ArticlePagination
        page={page}
        more={photos.length > 20}
        base={filters.size ? `/photos?${filters}` : "/photos"}
      />
    </>
  );
}
