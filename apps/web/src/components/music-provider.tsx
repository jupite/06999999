"use client";

import { useI18n } from "@/i18n/client";
import { LocaleLink } from "@/i18n/link";
import { localePath } from "@/i18n/routing";
import { musicSourceUrl, type MusicTrack } from "@/music/source";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { Music2, Pause, Play, SkipBack, SkipForward, X, Disc3, GripHorizontal } from "lucide-react";
import { usePathname } from "next/navigation";
type Player = {
  queue: MusicTrack[];
  index: number;
  playing: boolean;
  loading: boolean;
  time: number;
  duration: number;
  error: "musicError" | "trackUnavailable" | "";
  load: (tracks: MusicTrack[]) => void;
  select: (index: number) => void;
  seek: (time: number) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
};
const Context = createContext<Player | null>(null);
export function useMusic() {
  return useContext(Context)!;
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const request = useRef<AbortController | null>(null);
  const [queue, setQueue] = useState<MusicTrack[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<Player["error"]>("");

  const resetTrack = useCallback(() => {
    request.current?.abort();
    request.current = null;
    const element = audio.current;
    if (element?.hasAttribute("src")) {
      element.pause();
      element.removeAttribute("src");
      element.load();
    }
    setPlaying(false);
    setLoading(false);
    setTime(0);
    setDuration(0);
    setError("");
  }, []);

  const load = useCallback(
    (tracks: MusicTrack[]) => {
      if (
        tracks.length === queue.length &&
        tracks.every((track, i) => {
          const previous = queue[i];
          return (
            track.id === previous.id &&
            track.title === previous.title &&
            track.artist === previous.artist &&
            track.coverUrl === previous.coverUrl
          );
        })
      )
        return;
      const next = tracks.findIndex((track) => track.id === queue[index]?.id);
      if (next < 0) {
        resetTrack();
        setEngaged(false);
      }
      setQueue(tracks);
      setIndex(Math.max(0, next));
    },
    [queue, index, resetTrack],
  );

  async function play(track: MusicTrack) {
    const element = audio.current;
    if (!element) return;
    setEngaged(true);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      if (!element.hasAttribute("src") || element.error) {
        const response = await fetch(`/api/music?kind=stream&id=${track.id}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Stream lookup failed");
        const { url }: { url: string | null } = await response.json();
        if (controller.signal.aborted) return;
        if (!url) {
          setError("trackUnavailable");
          return;
        }
        element.src = url;
      }
      await element.play();
    } catch {
      if (!controller.signal.aborted) {
        setError(element.error ? "trackUnavailable" : "musicError");
      }
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setLoading(false);
      }
    }
  }

  function select(next: number, start = true) {
    const track = queue[next];
    if (!track) return;
    if (next !== index) {
      resetTrack();
      setIndex(next);
    }
    if (start) void play(track);
  }

  function toggle() {
    const element = audio.current;
    if (!element || !queue[index]) return;
    if (!element.paused || loading) {
      request.current?.abort();
      request.current = null;
      element.pause();
      setLoading(false);
    } else {
      void play(queue[index]);
    }
  }

  function skip(delta: number) {
    if (queue.length > 1) select((index + delta + queue.length) % queue.length, playing || loading);
  }

  return (
    <Context.Provider
      value={{
        queue,
        index,
        playing,
        loading,
        time,
        duration,
        error,
        load,
        select,
        seek: (value) => {
          if (audio.current && duration > 0) {
            audio.current.currentTime = value;
            setTime(value);
          }
        },
        toggle,
        next: () => skip(1),
        previous: () => skip(-1),
      }}
    >
      {children}
      <audio
        ref={audio}
        preload="none"
        onPlay={(event) => setPlaying(!event.currentTarget.paused)}
        onPause={(event) => setPlaying(!event.currentTarget.paused)}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onDurationChange={(event) => {
          const value = event.currentTarget.duration;
          setDuration(Number.isFinite(value) ? value : 0);
        }}
        onError={(event) => {
          if (!event.currentTarget.error) return;
          setPlaying(false);
          setError("trackUnavailable");
        }}
        onEnded={() => {
          setPlaying(false);
          if (index + 1 < queue.length) select(index + 1);
        }}
      />
      {engaged && <FloatingPlayer />}
    </Context.Provider>
  );
}
function elapsed(seconds: number) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function MusicCard({ full = false }: { full?: boolean }) {
  const { t } = useI18n();
  const player = useMusic();
  const track = player.queue[player.index];
  const pause = player.playing || player.loading;
  return (
    <section className={full ? "music-player-inline" : "panel music-card"}>
      {!full && (
        <div className="eyebrow">
          <Music2 size={13} /> MUSIC CORNER
        </div>
      )}
      <div className="music-heading">
        <div className={`record ${player.playing ? "spinning" : ""}`}>
          {track?.coverUrl ? (
            <img src={track.coverUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <Disc3 size={55} />
          )}
        </div>
        <div>
          <h3>{track?.title ?? t("musicHeading")}</h3>
          <p>{track?.artist || t("musicSource")}</p>
        </div>
      </div>
      <div className="music-status" role="status">
        {t(
          player.error ||
            (player.loading ? "musicLoading" : track ? "trackQueued" : "musicQueueEmpty"),
        )}
      </div>
      {track && (
        <div className="music-progress">
          <span>{elapsed(player.time)}</span>
          <input
            type="range"
            aria-label={t("musicProgress")}
            min={0}
            max={player.duration || 1}
            step={0.1}
            disabled={!player.duration}
            value={Math.min(player.time, player.duration)}
            onChange={(event) => player.seek(event.currentTarget.valueAsNumber)}
          />
          <span>{elapsed(player.duration)}</span>
        </div>
      )}
      <div className="player-controls">
        <button
          aria-label={t("previousTrack")}
          disabled={player.queue.length < 2}
          onClick={player.previous}
        >
          <SkipBack size={17} />
        </button>
        <button
          className="play"
          aria-label={pause ? t("pause") : t("play")}
          disabled={!track}
          onClick={player.toggle}
        >
          {pause ? <Pause size={19} /> : <Play size={19} />}
        </button>
        <button
          aria-label={t("nextTrack")}
          disabled={player.queue.length < 2}
          onClick={player.next}
        >
          <SkipForward size={17} />
        </button>
      </div>
      {full && track && player.error && (
        <a
          className="text-link"
          href={musicSourceUrl({ kind: "song", id: track.id })}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("musicOpenSource")}
        </a>
      )}
      {!full && (
        <LocaleLink className="text-link" href="/music">
          {t("musicOpenPlayer")}
        </LocaleLink>
      )}
    </section>
  );
}
function FloatingPlayer() {
  const { locale, t } = useI18n();
  const player = useMusic();
  const path = usePathname();
  const [hidden, setHidden] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  function fitPosition(point: { x: number; y: number }, width: number, height: number) {
    return {
      x: Math.max(0, Math.min(window.innerWidth - width, point.x)),
      y: Math.max(0, Math.min(window.innerHeight - height, point.y)),
    };
  }

  useEffect(() => {
    function fit() {
      const rect = panel.current?.getBoundingClientRect();
      if (rect) setPosition((point) => point && fitPosition(point, rect.width, rect.height));
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [path, hidden]);
  if (!player.queue.length || path === localePath(locale, "/music")) return null;
  if (hidden)
    return (
      <button
        className="restore-player"
        onClick={() => setHidden(false)}
        aria-label={t("expandPlayer")}
      >
        <Music2 size={20} />
      </button>
    );
  return (
    <div
      className="floating-player panel"
      ref={panel}
      style={position ? { left: position.x, top: position.y, bottom: "auto" } : undefined}
    >
      <button
        className="drag-handle"
        aria-label={t("dragPlayer")}
        onPointerDown={(event) => {
          if (event.button !== 0 || !event.isPrimary) return;
          const rect = panel.current?.getBoundingClientRect();
          if (!rect) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          };
        }}
        onPointerMove={(event) => {
          const active = drag.current;
          if (!active || !event.isPrimary) return;
          setPosition(
            fitPosition(
              {
                x: active.left + event.clientX - active.x,
                y: active.top + event.clientY - active.y,
              },
              active.width,
              active.height,
            ),
          );
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      >
        <GripHorizontal size={18} />
      </button>
      <LocaleLink href="/music" title={t("musicOpenPlayer")}>
        {player.queue[player.index]?.title}
      </LocaleLink>
      <button
        onClick={player.previous}
        disabled={player.queue.length < 2}
        aria-label={t("previousTrack")}
      >
        <SkipBack size={16} />
      </button>
      <button
        onClick={player.toggle}
        aria-label={player.playing || player.loading ? t("pause") : t("play")}
      >
        {player.playing || player.loading ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button onClick={player.next} disabled={player.queue.length < 2} aria-label={t("nextTrack")}>
        <SkipForward size={16} />
      </button>
      <button aria-label={t("collapsePlayer")} onClick={() => setHidden(true)}>
        <X size={16} />
      </button>
    </div>
  );
}
