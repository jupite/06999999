import { ArticleAccessNotice } from "@/components/server";
import { LocaleLink } from "@/i18n/link";
import { getI18n } from "@/i18n/server";
import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { authorize } from "@/server/domain/permissions";
import { musicConfigured } from "@/server/services/music";
import { listMusicLibrary } from "@/server/services/music-library";
import { importMusic, removeMusic } from "./actions";

export const dynamic = "force-dynamic";

const notices = [
  "musicInvalidLink",
  "musicLookupFailed",
  "musicNoTracks",
  "musicServiceUnavailable",
  "musicSaveFailed",
  "musicImported",
  "musicAlreadyImported",
  "musicRemoved",
] as const;

export default async function AdminMusicPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const { locale, t, system } = await getI18n();
  const actor = await currentActor();
  const access = authorize(actor, "site.manage");
  if (!access.allowed)
    return <ArticleAccessNotice signedIn={!!actor} reason={system(access.reason)} />;

  const tracks = await listMusicLibrary(getDb());
  const configured = musicConfigured();
  const { result } = await searchParams;
  const notice = notices.find((key) => key === result);
  const remove = removeMusic.bind(null, locale);
  return (
    <>
      <LocaleLink href="/admin">{t("backToAdmin")}</LocaleLink>
      <div className="page-heading">
        <h1>{t("manageMusic")}</h1>
      </div>
      <div className="music-library">
        <section className="panel music-library-panel">
          <h2>{t("musicLoadHeading")}</h2>
          <form action={importMusic.bind(null, locale)}>
            <label htmlFor="music-link">{t("musicLinkLabel")}</label>
            <input
              id="music-link"
              name="url"
              type="url"
              required
              maxLength={2048}
              placeholder="https://music.163.com/#/playlist?id=…"
            />
            <button className="button" disabled={!configured}>
              {t("musicImport")}
            </button>
          </form>
          <p>{t(configured ? "musicQueueHelp" : "musicServiceUnavailable")}</p>
          {notice && <p role="status">{t(notice)}</p>}
        </section>
        <section className="panel music-library-panel">
          <h2>{t("musicQueue")}</h2>
          {!tracks.length && <p>{t("musicLibraryEmpty")}</p>}
          <ol className="music-admin-list">
            {tracks.map((track) => (
              <li key={track.id}>
                <span>
                  {track.title}
                  {track.artist && ` · ${track.artist}`}
                </span>
                <form action={remove}>
                  <input type="hidden" name="id" value={track.id} />
                  <button
                    className="button secondary"
                    aria-label={t("musicRemoveTrack", { title: track.title })}
                  >
                    {t("musicRemove")}
                  </button>
                </form>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
