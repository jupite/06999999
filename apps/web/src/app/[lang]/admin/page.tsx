import { getI18n } from "@/i18n/server";
import { currentActor } from "@/server/auth";
import { authorize } from "@/server/domain/permissions";
import { LocaleLink } from "@/i18n/link";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const { t, system } = await getI18n();
  const actor = await currentActor();
  const access = authorize(actor, "site.manage");
  if (!access.allowed)
    return (
      <section className="panel empty-state">
        <h1>{actor ? t("noAdminAccess") : t("adminEntry")}</h1>
        <p>{actor ? t("adminDenied", { reason: system(access.reason) }) : system(access.reason)}</p>
        <LocaleLink className="button" href="/login">
          {actor ? t("viewAccount") : t("goLogin")}
        </LocaleLink>
      </section>
    );
  return (
    <section className="panel empty-state">
      <h1>{t("admin")}</h1>
      <LocaleLink className="button" href="/admin/reviews">
        {t("articleReview")}
      </LocaleLink>
      <LocaleLink className="button secondary" href="/admin/media">
        {t("mediaSettings")}
      </LocaleLink>
      <LocaleLink className="button secondary" href="/admin/categories">
        {t("manageCategories")}
      </LocaleLink>
      <LocaleLink className="button secondary" href="/admin/users">
        {t("userAccessManagement")}
      </LocaleLink>
      <LocaleLink className="button secondary" href="/admin/project-sites">
        {t("projectWebsiteRules")}
      </LocaleLink>
      <LocaleLink className="button secondary" href="/admin/project-reviews">
        {t("projectReviews")}
      </LocaleLink>
      <LocaleLink className="button secondary" href="/admin/music">
        {t("manageMusic")}
      </LocaleLink>
      <p>{t("adminDescription")}</p>
    </section>
  );
}
