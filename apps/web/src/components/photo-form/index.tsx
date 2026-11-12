"use client";
import { useActionState, useState } from "react";
import { submitPhotoAction } from "@/app/[lang]/photos/actions";
import { useI18n, type Notice } from "@/i18n/client";
import { uploadImage } from "@/api";
import { ArticleImage } from "../article-image";
export function PhotoForm({
  submissionId,
  owner,
  categories,
}: {
  submissionId: string;
  owner: boolean;
  categories: { id: string; name: string }[];
}) {
  const { locale, t, notice } = useI18n();
  const [error, action, pending] = useActionState(submitPhotoAction.bind(null, locale), null);
  const [image, setImage] = useState("");
  const [uploading, setUploading] = useState(false),
    [uploadError, setUploadError] = useState<Notice | null>(null);
  async function upload(file: File) {
    if (uploading || pending) return;
    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadImage(file);
      if ("error" in result) setUploadError({ system: result.error });
      else setImage(result.url);
    } catch {
      setUploadError({ system: "mediaUploadFailed" });
    } finally {
      setUploading(false);
    }
  }
  return (
    <form action={action} className="panel draft-card">
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="imageUrl" value={image} />
      <label className="draft-title">
        {t("photoTitle")}
        <input name="title" required maxLength={160} disabled={pending} />
      </label>
      <label className="draft-title">
        {t("photoCaption")}
        <textarea name="summary" rows={3} maxLength={2000} disabled={pending} />
      </label>
      <label className="draft-title">
        {t("articleCategory")}
        <select name="categoryId" disabled={pending}>
          <option value="">{t("noArticleCategory")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="draft-title">
        {t("articleTags")}
        <input name="tagText" maxLength={1000} disabled={pending} />
        <small>{t("photoTagsHelp")}</small>
      </label>
      <label className="draft-title">
        {t(uploading ? "imageUploading" : "photoImage")}
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
      {image && (
        <div className="project-cover">
          <ArticleImage src={image} unavailable={t("imagesUnavailable")} />
        </div>
      )}
      <p>{t("photoUploadHelp")}</p>
      {uploadError && <p role="alert">{notice(uploadError)}</p>}
      {error && <p role="alert">{notice({ system: error })}</p>}
      <button className="button" disabled={pending || uploading || !image}>
        {t(pending ? "submitting" : owner ? "publishPhoto" : "submitPhoto")}
      </button>
    </form>
  );
}
