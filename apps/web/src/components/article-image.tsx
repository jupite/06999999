import { imageIdFromUrl } from "@/media/urls";

export function ArticleImage({
  src,
  alt,
  title,
  unavailable,
}: {
  src?: string | Blob;
  alt?: string;
  title?: string;
  unavailable: string;
}) {
  if (typeof src !== "string" || !imageIdFromUrl(src)) {
    return <span className="notice">{unavailable}</span>;
  }
  return <img src={src} alt={alt ?? ""} title={title} loading="lazy" decoding="async" />;
}
