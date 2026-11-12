import { ArticleAccessNotice } from "@/components/server";
import { RoleEditor } from "@/components";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { authorize } from "@/server/domain/permissions";
import { listRoles } from "@/server/services/roles";
export const dynamic = "force-dynamic";
export default async function RolesPage() {
  const { t, system } = await getI18n(),
    actor = await currentActor(),
    access = authorize(actor, "site.manage");
  if (!access.allowed)
    return <ArticleAccessNotice signedIn={!!actor} reason={system(access.reason)} />;
  const roles = await listRoles(getDb(), actor);
  return (
    <>
      <div className="page-heading">
        <h1>{t("roleSettings")}</h1>
        <p>{t("roleHelp")}</p>
      </div>
      <div className="draft-list">
        {roles.map((role) => (
          <article className="panel draft-card" key={role.id}>
            <h2>
              <LocaleLink href={`/admin/roles/${role.id}`}>{role.name}</LocaleLink>
            </h2>
            <p>{t("roleVersion", { version: role.version, count: role.userCount })}</p>
          </article>
        ))}
      </div>
      {!roles.length && <p>{t("roleEmpty")}</p>}
      <h2>{t("roleNew")}</h2>
      <RoleEditor />
    </>
  );
}
