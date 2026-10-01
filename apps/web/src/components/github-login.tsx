"use client";
import { signIn } from "next-auth/react";
import { Github } from "lucide-react";
export function GitHubLogin({ configured }: { configured: boolean }) {
  return <button className="button" disabled={!configured} onClick={() => signIn("github", { callbackUrl: "/" })}><Github size={18}/>使用 GitHub 登录</button>;
}
