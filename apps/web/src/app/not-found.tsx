import { getI18n } from "@/i18n/server";
import Link from "next/link";
export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <section className="panel empty-state">
      <span className="eyebrow">404 / LOST IN TIME</span>
      <h1>{t("notFoundHeading")}</h1>
      <Link className="button" href="/">
        {t("backHome")}
      </Link>
    </section>
  );
}
