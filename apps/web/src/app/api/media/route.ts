import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { MediaError } from "@/server/domain/media";
import { storeImage } from "@/server/services/media";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite ? fetchSite !== "same-origin" : origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "mediaUploadDenied" }, { status: 403 });
  }
  try {
    const actor = await currentActor();
    if (!actor) return Response.json({ error: "loginRequired" }, { status: 401 });
    const result = await storeImage(getDb(), actor, request.body);
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof MediaError)
      return Response.json({ error: error.key }, { status: error.status });
    console.error("Media upload failed", error);
    return Response.json({ error: "mediaUploadFailed" }, { status: 500 });
  }
}
