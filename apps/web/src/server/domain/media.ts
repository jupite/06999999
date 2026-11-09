import type { SystemKey } from "../../i18n/messages";

export const bytesPerMib = 1024n * 1024n;
export const maxUploadMib = 20;
export const maxQuotaMib = 999_999_999;

export class MediaError extends Error {
  readonly key: SystemKey;
  readonly status: number;

  constructor(key: SystemKey, status = 400) {
    super(key);
    this.key = key;
    this.status = status;
  }
}

export function quotaBytes(value: unknown, max = maxQuotaMib) {
  if (typeof value !== "string" || !/^\d{1,9}$/.test(value) || Number(value) > max) {
    throw new MediaError("invalidMediaQuota");
  }
  return BigInt(value) * bytesPerMib;
}
