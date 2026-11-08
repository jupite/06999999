import { getTranslator, type Dictionary, type SystemKey } from "./messages";

export type SystemNotice = SystemKey | { key: "authorCannotPublish"; reason: SystemKey };

export function getSystemTranslator(dictionary: Dictionary) {
  const t = getTranslator(dictionary);

  return (notice: SystemNotice) =>
    typeof notice === "string"
      ? dictionary.system[notice]
      : t(notice.key, { reason: dictionary.system[notice.reason] });
}
