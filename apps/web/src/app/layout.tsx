import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/navigation";
import { MusicProvider } from "@/components/music-provider";
import { authConfigured } from "@/server/auth";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "未命名的观测站", template: "%s · 观测站" },
  description: "记录创作、日常与喜欢的一切。个人站基础预览。",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="ambient" aria-hidden="true" />
        <a href="#main" className="skip-link">
          跳到正文
        </a>
        <MusicProvider>
          <Navigation authEnabled={authConfigured()} />
          <main id="main" className="site-main">
            {children}
          </main>
          <footer className="footer">
            <span>
              未命名的观测站 <span className="muted"> / 名称暂定</span>
            </span>
            <span>在时间的缝隙里，收藏微光。</span>
            <Link href="/about">关于这里</Link>
          </footer>
        </MusicProvider>
      </body>
    </html>
  );
}
