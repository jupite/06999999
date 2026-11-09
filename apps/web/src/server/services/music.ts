import "server-only";
import { parseLyrics } from "@/music/lyrics";
import { musicIdPattern, type MusicSource, type MusicTrack } from "@/music/source";

export const musicQueueLimit = 100;

export function musicConfigured() {
  return Boolean(process.env.NETEASE_MUSIC_API_URL?.trim());
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cdnUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      !url.hostname.endsWith(".music.126.net") ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    url.protocol = "https:";
    return url.href;
  } catch {
    return null;
  }
}

async function musicRequest(path: string, params: Record<string, string>) {
  const base = process.env.NETEASE_MUSIC_API_URL?.trim();
  if (!base) throw new Error("Music service is not configured");
  const url = new URL(base.endsWith("/") ? base : `${base}/`);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid music service URL");
  const endpoint = new URL(path, url);
  endpoint.search = new URLSearchParams(params).toString();
  const response = await fetch(endpoint, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error("Music service request failed");
  const data = object(await response.json());
  if (data.code !== 200) throw new Error("Music service returned an error");
  return data;
}

export async function musicQueue(source: MusicSource): Promise<MusicTrack[]> {
  const result =
    source.kind === "song"
      ? await musicRequest("song/detail", { ids: source.id })
      : await musicRequest("playlist/track/all", { id: source.id, limit: String(musicQueueLimit) });
  if (!Array.isArray(result.songs)) throw new Error("Invalid song list");
  const tracks = new Map<string, MusicTrack>();
  for (const value of result.songs.slice(0, musicQueueLimit)) {
    const song = object(value);
    const id =
      typeof song.id === "number" && Number.isSafeInteger(song.id) ? String(song.id) : song.id;
    if (
      typeof id !== "string" ||
      !musicIdPattern.test(id) ||
      typeof song.name !== "string" ||
      !song.name.trim()
    )
      continue;
    if ((source.kind === "song" && id !== source.id) || tracks.has(id)) continue;
    tracks.set(id, {
      id,
      title: song.name.trim().slice(0, 200),
      artist: (Array.isArray(song.ar) ? song.ar : [])
        .map((value) => object(value).name)
        .filter((name): name is string => typeof name === "string" && Boolean(name.trim()))
        .join(", ")
        .slice(0, 200),
      coverUrl: cdnUrl(object(song.al).picUrl),
    });
  }
  return [...tracks.values()];
}

export async function musicStream(id: string) {
  const result = await musicRequest("song/url/v1", { id, level: "standard" });
  if (!Array.isArray(result.data)) throw new Error("Invalid playback response");
  const track = result.data.map(object).find((value) => String(value.id) === id);
  return track?.code === 200 && track.freeTrialInfo == null ? cdnUrl(track.url) : null;
}

export async function musicLyrics(id: string) {
  const result = await musicRequest("lyric", { id });
  const lyric = object(result.lrc).lyric;
  return typeof lyric === "string" ? parseLyrics(lyric) : [];
}
