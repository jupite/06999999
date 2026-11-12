import { notFound } from "next/navigation";
import { Moon } from "lucide-react";
import { getI18n } from "@/i18n/server";
const sections = {
  about: {
    en: "BEHIND THIS LITTLE WORLD",
    icon: Moon,
  },
};
function isSection(value: string): value is keyof typeof sections {
  return Object.hasOwn(sections, value);
}
export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { t } = await getI18n();
  const { section } = await params;
  return { title: t(isSection(section) ? section : "notFound") };
}
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { t } = await getI18n();
  const { section } = await params;
  if (!isSection(section)) notFound();
  const data = sections[section];
  const Icon = data.icon;
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">{data.en}</span>
        <h1>
          {t(section)}
          <span className="brand-dot">.</span>
        </h1>
        <p>{t(`${section}Description`)}</p>
      </div>
      <section className="panel empty-state">
        <div className="empty-icon">
          <Icon size={32} />
        </div>
        <h2>{t(`${section}Empty`)}</h2>
        <p>{t(`${section}Detail`)}</p>
        <span className="empty-footnote">{t("sectionPreview")}</span>
      </section>
    </>
  );
}
