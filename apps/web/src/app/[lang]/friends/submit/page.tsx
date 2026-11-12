import { getDb } from "@/server/db";
import { notFound } from "next/navigation";
import { readRejectedSubmission, ResubmissionError } from "@/server/services/resubmission";
import { imageUrl } from "@/media/urls";
import { randomUUID } from "node:crypto";
import { ArticleAccessNotice } from "@/components/server";
import { FriendForm } from "@/components";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";
import { currentActor } from "@/server/auth";
import { authorize } from "@/server/domain/permissions";
export const dynamic = "force-dynamic";
export default async function SubmitFriendPage({
  searchParams,
}: {
  searchParams: Promise<{ copy?: string }>;
}) {
  const { t, system } = await getI18n(),
    actor = await currentActor(),
    access = authorize(actor, "friend.submit");
  if (!actor || !access.allowed)
    return <ArticleAccessNotice signedIn={!!actor} reason={system(access.reason)} />;
  const { copy } = await searchParams;
  let source;
  if (copy) {
    try {
      source = await readRejectedSubmission(getDb(), actor, copy, "FRIEND_LINK");
    } catch (error) {
      if (error instanceof ResubmissionError)
        return <ArticleAccessNotice signedIn={!!actor} reason={system(error.key)} />;
      throw error;
    }
    if (!source) notFound();
  }
  const revision = source?.revisions[0];
  return (
    <>
      <LocaleLink href="/friends">{t("backToFriends")}</LocaleLink>
      <div className="page-heading">
        <h1>{t("submitFriend")}</h1>
        <p>{t("friendSubmitHelp")}</p>
      </div>
      {source && <p className="notice">{t("resubmissionHelp")}</p>}
      {revision?.reviews[0]?.reason && (
        <p className="notice">{t("friendRejection", { reason: revision.reviews[0].reason })}</p>
      )}
      <FriendForm
        key={source?.id ?? "new"}
        initial={
          source && revision
            ? {
                sourceId: source.id,
                title: revision.title,
                summary: revision.summary,
                url: revision.targetUrl ?? "",
                iconUrl: revision.media[0] ? imageUrl(revision.media[0].id) : "",
              }
            : undefined
        }
        submissionId={randomUUID()}
        owner={actor.role === "OWNER"}
        canUpload={authorize(actor, "image.upload").allowed}
      />
    </>
  );
}
