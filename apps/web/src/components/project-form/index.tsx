"use client";

import { useActionState, useRef, useState } from "react";
import { submitProjectAction } from "@/app/[lang]/projects/actions";
import { useI18n, type Notice } from "@/i18n/client";
import { uploadImage } from "@/api";
import { maxProjectUrlLength } from "@/server/domain/project-sites";
import { ArticleImage } from "../article-image";

export function ProjectForm({
  submissionId,
  canUpload,
  owner,
}: {
  submissionId: string;
  canUpload: boolean;
  owner: boolean;
}) {
  const { locale, t, notice } = useI18n();
  const [id] = useState(submissionId);
  const [error, action, pending] = useActionState(submitProjectAction.bind(null, locale), null);
  const [fields, setFields] = useState({ title: "", summary: "", url: "" });
  const [cover, setCover] = useState("");
  const [uploadError, setUploadError] = useState<Notice | null>(null);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = pending || uploading;

  async function upload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadImage(file);
      if ("error" in result) setUploadError({ system: result.error });
      else setCover(result.url);
    } catch {
      setUploadError("imageUploadNetworkError");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      action={action}
      className="panel draft-card"
      onSubmit={(event) => {
        if (uploading) event.preventDefault();
      }}
    >
      <input type="hidden" name="submissionId" value={id} />
      <input type="hidden" name="cover" value={cover} />
      <label className="draft-title">
        {t("projectTitle")}
        <input
          name="title"
          required
          maxLength={100}
          value={fields.title}
          onChange={(event) => setFields({ ...fields, title: event.target.value })}
        />
      </label>
      <label className="draft-title">
        {t("projectSummary")}
        <textarea
          name="summary"
          required
          maxLength={500}
          rows={5}
          value={fields.summary}
          onChange={(event) => setFields({ ...fields, summary: event.target.value })}
        />
      </label>
      <label className="draft-title">
        {t("projectWebsiteUrl")}
        <input
          name="url"
          required
          type="url"
          maxLength={maxProjectUrlLength}
          value={fields.url}
          onChange={(event) => setFields({ ...fields, url: event.target.value })}
        />
      </label>
      {canUpload && (
        <div className="draft-actions">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file && !busy) void upload(file);
            }}
          />
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {t(uploading ? "imageUploading" : "projectUploadCover")}
          </button>
          {cover && (
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => setCover("")}
            >
              {t("projectRemoveCover")}
            </button>
          )}
        </div>
      )}
      {cover && (
        <div className="project-cover">
          <ArticleImage src={cover} unavailable={t("imagesUnavailable")} />
        </div>
      )}
      {uploadError && (
        <p className="notice" role="alert">
          {notice(uploadError)}
        </p>
      )}
      {error && (
        <p className="notice" role="alert">
          {notice({ system: error })}
        </p>
      )}
      <button className="button" type="submit" disabled={busy}>
        {t(pending ? "submitting" : owner ? "publishProject" : "submitProject")}
      </button>
    </form>
  );
}
