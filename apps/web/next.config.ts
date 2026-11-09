import type { NextConfig } from "next";
import { join } from "node:path";
import { documents } from "./src/docs/catalog";

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: join(__dirname, "../.."),
  outputFileTracingIncludes: {
    "/*/docs/*": documents.map(({ file }) => `../../doc/${file}`),
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
