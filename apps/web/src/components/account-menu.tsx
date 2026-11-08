"use client";

import { useI18n } from "@/i18n/client";

import Link from "next/link";
import { Github, UserRound } from "lucide-react";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import { useState } from "react";

function LoginLink() {
  const { t } = useI18n();
  return (
    <Link className="login-link" href="/login">
      <Github size={16} />
      <span>{t("signIn")}</span>
    </Link>
  );
}

function GitHubAvatar({ src, name }: { src?: string | null; name?: string | null }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <UserRound size={28} aria-hidden="true" style={{ flexShrink: 0 }} />;
  return (
    <img
      src={src}
      alt={t("githubAvatar", { name: name || t("user") })}
      width={28}
      height={28}
      referrerPolicy="no-referrer"
      style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      onError={() => setFailed(true)}
    />
  );
}

function SessionLink() {
  const { t } = useI18n();
  const { data: session, status } = useSession();
  if (status === "loading")
    return (
      <span className="login-link" role="status">
        {t("signingIn")}
      </span>
    );
  if (!session?.githubId) return <LoginLink />;
  return (
    <Link className="login-link" href="/login" aria-label={t("viewSignedInAccount")}>
      <GitHubAvatar
        key={session.user?.image ?? "default"}
        src={session.user?.image}
        name={session.user?.name}
      />
      <span
        style={{
          maxWidth: 100,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {session.user?.name || t("signedIn")}
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
  const { t } = useI18n();
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
        {pending ? t("signingOut") : t("signOut")}
      </button>
      {failed && <p role="alert">{t("signOutFailed")}</p>}
    </>
  );
}
