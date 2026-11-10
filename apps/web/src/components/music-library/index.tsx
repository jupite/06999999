"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { getMusicLyrics } from "@/api";
import { MusicCard, useMusic } from "../music-provider";
import { useI18n } from "@/i18n/client";
import type { LyricLine } from "@/music/lyrics";
import type { MusicTrack } from "@/music/source";

export function MusicLibrary({ tracks }: { tracks: MusicTrack[] }) {
  const { t } = useI18n();
  const { queue, index, load, select, time } = useMusic();
  const selected = queue[index]?.id ?? tracks[0]?.id;

  useEffect(() => load(tracks), [tracks, load]);

  return (
    <div className="music-library">
      <section className="panel music-library-panel">
        <h2>{t("musicQueue")}</h2>
        {tracks.length === 0 && <p>{t("musicLibraryEmpty")}</p>}
        <ol className="music-queue">
          {tracks.map((track) => (
            <li key={track.id}>
              <button
                type="button"
                aria-current={track.id === selected ? "true" : undefined}
                onClick={() => select(queue.findIndex((item) => item.id === track.id))}
              >
                <Play size={14} aria-hidden="true" />
                <span>{track.title}</span>
                {track.artist && <small>{track.artist}</small>}
              </button>
            </li>
          ))}
        </ol>
      </section>
      <section className="panel music-library-panel">
        <h2>{t("musicLyrics")}</h2>
        {tracks.length > 0 && <MusicCard full />}
        <MusicLyrics key={selected} id={selected} time={time} />
      </section>
    </div>
  );
}

function MusicLyrics({ id, time }: { id?: string; time: number }) {
  const { t } = useI18n();
  const [lines, setLines] = useState<LyricLine[] | null>(null);
  const [failed, setFailed] = useState(false);
  const panel = useRef<HTMLOListElement>(null);
  const activeLine = useRef<HTMLLIElement>(null);
  const active = lines?.findLastIndex((line) => line.time !== null && line.time <= time) ?? -1;

  useEffect(() => {
    if (!id) return;
    const request = new AbortController();
    async function loadLyrics(trackId: string) {
      try {
        const lyrics = await getMusicLyrics(trackId, request.signal);
        if (!request.signal.aborted) setLines(lyrics);
      } catch {
        if (!request.signal.aborted) setFailed(true);
      }
    }
    void loadLyrics(id);
    return () => request.abort();
  }, [id]);

  useEffect(() => {
    const line = activeLine.current;
    const list = panel.current;
    if (line && list) list.scrollTop = line.offsetTop - (list.clientHeight - line.offsetHeight) / 2;
  }, [active]);

  return (
    <>
      {lines?.length ? (
        <ol className="music-lyrics" ref={panel}>
          {lines.map((line, i) => (
            <li
              key={i}
              ref={i === active ? activeLine : null}
              aria-current={i === active ? "true" : undefined}
            >
              {line.text}
            </li>
          ))}
        </ol>
      ) : (
        <p role="status">
          {t(
            !id
              ? "musicLyricsSelect"
              : failed
                ? "musicLyricsUnavailable"
                : lines
                  ? "musicLyricsEmpty"
                  : "musicLoading",
          )}
        </p>
      )}
    </>
  );
}
