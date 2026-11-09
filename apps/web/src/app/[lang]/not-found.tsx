import { getI18n } from "@/i18n/server";
import { LocaleLink } from "@/i18n/link";
export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <section className="panel empty-state">
      <span className="eyebrow">404 / LOST IN TIME</span>
      <h1>{t("notFoundHeading")}</h1>
      <LocaleLink className="button" href="/">
        {t("backHome")}
      </LocaleLink>
    </section>
  );
}
