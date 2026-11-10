import type { NextConfig } from "next";
import { join } from "node:path";
import { documents } from "./src/docs/catalog";
import { openApiAssets, openApiDocuments } from "./src/docs/openapi";

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: join(__dirname, "../.."),
  outputFileTracingIncludes: {
    "/*/docs/*": documents.map(({ file }) => `../../doc/${file}`),
    "/api/docs/openapi/*": [
      ...openApiDocuments.map(({ file }) => `../../doc/api/${file}`),
      ...openApiAssets.map(({ file }) => `node_modules/swagger-ui-dist/${file}`),
    ],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};
export default config;
