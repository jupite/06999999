export const maxTaxonomyNameLength = 32;
export const maxArticleTags = 5;
export const maxTagTextLength = 1000;

export function taxonomyName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim().normalize("NFC");
  return name && Array.from(name).length <= maxTaxonomyNameLength && !/[\p{Cc}]/u.test(name)
    ? name
    : null;
}

export function taxonomyId(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : undefined;
}

export function splitTagNames(value: string) {
  return value
    .split(/[,，\r\n]/u)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function normalizeTagNames(value: unknown) {
  if (typeof value !== "string" || value.length > maxTagTextLength) return null;
  const names = new Set<string>();
  for (const part of splitTagNames(value)) {
    const name = taxonomyName(part);
    if (!name) return null;
    names.add(name);
    if (names.size > maxArticleTags) return null;
  }
  return [...names];
}
