import { authorize } from "@/server/domain/permissions";
import { ArticleAccessNotice, ArticlePagination, ArticleTime } from "@/components/server";
import { ArticleImage, ContentWithdrawal } from "@/components";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";
import { imageUrl } from "@/media/urls";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { articlePage, articleStateLabels } from "@/server/domain/articles";
import { parseProjectUrl } from "@/server/domain/project-sites";
import { listMyFriends } from "@/server/services/friends";
export const dynamic = "force-dynamic";
export default async function MyFriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; submitted?: string }>;
}) {
  const { t, system } = await getI18n(),
    actor = await currentActor();
  if (!actor) return <ArticleAccessNotice signedIn={false} reason={system("loginRequired")} />;
  const query = await searchParams,
    page = articlePage(query.page),
    friends = await listMyFriends(getDb(), actor, page);
  return (
    <>
      <div className="page-heading">
        <h1>{t("myFriends")}</h1>
        <div className="draft-actions">
          <LocaleLink href="/friends">{t("backToFriends")}</LocaleLink>
          <LocaleLink className="button" href="/friends/submit">
            {t("submitFriend")}
          </LocaleLink>
        </div>
      </div>
      {query.submitted === "1" && <p role="status">{t("friendSubmitted")}</p>}
      <div className="project-catalog">
        {friends.slice(0, 20).map((friend) => {
          const revision = friend.revisions[0];
          if (!revision) return null;
          return (
            <article className="panel draft-card" key={friend.id}>
              <h2>{revision.title}</h2>
              {revision.state === "REJECTED" &&
                authorize(actor, "content.editOwn").allowed &&
                authorize(actor, "friend.submit").allowed &&
                true && (
                  <LocaleLink
                    className="button secondary"
                    href={`/friends/submit?copy=${friend.id}`}
                  >
                    {t("editResubmission")}
                  </LocaleLink>
                )}
              <p>
                {parseProjectUrl(revision.targetUrl) ? (
                  <a
                    href={parseProjectUrl(revision.targetUrl)!.href}
                    target="_blank"
                    rel="ugc noopener noreferrer"
                  >
                    {revision.targetUrl}
                  </a>
                ) : (
                  revision.targetUrl
                )}
              </p>
              <p>
                {t(articleStateLabels[revision.state])} · <ArticleTime value={friend.createdAt} />
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
                    id={friend.id}
                    version={revision.version}
                    kind="FRIEND_LINK"
                    state={revision.state}
                    title={revision.title}
                  />
                )}
              {revision.state === "REJECTED" && (
                <p>{t("friendRejection", { reason: revision.reviews[0]?.reason ?? "" })}</p>
              )}
            </article>
          );
        })}
      </div>
      {!friends.length && (
        <section className="panel empty-state">
          <h2>{t("myFriendsEmpty")}</h2>
        </section>
      )}
      <ArticlePagination page={page} more={friends.length > 20} base="/friends/mine" />
    </>
  );
}
