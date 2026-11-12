import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { articlePage } from "@/server/domain/articles";
import {
  CommentError,
  listArticleComments,
  submitArticleComment,
} from "@/server/services/comments";
type Context = { params: Promise<{ slug: string }> };
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  if (error instanceof CommentError)
    return Response.json({ error: error.key }, { status: error.status, headers });
  console.error("Article comments failed", error);
  return Response.json({ error: "commentRequestFailed" }, { status: 500, headers });
}
export async function GET(request: Request, context: Context) {
  try {
    const { slug } = await context.params;
    if (!slug || slug.length > 200) throw new CommentError("likeArticleMissing", 404);
    const page = articlePage(new URL(request.url).searchParams.get("page"));
    const rows = await listArticleComments(getDb(), slug, page);
    return Response.json(
      { comments: rows.slice(0, 20), more: rows.length > 20, page },
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, context: Context) {
  const site = request.headers.get("sec-fetch-site"),
    origin = request.headers.get("origin");
  if (site ? site !== "same-origin" : origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "permissionDenied" }, { status: 403, headers });
  try {
    const actor = await currentActor();
    if (!actor) throw new CommentError("loginRequired", 401);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new CommentError("invalidComment");
    const reader = request.body?.getReader();
    if (!reader) throw new CommentError("invalidComment");
    let length = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 16384) {
          await reader.cancel();
          throw new CommentError("invalidComment", 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    let input: unknown;
    try {
      input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new CommentError("invalidComment");
    }
    const { slug } = await context.params;
    const result = await getDb().$transaction((tx) => submitArticleComment(tx, actor, slug, input));
    return Response.json(result, { status: 200, headers });
  } catch (error) {
    return failure(error);
  }
}
