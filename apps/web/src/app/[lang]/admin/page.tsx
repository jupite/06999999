import { getI18n } from "@/i18n/server";
import { currentActor } from "@/server/auth";
import { authorize } from "@/server/domain/permissions";
import { LocaleLink } from "@/i18n/link";
import { AdminOverview } from "@/components/server";
import { getDb } from "@/server/db";
import { getAdminOverview } from "@/server/services/admin-overview";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const { t, system } = await getI18n();
  const actor = await currentActor();
  const access = authorize(actor, "site.manage");
  if (!access.allowed)
    return (
      <section className="panel empty-state">
        <h1>{actor ? t("noAdminAccess") : t("adminEntry")}</h1>
        <p>{actor ? t("adminDenied", { reason: system(access.reason) }) : system(access.reason)}</p>
        <LocaleLink className="button" href="/login">
          {actor ? t("viewAccount") : t("goLogin")}
        </LocaleLink>
      </section>
    );
  const overview = await getAdminOverview(getDb(), actor);
  return <AdminOverview overview={overview} />;
}
