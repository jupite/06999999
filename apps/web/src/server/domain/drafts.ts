import { authorize, type Actor } from "./permissions.ts";
import { normalizeTagNames, taxonomyId } from "./article-taxonomy.ts";

import type { SystemKey } from "../../i18n/messages";

export class DraftError extends Error {
  readonly notice: SystemKey;

  constructor(notice: SystemKey) {
    super(notice);
    this.notice = notice;
  }
}
export type DraftInput = {
  id?: string;
  version: number;
  title: string;
  markdown: string;
  categoryId?: string | null;
  tagText?: string;
};
export function requireDraftActor(actor: Actor | null, editing = false): Actor {
  const access = authorize(actor, editing ? "content.editOwn" : "post.submit");
  if (!actor || !access.allowed) throw new DraftError(access.reason);
  return actor;
}
export function parseDraft(value: unknown): DraftInput {
  if (!value || typeof value !== "object") throw new DraftError("invalidDraft");
  const data = value as Record<string, unknown>;
  if (typeof data.title !== "string" || !data.title.trim() || data.title.trim().length > 160)
    throw new DraftError("invalidDraftTitle");
  if (typeof data.markdown !== "string" || data.markdown.length > 100_000)
    throw new DraftError("draftBodyTooLong");
  if (data.id !== undefined && (typeof data.id !== "string" || !data.id || data.id.length > 100))
    throw new DraftError("invalidDraftId");
  if (
    typeof data.version !== "number" ||
    !Number.isSafeInteger(data.version) ||
    (data.id ? data.version < 1 : data.version !== 0)
  )
    throw new DraftError("invalidDraftVersion");
  const categoryId = data.categoryId === null ? null : taxonomyId(data.categoryId);
  if (data.categoryId !== undefined && categoryId === undefined)
    throw new DraftError("invalidArticleCategory");
  const tagNames = data.tagText === undefined ? undefined : normalizeTagNames(data.tagText);
  if (tagNames === null) throw new DraftError("invalidArticleTags");
  return {
    id: data.id as string | undefined,
    version: data.version,
    title: data.title.trim(),
    markdown: data.markdown,
    categoryId,
    tagText: tagNames?.join(", "),
  };
}
