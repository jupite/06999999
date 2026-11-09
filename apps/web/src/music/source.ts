export type MusicSource = { kind: "song" | "playlist"; id: string };
export type MusicTrack = { id: string; title: string; artist: string; coverUrl: string | null };

export const musicIdPattern = /^[1-9][0-9]{0,17}$/;

export function parseMusicSource(value: string): MusicSource | null {
  if (value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !["music.163.com", "y.music.163.com"].includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password
    )
      return null;
    const target =
      url.pathname === "/" && url.hash.startsWith("#/")
        ? new URL(url.hash.slice(1), url.origin)
        : url;
    if (target.origin !== url.origin) return null;
    const kind = target.pathname.replace(/^\/m\//, "/").slice(1);
    const id = target.searchParams.get("id");
    return (kind === "song" || kind === "playlist") && id && musicIdPattern.test(id)
      ? { kind, id }
      : null;
  } catch {
    return null;
  }
}

export function musicSourceUrl({ kind, id }: MusicSource) {
  return `https://music.163.com/#/${kind}?id=${id}`;
}
