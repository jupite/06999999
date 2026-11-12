import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import {
  LikeError,
  readContentLike,
  setContentLike,
  likeMissingKey,
  type LikeKind,
} from "@/server/services/likes";
const headers = { "Cache-Control": "private, no-store" };
export async function handleLikeRequest(
  request: Request,
  reference: string,
  kind: LikeKind,
  liked?: boolean,
) {
  if (liked !== undefined) {
    const origin = request.headers.get("origin");
    const site = request.headers.get("sec-fetch-site");
    if (site ? site !== "same-origin" : origin && origin !== new URL(request.url).origin)
      return Response.json({ error: "permissionDenied" }, { status: 403, headers });
  }
  try {
    if (!reference || reference.length > 200) throw new LikeError(likeMissingKey(kind), 404);
    const actor = await currentActor();
    const result =
      liked === undefined
        ? await readContentLike(getDb(), actor, reference, kind)
        : await setContentLike(getDb(), actor, reference, liked, kind);
    return Response.json(result, { headers });
  } catch (error) {
    if (error instanceof LikeError)
      return Response.json({ error: error.key }, { status: error.status, headers });
    console.error("Article like failed", error);
    return Response.json({ error: "likeRequestFailed" }, { status: 500, headers });
  }
}
