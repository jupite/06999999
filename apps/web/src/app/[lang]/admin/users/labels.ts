import type { MessageKey } from "@/i18n/messages";
import type { EditableCapability, PermissionMode } from "@/server/domain/permissions";

export const capabilityLabels = {
  "post.submit": "accessSubmitArticle",
  "project.submit": "accessSubmitProject",
  "photo.submit": "accessSubmitPhoto",
  "music.submit": "accessSubmitMusic",
  "friend.submit": "accessSubmitLink",
  "comment.submit": "accessSubmitComment",
  "image.upload": "accessUploadImage",
  "content.editOwn": "accessEditOwn",
  "like.toggle": "accessToggleLike",
} satisfies Record<EditableCapability, MessageKey>;

export const permissionModeLabels = {
  inherit: "permissionInherit",
  ALLOW: "permissionAllow",
  DENY: "permissionDeny",
} satisfies Record<PermissionMode, MessageKey>;
