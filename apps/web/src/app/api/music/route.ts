import { musicIdPattern } from "@/music/source";
import { musicConfigured, musicQueue, musicStream } from "@/server/services/music";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const id = searchParams.get("id");
  if (
    !id ||
    !musicIdPattern.test(id) ||
    (kind !== "song" && kind !== "playlist" && kind !== "stream")
  )
    return new Response(null, { status: 400 });
  if (!musicConfigured()) return new Response(null, { status: 503 });
  const headers = { "Cache-Control": "no-store" };
  try {
    return kind === "stream"
      ? Response.json({ url: await musicStream(id) }, { headers })
      : Response.json({ tracks: await musicQueue({ kind, id }) }, { headers });
  } catch {
    return new Response(null, { status: 502 });
  }
}
