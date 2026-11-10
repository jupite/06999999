import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { openApiAssets, openApiDocuments } from "@/docs/openapi";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const spec = openApiDocuments.find((entry) => entry.file === file);
  const asset = openApiAssets.find((entry) => entry.file === file);
  if (!spec && !asset) return new Response(null, { status: 404 });

  const directory = spec ? "../../doc/api" : "node_modules/swagger-ui-dist";
  const filename = join(/*turbopackIgnore: true*/ process.cwd(), directory, file);
  const content = await readFile(/*turbopackIgnore: true*/ filename, "utf8");
  const contentType =
    asset?.contentType ?? (file.endsWith(".json") ? "application/json" : "application/yaml");
  return new Response(content, {
    headers: { "Content-Type": `${contentType}; charset=utf-8`, "Cache-Control": "no-cache" },
  });
}
