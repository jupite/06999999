export type SiteRule = { hostname: string; includeSubdomains: boolean; effect: "ALLOW" | "DENY"; enabled: boolean };
export function projectUrlAllowed(value: string, rules: SiteRule[]): boolean {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    const matches = rules.filter(rule => {
      if (!rule.enabled) return false;
      const domain = rule.hostname.toLowerCase().replace(/\.$/, "");
      if (!domain || domain.includes("/") || domain.includes(":")) return false;
      return host === domain || (rule.includeSubdomains && host.endsWith(`.${domain}`));
    });
    return matches.some(r => r.effect === "ALLOW") && !matches.some(r => r.effect === "DENY");
  } catch { return false; }
}
