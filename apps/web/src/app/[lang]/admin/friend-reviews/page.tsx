import { ArticleAccessNotice, ArticlePagination, ArticleTime } from "@/components/server";
import { ArticleImage, FriendReviewForm } from "@/components";
import { getI18n } from "@/i18n/server";
import { imageUrl } from "@/media/urls";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { authorize } from "@/server/domain/permissions";
import { articlePage } from "@/server/domain/articles";
import { parseProjectUrl } from "@/server/domain/project-sites";
import { listPendingFriends } from "@/server/services/friends";
export const dynamic = "force-dynamic";
export default async function FriendReviewsPage({
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
    friends = await listPendingFriends(getDb(), actor, page);
  return (
    <>
      <div className="page-heading">
        <h1>{t("friendReviews")}</h1>
        <p>{t("friendReviewHelp")}</p>
      </div>
      <div className="draft-list">
        {friends.slice(0, 20).map((friend) => {
          const revision = friend.revisions[0];
          if (!revision) return null;
          return (
            <article className="panel draft-card" key={friend.id}>
              <h2>{revision.title}</h2>
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
                {t("authorLabel", { author: friend.author.name })} ·{" "}
                <ArticleTime value={friend.createdAt} />
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
              <FriendReviewForm id={friend.id} version={revision.version} />
            </article>
          );
        })}
      </div>
      {!friends.length && (
        <section className="panel empty-state">
          <h2>{t("friendReviewsEmpty")}</h2>
        </section>
      )}
      <ArticlePagination page={page} more={friends.length > 20} base="/admin/friend-reviews" />
    </>
  );
}
