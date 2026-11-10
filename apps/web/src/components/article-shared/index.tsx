import { getI18n } from "@/i18n/server";
import { LocaleLink } from "@/i18n/link";
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
        <LocaleLink
          className="button secondary"
          href={`${base}${base.includes("?") ? "&" : "?"}page=${page - 1}`}
        >
          {t("previousPage")}
        </LocaleLink>
      )}
      <span>{t("pageNumber", { page })}</span>
      {more && (
        <LocaleLink
          className="button secondary"
          href={`${base}${base.includes("?") ? "&" : "?"}page=${page + 1}`}
        >
          {t("nextPage")}
        </LocaleLink>
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
      <LocaleLink className="button" href="/login">
        {signedIn ? t("viewAccount") : t("goLogin")}
      </LocaleLink>
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
      <LocaleLink
        href="/write"
        className={active === "write" ? "button" : "button secondary"}
        aria-current={active === "write" ? "page" : undefined}
      >
        {t("writeArticle")}
      </LocaleLink>
      <LocaleLink
        href="/my-articles"
        className={active === "mine" ? "button" : "button secondary"}
        aria-current={active === "mine" ? "page" : undefined}
      >
        {t("myArticles")}
      </LocaleLink>
    </nav>
  );
}
