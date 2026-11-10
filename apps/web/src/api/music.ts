import type { LyricLine } from "@/music/lyrics";

async function requestMusic(kind: "lyrics" | "stream", id: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ kind, id });
  const response = await fetch(`/api/music?${query}`, { signal });
  if (!response.ok) throw new Error(`Music ${kind} lookup failed`);
  return response;
}

export async function getMusicLyrics(id: string, signal?: AbortSignal) {
  const response = await requestMusic("lyrics", id, signal);
  const result: { lines: LyricLine[] } = await response.json();
  return result.lines;
}

export async function getMusicStream(id: string, signal?: AbortSignal) {
  const response = await requestMusic("stream", id, signal);
  const result: { url: string | null } = await response.json();
  return result.url;
}
