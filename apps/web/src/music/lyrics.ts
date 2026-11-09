export type LyricLine = { time: number | null; text: string };

export function parseLyrics(value: string): LyricLine[] {
  const lines = value.slice(0, 100_000).split(/\r?\n/);
  const offset = lines
    .map((line) => /^\[offset:([+-]?\d{1,7})\]$/i.exec(line.trim()))
    .find(Boolean);
  const seconds = offset ? Number(offset[1]) / 1000 : 0;
  const timed: LyricLine[] = [];
  const plain: LyricLine[] = [];
  for (const line of lines) {
    const stamps = [...line.matchAll(/\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)];
    const text = line.replace(/^\s*(?:\[[^\]]+\]\s*)+/, "").trim();
    if (!text) continue;
    if (!stamps.length) plain.push({ time: null, text });
    for (const [, minutes, whole, fraction] of stamps) {
      const time = 60 * Number(minutes) + Number(whole) + Number(`0.${fraction ?? "0"}`);
      timed.push({ time: Math.max(0, time - seconds), text });
    }
  }
  return timed.length
    ? timed.sort((a, b) => (a.time ?? 0) - (b.time ?? 0)).slice(0, 1500)
    : plain.slice(0, 1500);
}
