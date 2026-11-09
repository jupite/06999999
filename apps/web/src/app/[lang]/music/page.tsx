import { MusicLibrary } from "@/components/music-library";
import { getI18n } from "@/i18n/server";
import { getDb } from "@/server/db";
import { listMusicLibrary } from "@/server/services/music-library";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("music") };
}

export default async function MusicPage() {
  const { t } = await getI18n();
  const tracks = process.env.DATABASE_URL ? await listMusicLibrary(getDb()) : [];
  return (
    <>
      <div className="page-heading">
        <h1>
          {t("music")}
          <span className="brand-dot">.</span>
        </h1>
        <p>{t("musicDescription")}</p>
      </div>
      <MusicLibrary tracks={tracks} />
    </>
  );
}
