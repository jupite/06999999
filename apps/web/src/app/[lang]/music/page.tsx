import { MusicLibrary } from "@/components/music-library";
import { getI18n } from "@/i18n/server";
import { musicConfigured } from "@/server/services/music";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("music") };
}

export default async function MusicPage() {
  const { t } = await getI18n();
  return (
    <>
      <div className="page-heading">
        <h1>
          {t("music")}
          <span className="brand-dot">.</span>
        </h1>
        <p>{t("musicDescription")}</p>
      </div>
      <MusicLibrary configured={musicConfigured()} />
    </>
  );
}
