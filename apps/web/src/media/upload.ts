import type { SystemKey } from "@/i18n/messages";
import { imageIdFromUrl } from "./urls";

export async function uploadImage(file: File) {
  const response = await fetch("/api/media", { method: "POST", body: file });
  const result: { url: string } | { error: SystemKey } = await response.json();
  if ("error" in result) return result;
  if (!response.ok || !imageIdFromUrl(result.url)) throw new Error("Invalid upload response");
  return result;
}
