export const functionDocs = [
  { slug: "article-comments", file: "article-comments.md", title: "articleComments" },
  { slug: "article-likes", file: "article-likes.md", title: "articleLike" },
  { slug: "admin-audit", file: "admin-audit.md", title: "auditTitle" },
  { slug: "password-login", file: "password-login.md", title: "passwordSignIn" },
  { slug: "publishing-rules", file: "publishing-rules.md", title: "docsPublishingRules" },
  { slug: "permission-system", file: "permission-system.md", title: "docsPermissions" },
  { slug: "article-publishing", file: "article-publishing.md", title: "docsArticlePublishing" },
  { slug: "article-images", file: "article-images.md", title: "docsArticleImages" },
  { slug: "project-publishing", file: "project-publishing.md", title: "docsProjectPublishing" },
  { slug: "music-player", file: "music-player.md", title: "docsMusicPlayer" },
  { slug: "i18n", file: "i18n.md", title: "docsInternationalization" },
] as const;

export const apiDoc = { slug: "api", file: "api/README.md", title: "docsApi" } as const;

export const documents = [...functionDocs, apiDoc];
