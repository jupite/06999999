import { ArticleAccessNotice } from "@/components/article-shared";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { maxTaxonomyNameLength } from "@/server/domain/article-taxonomy";
import { authorize } from "@/server/domain/permissions";
import { listArticleCategories } from "@/server/services/article-taxonomy";
import { createCategoryAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const { locale, t, system } = await getI18n();
  const actor = await currentActor();
  const access = authorize(actor, "site.manage");
  if (!access.allowed)
    return <ArticleAccessNotice signedIn={!!actor} reason={system(access.reason)} />;

  const categories = await listArticleCategories(getDb());
  const { result } = await searchParams;
  const error =
    result === "invalidCategoryName" ||
    result === "categoryNameTaken" ||
    result === "categorySaveFailed"
      ? system(result)
      : null;
  return (
    <>
      <LocaleLink href="/admin">{t("backToAdmin")}</LocaleLink>
      <div className="page-heading">
        <h1>{t("manageCategories")}</h1>
        <p>{t("manageCategoriesHelp")}</p>
      </div>
      <div className="draft-list">
        <form action={createCategoryAction.bind(null, locale)} className="panel draft-card">
          <label className="draft-title">
            {t("categoryName")}
            <input name="name" required maxLength={maxTaxonomyNameLength * 2} />
          </label>
          <button type="submit" className="button">
            {t("createCategory")}
          </button>
          {result === "saved" && <p role="status">{t("categoryCreated")}</p>}
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
        </form>
        <section className="panel draft-card">
          <h2>{t("articleCategories")}</h2>
          {categories.length ? (
            <ul className="article-topics">
              {categories.map(({ id, name }) => (
                <li className="pill" key={id}>
                  {name}
                </li>
              ))}
            </ul>
          ) : (
            <p>{t("categoriesEmpty")}</p>
          )}
        </section>
      </div>
    </>
  );
}
