"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useI18n } from "./client";
import { localePath } from "./routing";

export function LocaleLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const { locale } = useI18n();
  return <Link {...props} href={localePath(locale, href)} />;
}
