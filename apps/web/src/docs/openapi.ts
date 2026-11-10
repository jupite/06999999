export const openApiDocuments = [
  { id: "web", file: "web.openapi.yaml", title: "docsApiWeb", draft: false },
  { id: "python", file: "python.openapi.json", title: "docsApiPython", draft: false },
  { id: "admin-draft", file: "admin-draft.openapi.yaml", title: "docsApiAdminDraft", draft: true },
] as const;

export const openApiAssets = [
  { file: "swagger-ui-bundle.js", contentType: "text/javascript" },
  { file: "swagger-ui.css", contentType: "text/css" },
] as const;

export const openApiBase = "/api/docs/openapi";
