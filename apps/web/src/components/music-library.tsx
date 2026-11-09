"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Play } from "lucide-react";
import { MusicCard, useMusic } from "@/components/music-provider";
import { useI18n } from "@/i18n/client";
import {
  musicSourceUrl,
  parseMusicSource,
  type MusicSource,
  type MusicTrack,
} from "@/music/source";

export function MusicLibrary({ configured }: { configured: boolean }) {
  const { t } = useI18n();
  const player = useMusic();
  const request = useRef<AbortController | null>(null);
  const [value, setValue] = useState("");
  const [source, setSource] = useState<MusicSource | null>(null);
  const [status, setStatus] = useState<
    "musicLoading" | "musicInvalidLink" | "musicLookupFailed" | "musicNoTracks" | null
  >(null);

  useEffect(() => () => request.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    request.current?.abort();
    const input = parseMusicSource(value);
    setSource(input);
    if (!input) {
      setStatus("musicInvalidLink");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setStatus("musicLoading");
    try {
      const response = await fetch(`/api/music?kind=${input.kind}&id=${input.id}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Music lookup failed");
      const { tracks }: { tracks: MusicTrack[] } = await response.json();
      if (controller.signal.aborted) return;
      if (!tracks.length) {
        setStatus("musicNoTracks");
        return;
      }
      player.load(tracks);
      setStatus(null);
    } catch {
      if (!controller.signal.aborted) setStatus("musicLookupFailed");
    }
  }

  return (
    <div className="music-library">
      <MusicCard full />
      <section className="panel music-library-panel">
        <h2>{t("musicLoadHeading")}</h2>
        <form onSubmit={submit}>
          <label htmlFor="music-link">{t("musicLinkLabel")}</label>
          <input
            id="music-link"
            type="url"
            required
            maxLength={2048}
            placeholder="https://music.163.com/#/song?id=…"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
          />
          <button className="button primary" disabled={!configured || status === "musicLoading"}>
            {t("musicLoadQueue")}
          </button>
        </form>
        <p role="status">
          {t(!configured ? "musicServiceUnavailable" : (status ?? "musicQueueHelp"))}
        </p>
        {source && (
          <a
            className="text-link"
            href={musicSourceUrl(source)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("musicOpenInput")}
          </a>
        )}
        {player.queue.length > 0 && (
          <>
            <h2>{t("musicQueue")}</h2>
            <ol className="music-queue">
              {player.queue.map((track, index) => (
                <li key={track.id}>
                  <button
                    type="button"
                    aria-current={index === player.index ? "true" : undefined}
                    onClick={() => player.select(index)}
                  >
                    <Play size={14} aria-hidden="true" />
                    <span>{track.title}</span>
                    {track.artist && <small>{track.artist}</small>}
                  </button>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </div>
  );
}
