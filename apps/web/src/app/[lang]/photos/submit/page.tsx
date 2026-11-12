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
export default async function SubmitPhotoPage() {
  const { t, system } = await getI18n(),
    actor = await currentActor();
  for (const capability of ["photo.submit", "image.upload"] as const) {
    const access = authorize(actor, capability);
    if (!access.allowed)
      return <ArticleAccessNotice signedIn={!!actor} reason={system(access.reason)} />;
  }
  return (
    <>
      <LocaleLink href="/photos">{t("backToPhotos")}</LocaleLink>
      <div className="page-heading">
        <h1>{t("submitPhoto")}</h1>
        <p>{t("photoSubmitHelp")}</p>
      </div>
      <PhotoForm
        submissionId={randomUUID()}
        owner={actor!.role === "OWNER"}
        categories={await listArticleCategories(getDb())}
      />
    </>
  );
}
