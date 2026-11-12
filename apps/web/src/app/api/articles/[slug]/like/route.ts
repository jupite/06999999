import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { LikeError, readArticleLike, setArticleLike } from "@/server/services/likes";
type Context = { params: Promise<{ slug: string }> };
const headers = { "Cache-Control": "private, no-store" };
async function handle(request: Request, context: Context, liked?: boolean) {
  if (liked !== undefined) {
    const origin = request.headers.get("origin");
    const site = request.headers.get("sec-fetch-site");
    if (site ? site !== "same-origin" : origin && origin !== new URL(request.url).origin)
      return Response.json({ error: "permissionDenied" }, { status: 403, headers });
  }
  try {
    const { slug } = await context.params;
    if (!slug || slug.length > 200) throw new LikeError("likeArticleMissing", 404);
    const actor = await currentActor();
    const result =
      liked === undefined
        ? await readArticleLike(getDb(), actor, slug)
        : await setArticleLike(getDb(), actor, slug, liked);
    return Response.json(result, { headers });
  } catch (error) {
    if (error instanceof LikeError)
      return Response.json({ error: error.key }, { status: error.status, headers });
    console.error("Article like failed", error);
    return Response.json({ error: "likeRequestFailed" }, { status: 500, headers });
  }
}
export function GET(request: Request, context: Context) {
  return handle(request, context);
}
export function PUT(request: Request, context: Context) {
  return handle(request, context, true);
}
export function DELETE(request: Request, context: Context) {
  return handle(request, context, false);
}
