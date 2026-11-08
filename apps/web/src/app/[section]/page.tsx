import { notFound } from "next/navigation";
import Link from "next/link";
import { BookOpen, Camera, Code2, Heart, Music2, Moon, Plus } from "lucide-react";
import { MusicCard } from "@/components/music-provider";
const sections = {
  projects: {
    title: "项目",
    en: "SMALL IDEAS, REAL THINGS",
    description: "让灵感拥有一个可以抵达的地址。",
    icon: Code2,
    empty: "第一张项目卡片，留给你的灵感。",
    detail: "项目会以卡片展示，点击前往项目网页。提交地址须符合站主设置的网站白名单。",
  },
  articles: {
    title: "文章",
    en: "WORDS THAT STAY",
    description: "把思考写下来，把时间留住。",
    icon: BookOpen,
    empty: "这里还没有发布的文章。",
    detail: "支持 Markdown 编辑与预览，以及分类、标签。其他用户投稿将在审核后展示。",
  },
  photos: {
    title: "照片墙",
    en: "COLLECTING LITTLE MOMENTS",
    description: "记录那些平凡，却闪着光的瞬间。",
    icon: Camera,
    empty: "等待第一束被收藏的光。",
    detail: "照片按分类与标签整理。图片上传需要站主授权，并受个人容量限制。",
  },
  music: {
    title: "音乐",
    en: "SOUNDTRACK OF THIS MOMENT",
    description: "一首歌，让此刻多停留一会儿。",
    icon: Music2,
    empty: "你的第一份歌单，正在路上。",
    detail: "支持网易云单曲和歌单的体验已规划。当前播放接入尚未完成，不提供模拟播放。",
  },
  friends: {
    title: "友链",
    en: "OTHER LITTLE UNIVERSES",
    description: "每一次相遇，都是宇宙里的一点光。",
    icon: Heart,
    empty: "这里为新的相遇留着位置。",
    detail: "登录后可以提交友链。站点名称、介绍与地址将在审核后公开。",
  },
  about: {
    title: "关于",
    en: "BEHIND THIS LITTLE WORLD",
    description: "关于这个正在生长的个人空间。",
    icon: Moon,
    empty: "你好，欢迎来到观测站。",
    detail: "这是一个以晓美焰为视觉方向的二次元个人站。网站名称、个人简介和角色插画尚待主人补充。",
  },
};
export function generateStaticParams() {
  return Object.keys(sections)
    .filter((section) => section !== "articles")
    .map((section) => ({ section }));
}
export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return { title: sections[section as keyof typeof sections]?.title ?? "未找到" };
}
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!(section in sections)) notFound();
  const data = sections[section as keyof typeof sections];
  const Icon = data.icon;
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">{data.en}</span>
        <h1>
          {data.title}
          <span className="brand-dot">.</span>
        </h1>
        <p>{data.description}</p>
      </div>
      {section === "music" && (
        <div className="music-page-card">
          <MusicCard />
        </div>
      )}
      <section className="panel empty-state">
        <div className="empty-icon">
          <Icon size={32} />
        </div>
        <h2>{data.empty}</h2>
        <p>{data.detail}</p>
        {section !== "about" && (
          <Link className="button secondary" href={section === "articles" ? "/drafts" : "/login"}>
            <Plus size={16} />
            {section === "articles" ? "我的草稿" : "登录与投稿说明"}
          </Link>
        )}
        <span className="empty-footnote">基础工程预览 · 内容服务尚未接通</span>
      </section>
    </>
  );
}
