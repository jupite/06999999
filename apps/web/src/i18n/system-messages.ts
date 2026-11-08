import type { Locale } from "./messages";

// Domain errors keep their original messages for existing callers and logs.
// Translate only system-generated notices at the UI boundary.
const englishMessages = new Map([
  ["请先登录", "Please sign in."],
  ["账号已封禁", "This account is banned."],
  ["该权限已被禁止", "Your account does not have this permission."],
  ["仅站主可操作", "Only the site owner can do this."],
  ["只能操作自己的内容", "You can only manage your own content."],
  ["站主权限", "Site owner permission"],
  ["用户白名单", "Permission granted for this account"],
  ["需要站主授权图片上传", "The site owner must grant image upload permission."],
  ["普通用户默认权限", "Default member permission"],
  [
    "文章已更新、已提交或不可操作，请刷新后重试。",
    "The article has changed, has already been submitted, or cannot be accessed. Refresh and try again.",
  ],
  [
    "文章已经提交，请刷新状态。",
    "This article has already been submitted. Refresh to check its status.",
  ],
  ["请先保存非空的标题和正文，再提交。", "Save a title and body before submitting."],
  ["请填写正文再提交。", "Enter a body before submitting."],
  [
    "文章版本已变化或不可编辑，请重新打开后重试。",
    "The article version has changed or cannot be edited. Reopen it and try again.",
  ],
  [
    "该版本已审核或已发生变化，请刷新审核列表。",
    "This version has been reviewed or changed. Refresh the review queue.",
  ],
  ["该版本已经审核，请刷新列表。", "This version has already been reviewed. Refresh the list."],
  ["找不到可复制的本人已拒绝投稿。", "No rejected submission belonging to you was found to copy."],
  [
    "文章已删除、版本已变化或无权操作，请刷新列表。",
    "The article was deleted or changed, or you do not have permission. Refresh the list.",
  ],
  ["草稿数据无效。", "Invalid draft data."],
  ["请填写 1–160 字的标题。", "Enter a title between 1 and 160 characters."],
  ["正文不能超过 100000 字符。", "The body cannot exceed 100,000 characters."],
  ["草稿编号无效。", "Invalid draft ID."],
  ["草稿版本无效。", "Invalid draft version."],
  ["文章编号或版本无效。", "Invalid article ID or version."],
  ["审核操作无效。", "Invalid review action."],
  ["审核说明不能超过 2000 字。", "Review notes cannot exceed 2,000 characters."],
  [
    "请填写拒绝原因，帮助作者修改。",
    "Enter a reason for rejection to help the author revise their submission.",
  ],
  [
    "草稿不可编辑或已有更新。请保留当前正文，再重新打开草稿。",
    "The draft changed or cannot be edited. Keep a copy of your text and reopen the draft.",
  ],
  ["草稿编号或版本无效。", "Invalid draft ID or version."],
  [
    "草稿不存在、已有更新或不可删除，请刷新列表。",
    "The draft is missing, has changed, or cannot be deleted. Refresh the list.",
  ],
  [
    "保存失败，请稍后重试；当前输入仍保留在页面中。",
    "Could not save. Your text is still on the page. Try again later.",
  ],
  ["删除失败，请稍后重试。", "Could not delete the draft. Try again later."],
  ["操作失败，请稍后重试。", "The operation failed. Try again later."],
]);

export function translateSystemMessage(locale: Locale, message: string) {
  if (locale !== "en") return message;
  const authorBlocked = /^作者当前不能发布：(.+)。可填写原因拒绝该投稿。$/.exec(message);
  if (authorBlocked) {
    const reason = englishMessages.get(authorBlocked[1]) ?? authorBlocked[1];
    return `The author cannot publish right now. ${reason} You can reject this submission and explain why.`;
  }
  return englishMessages.get(message) ?? message;
}
