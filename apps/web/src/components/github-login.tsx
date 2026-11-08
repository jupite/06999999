"use client";

import { useI18n } from "@/i18n/client";
import { signIn } from "next-auth/react";
import { Github } from "lucide-react";
export function GitHubLogin({ configured }: { configured: boolean }) {
  const { t } = useI18n();
  return (
    <button
      className="button"
      disabled={!configured}
      onClick={() => signIn("github", { callbackUrl: "/" })}
    >
      <Github size={18} />
      {t("githubSignIn")}
    </button>
  );
}
