import type { ReactNode } from "react";
import { AdminShell } from "@/components";
import { authConfigured } from "@/server/auth";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell authEnabled={authConfigured()}>{children}</AdminShell>;
}
