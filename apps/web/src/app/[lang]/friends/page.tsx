import { ArrowUpRight } from "lucide-react";
import { ArticlePagination } from "@/components/server";
import { ArticleImage } from "@/components";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";
import { imageUrl } from "@/media/urls";
import { getDb } from "@/server/db";
import { articlePage } from "@/server/domain/articles";
import { parseProjectUrl } from "@/server/domain/project-sites";
import { listPublicFriends } from "@/server/services/friends";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("friends") };
}
export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { t } = await getI18n(),
    page = articlePage((await searchParams).page),
    friends = process.env.DATABASE_URL ? await listPublicFriends(getDb(), page) : [];
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">OTHER LITTLE UNIVERSES</span>
        <h1>
          {t("friends")}
          <span className="brand-dot">.</span>
        </h1>
        <p>{t("friendsDescription")}</p>
        <div className="draft-actions">
          <LocaleLink className="button" href="/friends/submit">
            {t("submitFriend")}
          </LocaleLink>
          <LocaleLink className="button secondary" href="/friends/mine">
            {t("myFriends")}
          </LocaleLink>
        </div>
      </div>
      {friends.length ? (
        <div className="project-catalog">
          {friends.slice(0, 20).map((friend) => {
            const url = parseProjectUrl(friend.targetUrl);
            if (!url) return null;
            return (
              <a
                key={friend.id}
                className="panel draft-card project-entry"
                href={url.href}
                target="_blank"
                rel="ugc noopener noreferrer"
              >
                {friend.iconId && (
                  <div className="project-cover">
                    <ArticleImage
                      src={imageUrl(friend.iconId)}
                      alt={friend.title}
                      unavailable={t("imagesUnavailable")}
                    />
                  </div>
                )}
                <h2>{friend.title}</h2>
                <p className="project-summary">{friend.summary}</p>
                <p className="muted">
                  {t("authorLabel", { author: friend.authorName })} · {url.hostname}
                </p>
                <span className="card-action">
                  {t("friendVisit")} <ArrowUpRight size={16} />
                </span>
              </a>
            );
          })}
        </div>
      ) : (
        <section className="panel empty-state">
          <h2>{t("friendsEmpty")}</h2>
        </section>
      )}
      <ArticlePagination page={page} more={friends.length > 20} base="/friends" />
    </>
  );
}
