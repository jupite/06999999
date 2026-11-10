import { getI18n } from "@/i18n/server";
import { GitHubLogin, SignOutButton } from "@/components";
import { authConfigured, currentActor } from "@/server/auth";
import { authorize } from "@/server/domain/permissions";
import { LocaleLink } from "@/i18n/link";
import { Moon } from "lucide-react";
export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("signIn") };
}
export const dynamic = "force-dynamic";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { t } = await getI18n();
  const { error } = await searchParams;
  const configured = authConfigured();
  const actor = await currentActor();
  if (actor) {
    const canManage = authorize(actor, "site.manage").allowed;
    return (
      <section className="panel login-panel">
        <h1>{t("signedIn")}</h1>
        <p>
          {actor.banned ? t("accountBanned") : canManage ? t("ownerVerified") : t("githubSignedIn")}
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          {canManage && (
            <LocaleLink className="button" href="/admin">
              {t("goAdmin")}
            </LocaleLink>
          )}
          {!actor.banned && (
            <LocaleLink className="button secondary" href="/my-articles">
              {t("myArticles")}
            </LocaleLink>
          )}
          <SignOutButton />
        </div>
      </section>
    );
  }
  return (
    <section className="panel login-panel">
      <div className="moon-badge">
        <Moon size={30} />
      </div>
      <span className="eyebrow">WELCOME TO OUR LITTLE WORLD</span>
      <h1>{t("loginHeading")}</h1>
      <p>{t("loginDescription")}</p>
      <GitHubLogin configured={configured} />
      {!configured && <p className="notice">{t("loginUnconfigured")}</p>}
      {error && (
        <p className="notice" role="alert">
          {t("loginFailed")}
        </p>
      )}
      <p className="muted">{t("loginRules")}</p>
    </section>
  );
}
