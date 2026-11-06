"use client";

import Link from "next/link";
import { Github, UserRound } from "lucide-react";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import { useState } from "react";

function LoginLink() {
  return (
    <Link className="login-link" href="/login">
      <Github size={16} />
      <span>登录</span>
    </Link>
  );
}

function SessionLink() {
  const { data: session, status } = useSession();
  if (status === "loading")
    return (
      <span className="login-link" role="status">
        正在确认登录…
      </span>
    );
  if (!session?.githubId) return <LoginLink />;
  return (
    <Link className="login-link" href="/login" aria-label="查看已登录账户">
      <UserRound size={16} />
      <span
        style={{
          maxWidth: 100,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {session.user?.name || "已登录"}
      </span>
    </Link>
  );
}

export function AccountMenu({ enabled }: { enabled: boolean }) {
  if (!enabled) return <LoginLink />;
  return (
    <SessionProvider>
      <SessionLink />
    </SessionProvider>
  );
}

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <button
        className="button secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setFailed(false);
          try {
            await signOut({ callbackUrl: "/login" });
          } catch {
            setFailed(true);
            setPending(false);
          }
        }}
      >
        {pending ? "正在退出…" : "退出登录"}
      </button>
      {failed && <p role="alert">退出失败，请重试。</p>}
    </>
  );
}
