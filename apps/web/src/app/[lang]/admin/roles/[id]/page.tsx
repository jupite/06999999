import { notFound } from "next/navigation";
import { ArticleAccessNotice } from "@/components/server";
import { RoleEditor } from "@/components";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { authorize } from "@/server/domain/permissions";
import { getRole, RoleError } from "@/server/services/roles";
export const dynamic = "force-dynamic";
export default async function RolePage({ params }: { params: Promise<{ id: string }> }) {
  const { t, system } = await getI18n(),
    actor = await currentActor(),
    access = authorize(actor, "site.manage");
  if (!access.allowed)
    return <ArticleAccessNotice signedIn={!!actor} reason={system(access.reason)} />;
  let role;
  try {
    role = await getRole(getDb(), actor, (await params).id);
  } catch (error) {
    if (error instanceof RoleError && error.status === 404) notFound();
    throw error;
  }
  return (
    <>
      <LocaleLink href="/admin/roles">{t("roleBack")}</LocaleLink>
      <div className="page-heading">
        <h1>{role.name}</h1>
        <p>{t("roleHelp")}</p>
        <p>{t("roleVersion", { version: role.version, count: role.userCount })}</p>
      </div>
      <RoleEditor role={role} />
    </>
  );
}
