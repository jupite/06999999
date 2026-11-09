import { randomUUID } from "node:crypto";
import { ArticleAccessNotice } from "@/components/article-shared";
import { ProjectForm } from "@/components/project-form";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";
import { currentActor } from "@/server/auth";
import { authorize } from "@/server/domain/permissions";

export const dynamic = "force-dynamic";

export default async function SubmitProjectPage() {
  const { t, system } = await getI18n();
  const actor = await currentActor();
  const access = authorize(actor, "project.submit");
  if (!actor || !access.allowed)
    return <ArticleAccessNotice signedIn={!!actor} reason={system(access.reason)} />;
  return (
    <>
      <LocaleLink href="/projects">{t("backToProjects")}</LocaleLink>
      <div className="page-heading">
        <h1>{t("submitProject")}</h1>
        <p>{t("projectSubmissionHelp")}</p>
      </div>
      <ProjectForm
        submissionId={randomUUID()}
        owner={actor.role === "OWNER"}
        canUpload={authorize(actor, "image.upload").allowed}
      />
    </>
  );
}
