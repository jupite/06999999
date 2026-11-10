"use client";

import Script from "next/script";
import { useRef, useState } from "react";
import { openApiBase } from "@/docs/openapi";
import { useI18n } from "@/i18n/client";

declare global {
  interface Window {
    SwaggerUIBundle?: (options: {
      domNode: HTMLDivElement;
      url: string;
      supportedSubmitMethods: string[];
      validatorUrl: null;
    }) => void;
  }
}

export function OpenApiReference({ spec }: { spec: string }) {
  const { t } = useI18n();
  const target = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  return (
    <>
      <link rel="stylesheet" href={`${openApiBase}/swagger-ui.css`} precedence="default" />
      {failed && <p role="alert">{t("docsApiLoadFailed")}</p>}
      <div className="openapi-reference" ref={target} />
      <Script
        src={`${openApiBase}/swagger-ui-bundle.js`}
        onError={() => setFailed(true)}
        onReady={() => {
          if (!target.current || !window.SwaggerUIBundle) {
            setFailed(true);
            return;
          }
          window.SwaggerUIBundle({
            domNode: target.current,
            url: `${openApiBase}/${spec}`,
            supportedSubmitMethods: [],
            validatorUrl: null,
          });
        }}
      />
    </>
  );
}
