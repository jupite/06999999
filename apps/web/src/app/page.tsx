import Link from "next/link";
import { ArrowUpRight, BookOpen, Camera, Code2, Moon, Feather, Sparkles } from "lucide-react";
import { MusicCard } from "@/components/music-provider";
export default function Home() {
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">A LITTLE CORNER OF MY UNIVERSE</span>
        <span className="preview-label">基础预览 · 示例内容</span>
      </div>
      <div className="home-top">
        <section className="panel profile">
          <div className="profile-heading">
            <div className="avatar">
              <Moon size={32} />
            </div>
            <div>
              <span className="eyebrow">HELLO, WORLD</span>
              <h1>
                在此，留住一点微光<span>。</span>
              </h1>
            </div>
          </div>
          <p className="profile-copy">
            关于创作，关于日常，也关于那些不愿忘记的瞬间。
            <br />
            欢迎来到这个正在慢慢生长的小小世界。
          </p>
          <div className="profile-bottom">
            <div className="profile-stats">
              <Link href="/articles">
                <b>文章</b>
                <span>思想的片段</span>
              </Link>
              <Link href="/projects">
                <b>项目</b>
                <span>灵感的形状</span>
              </Link>
              <Link href="/photos">
                <b>照片</b>
                <span>时间的切片</span>
              </Link>
            </div>
            <Link className="round-button" href="/about" aria-label="了解这个网站">
              <ArrowUpRight size={20} />
            </Link>
          </div>
        </section>
        <MusicCard />
      </div>
      <div className="quote-bar">
        <span className="line-mark" />
        <p>把喜欢的事物，留在自己的宇宙里。</p>
        <Sparkles size={17} />
      </div>
      <div className="bento">
        <Link href="/articles" className="panel feature-card article-card">
          <div className="orbital-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <span>記録</span>
          </div>
          <div className="feature-text">
            <span className="pill">WORDS & THOUGHTS</span>
            <h2>文字，是时间的另一种刻度</h2>
            <p>技术笔记、创作记录，以及偶尔的碎碎念。</p>
            <span className="card-action">
              阅读文章 <ArrowUpRight size={16} />
            </span>
          </div>
        </Link>
        <Link href="/photos" className="panel photo-card">
          <div className="photo-decoration" aria-hidden="true" />
          <div>
            <span className="eyebrow">FRAGMENTS OF LIFE</span>
            <h2>收藏一瞬，亦是永恒。</h2>
            <p>照片墙 · 等待第一张照片</p>
          </div>
          <Camera size={24} />
        </Link>
        <Link href="/projects" className="panel project-card">
          <div className="card-top">
            <Code2 size={24} />
            <ArrowUpRight size={18} />
          </div>
          <span className="eyebrow">IDEAS INTO REALITY</span>
          <h2>从一个想法开始</h2>
          <p>小小的实验，也值得被看见。</p>
          <span className="text-link">探索项目</span>
        </Link>
        <Link href="/about" className="panel small-card">
          <div className="moon-badge">
            <Moon size={30} />
          </div>
          <h3>深紫色的梦</h3>
          <p>
            晓美焰主题
            <br />
            角色素材准备中
          </p>
        </Link>
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h2>在这里，分享喜欢。</h2>
        </div>
        <Link href="/write" className="button secondary">
          <Feather size={16} />
          试写一段
        </Link>
      </div>
      <div className="explore-grid">
        <Link className="panel explore-card" href="/friends">
          <Sparkles size={22} />
          <h3>相遇的星光</h3>
          <p>友链，让小小的世界彼此相连。</p>
        </Link>
        <Link className="panel explore-card" href="/articles">
          <BookOpen size={22} />
          <h3>慢慢写，慢慢读</h3>
          <p>分类与标签，整理每一次灵感。</p>
        </Link>
        <div className="panel explore-card">
          <Moon size={22} />
          <h3>小焰，稍后见</h3>
          <p>长发黑发带的 Q 版动画伙伴正在筹备。</p>
        </div>
      </div>
    </>
  );
}
