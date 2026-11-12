import { notFound } from "next/navigation";
import { readRejectedSubmission, ResubmissionError } from "@/server/services/resubmission";
import { imageUrl } from "@/media/urls";
import { randomUUID } from "node:crypto";
import { ArticleAccessNotice } from "@/components/server";
import { PhotoForm } from "@/components";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { authorize } from "@/server/domain/permissions";
import { listArticleCategories } from "@/server/services/article-taxonomy";
export const dynamic = "force-dynamic";
export default async function SubmitPhotoPage({
  searchParams,
}: {
  searchParams: Promise<{ copy?: string }>;
}) {
  const { t, system } = await getI18n(),
    actor = await currentActor();
  for (const capability of ["photo.submit", "image.upload"] as const) {
    const access = authorize(actor, capability);
    if (!access.allowed)
      return <ArticleAccessNotice signedIn={!!actor} reason={system(access.reason)} />;
  }
  const { copy } = await searchParams;
  let source;
  if (copy) {
    try {
      source = await readRejectedSubmission(getDb(), actor, copy, "PHOTO");
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
      <LocaleLink href="/photos">{t("backToPhotos")}</LocaleLink>
      <div className="page-heading">
        <h1>{t("submitPhoto")}</h1>
        <p>{t("photoSubmitHelp")}</p>
      </div>
      {source && <p className="notice">{t("resubmissionHelp")}</p>}
      {revision?.reviews[0]?.reason && (
        <p className="notice">{t("photoRejection", { reason: revision.reviews[0].reason })}</p>
      )}
      <PhotoForm
        key={source?.id ?? "new"}
        initial={
          source && revision
            ? {
                sourceId: source.id,
                title: revision.title,
                summary: revision.summary,
                categoryId: revision.categoryId,
                tagText: revision.tags.map((tag) => tag.name).join(", "),
                imageUrl: revision.media[0] ? imageUrl(revision.media[0].id) : "",
              }
            : undefined
        }
        submissionId={randomUUID()}
        owner={actor!.role === "OWNER"}
        categories={await listArticleCategories(getDb())}
      />
    </>
  );
}
