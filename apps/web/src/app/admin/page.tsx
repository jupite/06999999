import { getI18n } from "@/i18n/server";
import { currentActor } from "@/server/auth";
import { authorize } from "@/server/domain/permissions";
import Link from "next/link";
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
        <Link className="button" href="/login">
          {actor ? t("viewAccount") : t("goLogin")}
        </Link>
      </section>
    );
  return (
    <section className="panel empty-state">
      <h1>{t("admin")}</h1>
      <Link className="button" href="/admin/reviews">
        {t("articleReview")}
      </Link>
      <p>{t("adminDescription")}</p>
    </section>
  );
}
