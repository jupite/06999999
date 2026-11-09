export type SiteRule = {
  hostname: string;
  includeSubdomains: boolean;
  effect: "ALLOW" | "DENY";
  enabled: boolean;
};
export type ProjectUrlDecision = "allowed" | "denied" | "unmatched" | "invalid";
export const maxProjectUrlLength = 2048;

export function normalizeSiteHostname(value: unknown) {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (!input || input.length > 254 || /[\s/\\?#@:*%]/u.test(input)) return null;
  try {
    const hostname = new URL(`https://${input}`).hostname.toLowerCase().replace(/\.$/, "");
    const validLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
    return hostname.length <= 253 && hostname.split(".").every((label) => validLabel.test(label))
      ? hostname
      : null;
  } catch {
    return null;
  }
}

export function parseProjectUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.length > maxProjectUrlLength) return null;
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      url.href.length > maxProjectUrlLength
    )
      return null;
    return url;
  } catch {
    return null;
  }
}

export function projectUrlDecision(value: unknown, rules: SiteRule[]): ProjectUrlDecision {
  const url = parseProjectUrl(value);
  if (!url) return "invalid";
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  let allowed = false;
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const domain = normalizeSiteHostname(rule.hostname);
    if (!domain || (host !== domain && !(rule.includeSubdomains && host.endsWith(`.${domain}`))))
      continue;
    if (rule.effect === "DENY") return "denied";
    if (rule.effect === "ALLOW") allowed = true;
  }
  return allowed ? "allowed" : "unmatched";
}

export function projectUrlAllowed(value: string, rules: SiteRule[]): boolean {
  return projectUrlDecision(value, rules) === "allowed";
}
