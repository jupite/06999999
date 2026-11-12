import { randomUUID } from "node:crypto";
import { ArticleAccessNotice } from "@/components/server";
import { FriendForm } from "@/components";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";
import { currentActor } from "@/server/auth";
import { authorize } from "@/server/domain/permissions";
export const dynamic = "force-dynamic";
export default async function SubmitFriendPage() {
  const { t, system } = await getI18n(),
    actor = await currentActor(),
    access = authorize(actor, "friend.submit");
  if (!actor || !access.allowed)
    return <ArticleAccessNotice signedIn={!!actor} reason={system(access.reason)} />;
  return (
    <>
      <LocaleLink href="/friends">{t("backToFriends")}</LocaleLink>
      <div className="page-heading">
        <h1>{t("submitFriend")}</h1>
        <p>{t("friendSubmitHelp")}</p>
      </div>
      <FriendForm
        submissionId={randomUUID()}
        owner={actor.role === "OWNER"}
        canUpload={authorize(actor, "image.upload").allowed}
      />
    </>
  );
}
