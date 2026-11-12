import { currentActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { listFeatures, FeatureError } from "@/server/services/features";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    return Response.json(
      { features: await listFeatures(getDb(), await currentActor()) },
      { headers },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof FeatureError ? error.key : "featureRequestFailed" },
      { status: error instanceof FeatureError ? error.status : 500, headers },
    );
  }
}
