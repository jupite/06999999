"use client";
import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/routing";
export function PasswordLogin() {
  const { locale, t } = useI18n();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setFailed(false);
    try {
      const result = await signIn("credentials", {
        username: form.get("username"),
        password: form.get("password"),
        redirect: false,
        callbackUrl: localePath(locale, "/admin"),
      });
      if (!result?.ok || result.error) {
        setFailed(true);
        setPending(false);
        return;
      }
      window.location.assign(localePath(locale, "/admin"));
    } catch {
      setFailed(true);
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="draft-card" style={{ textAlign: "left", width: "100%" }}>
      <label className="draft-title">
        {t("loginUsername")}
        <input name="username" autoComplete="username" required maxLength={64} disabled={pending} />
      </label>
      <label className="draft-title">
        {t("loginPassword")}
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
          disabled={pending}
        />
      </label>
      <button className="button" disabled={pending}>
        {t(pending ? "signingIn" : "passwordSignIn")}
      </button>
      {failed && <p role="alert">{t("passwordLoginFailed")}</p>}
    </form>
  );
}
