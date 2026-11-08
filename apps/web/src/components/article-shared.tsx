import { getI18n } from "@/i18n/server";
import Link from "next/link";
export async function ArticlePagination({
  page,
  more,
  base,
}: {
  page: number;
  more: boolean;
  base: string;
}) {
  const { t } = await getI18n();
  return (
    <nav className="draft-actions" aria-label={t("pagination")}>
      {page > 1 && (
        <Link
          className="button secondary"
          href={`${base}${base.includes("?") ? "&" : "?"}page=${page - 1}`}
        >
          {t("previousPage")}
        </Link>
      )}
      <span>{t("pageNumber", { page })}</span>
      {more && (
        <Link
          className="button secondary"
          href={`${base}${base.includes("?") ? "&" : "?"}page=${page + 1}`}
        >
          {t("nextPage")}
        </Link>
      )}
    </nav>
  );
}
export async function ArticleAccessNotice({
  reason,
  signedIn,
}: {
  reason: string;
  signedIn: boolean;
}) {
  const { t } = await getI18n();
  return (
    <section className="panel empty-state">
      <h1>{signedIn ? t("noAccess") : t("signInRequired")}</h1>
      <p>{reason}</p>
      <Link className="button" href="/login">
        {signedIn ? t("viewAccount") : t("goLogin")}
      </Link>
    </section>
  );
}
export async function ArticleTime({ value }: { value: Date }) {
  const { locale, t } = await getI18n();
  return (
    <time dateTime={value.toISOString()}>
      {new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Taipei",
      }).format(value)}
      {t("timeZoneLabel")}
    </time>
  );
}

export async function ArticleNavigation({ active }: { active?: "write" | "mine" }) {
  const { t } = await getI18n();
  return (
    <nav className="article-navigation" aria-label={t("articleNav")}>
      <Link
        href="/write"
        className={active === "write" ? "button" : "button secondary"}
        aria-current={active === "write" ? "page" : undefined}
      >
        {t("writeArticle")}
      </Link>
      <Link
        href="/my-articles"
        className={active === "mine" ? "button" : "button secondary"}
        aria-current={active === "mine" ? "page" : undefined}
      >
        {t("myArticles")}
      </Link>
    </nav>
  );
}
