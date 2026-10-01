import "server-only";
export async function requestReview(input: { content_id: string; version: number; text: string }) {
  const token = process.env.PYTHON_SERVICE_TOKEN;
  if (!token) return { decision: "human" as const, reason: "审核服务未配置，转人工审核" };
  try {
    const response = await fetch(`${process.env.PYTHON_API_URL ?? "http://localhost:8000"}/v1/moderation`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(input), signal: AbortSignal.timeout(10000), cache: "no-store"
    });
    if (!response.ok) throw new Error("Review service unavailable");
    const result = await response.json();
    if (result.content_id !== input.content_id || result.version !== input.version || !["human", "pass"].includes(result.decision)) throw new Error("Invalid review result");
    return { decision: result.decision as "human" | "pass", reason: String(result.reason) };
  } catch { return { decision: "human" as const, reason: "审核服务不可用，转人工审核" }; }
}
