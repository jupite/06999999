import { getTranslator, type Dictionary } from "./messages";

// Domain errors keep their original messages for existing callers and logs.
export function getSystemTranslator(dictionary: Dictionary) {
  const translations: Record<string, string> = dictionary.system;
  const lookup = (message: string) =>
    Object.hasOwn(translations, message) ? translations[message] : message;
  const t = getTranslator(dictionary);

  return (message: string) => {
    const authorBlocked = /^作者当前不能发布：(.+)。可填写原因拒绝该投稿。$/.exec(message);
    return authorBlocked
      ? t("authorCannotPublish", { reason: lookup(authorBlocked[1]) })
      : lookup(message);
  };
}
