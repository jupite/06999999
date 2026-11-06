import { GitHubLogin } from "@/components/github-login";
import { authConfigured } from "@/server/auth";
import { Moon } from "lucide-react";
export const metadata = { title: "登录" };
export const dynamic = "force-dynamic";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const configured = authConfigured();
  return (
    <section className="panel login-panel">
      <div className="moon-badge">
        <Moon size={30} />
      </div>
      <span className="eyebrow">WELCOME TO OUR LITTLE WORLD</span>
      <h1>留下你的足迹。</h1>
      <p>使用 GitHub 登录，分享文章、项目和喜欢的音乐。</p>
      <GitHubLogin configured={configured} />
      {!configured && (
        <p className="notice">GitHub 登录尚未配置，暂时无法登录。公开页面与写作预览可正常浏览。</p>
      )}
      {error && (
        <p className="notice" role="alert">
          登录未完成，请稍后重试或联系站主。
        </p>
      )}
      <p className="muted">普通用户内容需审核后公开。图片上传需单独授权。</p>
    </section>
  );
}
