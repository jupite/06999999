import { ArticleAccessNotice } from "@/components/article-shared";
import { LocaleLink } from "@/i18n/link";
import { localePath } from "@/i18n/routing";
import { getI18n } from "@/i18n/server";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { bytesPerMib, maxQuotaMib, maxUploadMib } from "@/server/domain/media";
import { authorize } from "@/server/domain/permissions";
import { isGithubId } from "@/server/services/media-settings";
import { updateMediaSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function MediaSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ githubId?: string; result?: string }>;
}) {
  const { locale, t, system } = await getI18n();
  const actor = await currentActor();
  const access = authorize(actor, "site.manage");
  if (!access.allowed)
    return <ArticleAccessNotice signedIn={!!actor} reason={system(access.reason)} />;

  const query = await searchParams;
  const githubId = isGithubId(query.githubId) ? query.githubId : undefined;
  const db = getDb();
  const [settings, storage, user] = await Promise.all([
    db.siteSettings.findUnique({ where: { id: "site" } }),
    db.media.aggregate({ _sum: { bytes: true } }),
    githubId
      ? db.user.findUnique({
          where: { githubId },
          include: { quota: true, permissions: { where: { capability: "image.upload" } } },
        })
      : null,
  ]);
  const action = updateMediaSettings.bind(null, locale);
  const bytes = new Intl.NumberFormat(locale, { style: "unit", unit: "byte" });
  const usage = (used: bigint, limit: bigint) =>
    t("mediaUsage", {
      used: bytes.format(used),
      remaining: bytes.format(limit > used ? limit - used : 0n),
    });
  const mib = (value: bigint = 0n) => String(value / bytesPerMib);
  const effect = user?.permissions[0]?.effect;
  const enabled = effect === "ALLOW" || (!effect && githubId === process.env.OWNER_GITHUB_ID);
  const result = query.result;
  const error =
    result === "invalidMediaQuota" ||
    result === "mediaUserMissing" ||
    result === "mediaSettingsFailed"
      ? system(result)
      : null;

  return (
    <>
      <LocaleLink href="/admin">{t("backToAdmin")}</LocaleLink>
      <div className="page-heading">
        <h1>{t("mediaSettings")}</h1>
        <p>{t("mediaSettingsHelp")}</p>
      </div>
      {result === "saved" && <p role="status">{t("mediaSettingsSaved")}</p>}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <div className="draft-list">
        <form action={action} className="panel draft-card">
          <input type="hidden" name="scope" value="site" />
          {githubId && <input type="hidden" name="githubId" value={githubId} />}
          <h2>{t("siteMediaLimits")}</h2>
          <p>{usage(storage._sum.bytes ?? 0n, settings?.totalMediaLimitBytes ?? 0n)}</p>
          <label className="draft-title">
            {t("singleImageLimit")}
            <input
              name="fileMib"
              type="number"
              min="0"
              max={maxUploadMib}
              step="1"
              required
              defaultValue={mib(settings?.maxImageBytes)}
            />
          </label>
          <label className="draft-title">
            {t("siteMediaLimit")}
            <input
              name="siteMib"
              type="number"
              min="0"
              max={maxQuotaMib}
              step="1"
              required
              defaultValue={mib(settings?.totalMediaLimitBytes)}
            />
          </label>
          <div className="draft-actions">
            <button type="submit" className="button">
              {t("saveMediaSettings")}
            </button>
          </div>
        </form>
        <section className="panel draft-card">
          <h2>{t("userMediaLimits")}</h2>
          <form method="get" action={localePath(locale, "/admin/media")}>
            <label className="draft-title">
              {t("githubNumericId")}
              <input
                name="githubId"
                inputMode="numeric"
                pattern="[0-9]{1,20}"
                required
                defaultValue={githubId ?? ""}
              />
            </label>
            <div className="draft-actions">
              <button type="submit" className="button secondary">
                {t("findMediaUser")}
              </button>
            </div>
          </form>
          {githubId && !user && <p className="notice">{system("mediaUserMissing")}</p>}
          {user && (
            <form action={action} key={user.id}>
              <input type="hidden" name="scope" value="user" />
              <input type="hidden" name="githubId" value={user.githubId} />
              <h3>{user.name}</h3>
              <p>
                {usage(
                  (user.quota?.usedBytes ?? 0n) + (user.quota?.reservedBytes ?? 0n),
                  user.quota?.limitBytes ?? 0n,
                )}
              </p>
              <label>
                <input name="enabled" type="checkbox" defaultChecked={enabled} />{" "}
                {t("enableImageUpload")}
              </label>
              <label className="draft-title">
                {t("userMediaLimit")}
                <input
                  name="userMib"
                  type="number"
                  min="0"
                  max={maxQuotaMib}
                  step="1"
                  required
                  defaultValue={mib(user.quota?.limitBytes)}
                />
              </label>
              <div className="draft-actions">
                <button type="submit" className="button">
                  {t("saveMediaSettings")}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
