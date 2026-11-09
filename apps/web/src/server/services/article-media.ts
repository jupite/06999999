import "server-only";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Prisma } from "@/generated/prisma/client";
import { imageIdFromUrl } from "@/media/urls";
import { MediaError } from "../domain/media";

const parser = unified().use(remarkParse).use(remarkGfm);
type MarkdownNode = {
  type: string;
  children?: MarkdownNode[];
  url?: string;
  identifier?: string;
};

function imageIds(markdown: string) {
  if (!markdown.includes("!")) return [];

  const ids = new Set<string>();
  const definitions = new Map<string, string>();
  const references = new Set<string>();
  const nodes: MarkdownNode[] = [parser.parse(markdown)];
  while (nodes.length) {
    const node = nodes.pop()!;
    if (node.type === "image") {
      const id = imageIdFromUrl(node.url);
      if (id) ids.add(id);
    }
    if (node.type === "imageReference" && node.identifier) references.add(node.identifier);
    if (node.type === "definition" && node.identifier && !definitions.has(node.identifier)) {
      definitions.set(node.identifier, node.url ?? "");
    }
    if (node.children) nodes.push(...node.children.toReversed());
  }
  for (const reference of references) {
    const id = imageIdFromUrl(definitions.get(reference));
    if (id) ids.add(id);
  }
  return [...ids];
}

export async function articleMedia(
  db: Prisma.TransactionClient,
  ownerId: string,
  markdown: string,
) {
  const ids = imageIds(markdown);
  if (!ids.length) return undefined;
  const count = await db.media.count({ where: { id: { in: ids }, ownerId, ready: true } });
  if (count !== ids.length) throw new MediaError("articleImageUnavailable");
  return { connect: ids.map((id) => ({ id })) };
}
