import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { localePath } from "@/i18n/routing";

export default async function DraftsPage() {
  const { locale } = await getI18n();
  redirect(localePath(locale, "/my-articles?status=draft"));
}
