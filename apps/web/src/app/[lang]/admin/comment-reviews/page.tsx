import { ArticleAccessNotice, ArticlePagination, ArticleTime } from "@/components/server";
import { CommentReviewForm } from "@/components";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { articlePage } from "@/server/domain/articles";
import { authorize } from "@/server/domain/permissions";
import { listPendingComments } from "@/server/services/comments";
export const dynamic = "force-dynamic";
export default async function CommentReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { t, system } = await getI18n();
  const actor = await currentActor(),
    access = authorize(actor, "site.manage");
  if (!access.allowed)
    return <ArticleAccessNotice signedIn={!!actor} reason={system(access.reason)} />;
  const page = articlePage((await searchParams).page),
    comments = await listPendingComments(getDb(), actor, page);
  return (
    <>
      <div className="page-heading">
        <h1>{t("commentReviews")}</h1>
        <p>{t("commentReviewHelp")}</p>
      </div>
      <div className="draft-list">
        {comments.slice(0, 20).map((comment) => (
          <article key={comment.id} className="panel draft-card">
            <h2>
              <LocaleLink href={`/articles/${comment.content.slug}`}>
                {comment.content.revisions[0]?.title}
              </LocaleLink>
            </h2>
            <p>
              {t("authorLabel", { author: comment.author.name })} ·{" "}
              <ArticleTime value={comment.createdAt} />
            </p>
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{comment.body}</p>
            <CommentReviewForm id={comment.id} version={comment.version} />
          </article>
        ))}
      </div>
      {!comments.length && (
        <section className="panel empty-state">
          <h2>{t("commentReviewsEmpty")}</h2>
        </section>
      )}
      <ArticlePagination page={page} more={comments.length > 20} base="/admin/comment-reviews" />
    </>
  );
}
