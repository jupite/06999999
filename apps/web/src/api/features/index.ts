import type { FeatureKey } from "@/server/domain/features";
import type { SystemKey } from "@/i18n/messages";
export async function updateFeatureFlag(
  key: FeatureKey,
  enabled: boolean,
  expectedEnabled: boolean,
): Promise<{ key: FeatureKey; enabled: boolean } | { error: SystemKey }> {
  const response = await fetch(`/api/admin/features/${encodeURIComponent(key)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled, expectedEnabled }),
  });
  const result = await response.json();
  if (!response.ok) return { error: result.error ?? "featureRequestFailed" };
  if (typeof result.enabled !== "boolean" || result.key !== key)
    throw Error("Invalid feature response");
  return result;
}
