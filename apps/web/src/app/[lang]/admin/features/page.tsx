import { ArticleAccessNotice } from "@/components/server";
import { FeatureSwitch } from "@/components";
import { getI18n } from "@/i18n/server";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { authorize } from "@/server/domain/permissions";
import { listFeatures } from "@/server/services/features";
import { capabilityLabels } from "../users/labels";
import styles from "@/components/admin-shell/admin.module.css";
export const dynamic = "force-dynamic";
export default async function FeaturesPage() {
  const { t, system } = await getI18n(),
    actor = await currentActor(),
    access = authorize(actor, "site.manage");
  if (!access.allowed)
    return <ArticleAccessNotice signedIn={!!actor} reason={system(access.reason)} />;
  const features = await listFeatures(getDb(), actor);
  return (
    <>
      <div className="page-heading">
        <h1>{t("featureSettings")}</h1>
        <p>{t("featureSettingsHelp")}</p>
      </div>
      <section className="panel">
        <div
          className={styles.tableWrap}
          role="region"
          tabIndex={0}
          aria-label={t("featureSettings")}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">{t("userCapability")}</th>
                <th scope="col">{t("featureStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature) => (
                <tr key={feature.key}>
                  <td>
                    <span>{t(capabilityLabels[feature.key])}</span>
                    <small>{feature.key}</small>
                  </td>
                  <td>
                    <FeatureSwitch feature={feature} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
