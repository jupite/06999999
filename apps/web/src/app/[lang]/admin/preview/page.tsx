import { AdminPreview } from "@/components";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("previewStyleTitle") };
}

export default function AdminPreviewPage() {
  return <AdminPreview />;
}
