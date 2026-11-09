import { musicIdPattern } from "@/music/source";
import { getDb } from "@/server/db";
import { musicConfigured, musicLyrics, musicStream } from "@/server/services/music";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const id = searchParams.get("id");
  if (!id || !musicIdPattern.test(id) || (kind !== "lyrics" && kind !== "stream"))
    return new Response(null, { status: 400 });
  if (!musicConfigured()) return new Response(null, { status: 503 });
  const headers = { "Cache-Control": "no-store" };
  try {
    if (!(await getDb().musicLibraryTrack.findUnique({ where: { id }, select: { id: true } })))
      return new Response(null, { status: 404, headers });
    return kind === "stream"
      ? Response.json({ url: await musicStream(id) }, { headers })
      : Response.json({ lines: await musicLyrics(id) }, { headers });
  } catch {
    return new Response(null, { status: 502 });
  }
}
