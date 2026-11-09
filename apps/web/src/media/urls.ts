const imagePath =
  /^\/api\/media\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;

export function imageIdFromUrl(url: unknown) {
  return typeof url === "string" ? imagePath.exec(url)?.[1] : undefined;
}

export function imageUrl(id: string) {
  return `/api/media/${id}`;
}
