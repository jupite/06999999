"use client";

import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/routing";
import { signIn } from "next-auth/react";
import { Github } from "lucide-react";
export function GitHubLogin({ configured }: { configured: boolean }) {
  const { locale, t } = useI18n();
  return (
    <button
      className="button"
      disabled={!configured}
      onClick={() => signIn("github", { callbackUrl: localePath(locale) })}
    >
      <Github size={18} />
      {t("githubSignIn")}
    </button>
  );
}
