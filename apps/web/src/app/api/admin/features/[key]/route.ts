import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { authorize } from "@/server/domain/permissions";
import { FeatureError, updateFeature } from "@/server/services/features";
export async function PATCH(request: Request, context: { params: Promise<{ key: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  const site = request.headers.get("sec-fetch-site"),
    origin = request.headers.get("origin");
  if (site ? site !== "same-origin" : origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "permissionDenied" }, { status: 403, headers });
  try {
    const actor = await currentActor(),
      access = authorize(actor, "site.manage");
    if (!access.allowed) throw new FeatureError(access.reason, actor ? 403 : 401);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new FeatureError("featureInvalid", 400);
    const reader = request.body?.getReader();
    if (!reader) throw new FeatureError("featureInvalid", 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 2048) {
          await reader.cancel();
          throw new FeatureError("featureInvalid", 413);
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
      throw new FeatureError("featureInvalid", 400);
    }
    const { key } = await context.params;
    const feature = await getDb().$transaction((tx) => updateFeature(tx, actor, key, input));
    return Response.json(feature, { headers });
  } catch (error) {
    return Response.json(
      { error: error instanceof FeatureError ? error.key : "featureRequestFailed" },
      { status: error instanceof FeatureError ? error.status : 500, headers },
    );
  }
}
