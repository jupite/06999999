"use client";
import { useActionState, useState } from "react";
import { submitFriendAction } from "@/app/[lang]/friends/actions";
import { useI18n, type Notice } from "@/i18n/client";
import { uploadImage } from "@/api";
import { ArticleImage } from "../article-image";
export function FriendForm({
  submissionId,
  owner,
  canUpload,
}: {
  submissionId: string;
  owner: boolean;
  canUpload: boolean;
}) {
  const { locale, t, notice } = useI18n();
  const [error, action, pending] = useActionState(submitFriendAction.bind(null, locale), null);
  const [fields, setFields] = useState({ title: "", summary: "", url: "" });
  const [icon, setIcon] = useState(""),
    [uploading, setUploading] = useState(false),
    [uploadError, setUploadError] = useState<Notice | null>(null);
  async function upload(file: File) {
    if (pending || uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadImage(file);
      if ("error" in result) setUploadError({ system: result.error });
      else setIcon(result.url);
    } catch {
      setUploadError({ system: "mediaUploadFailed" });
    } finally {
      setUploading(false);
    }
  }
  return (
    <form action={action} className="panel draft-card">
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="iconUrl" value={icon} />
      <label className="draft-title">
        {t("friendTitle")}
        <input
          name="title"
          value={fields.title}
          onChange={(event) => setFields({ ...fields, title: event.target.value })}
          required
          maxLength={160}
          disabled={pending}
        />
      </label>
      <label className="draft-title">
        {t("friendDescription")}
        <textarea
          value={fields.summary}
          onChange={(event) => setFields({ ...fields, summary: event.target.value })}
          name="summary"
          rows={3}
          maxLength={2000}
          disabled={pending}
        />
      </label>
      <label className="draft-title">
        {t("friendUrl")}
        <input
          value={fields.url}
          onChange={(event) => setFields({ ...fields, url: event.target.value })}
          type="url"
          name="url"
          required
          maxLength={2048}
          disabled={pending}
        />
      </label>
      {canUpload && (
        <label className="draft-title">
          {t(uploading ? "imageUploading" : "friendIcon")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={pending || uploading}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
      )}
      {icon && (
        <div>
          <div className="project-cover">
            <ArticleImage src={icon} unavailable={t("imagesUnavailable")} />
          </div>
          <button
            className="button secondary"
            type="button"
            disabled={pending || uploading}
            onClick={() => setIcon("")}
          >
            {t("friendRemoveIcon")}
          </button>
        </div>
      )}
      <p>{t("friendIconHelp")}</p>
      {uploadError && <p role="alert">{notice(uploadError)}</p>}
      {error && <p role="alert">{notice({ system: error })}</p>}
      <button className="button" disabled={pending || uploading}>
        {t(pending ? "submitting" : owner ? "publishFriend" : "submitFriend")}
      </button>
    </form>
  );
}
