import { currentActor } from "@/server/auth";
import { authorize } from "@/server/domain/permissions";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const access = authorize(await currentActor(), "site.manage");
  if (!access.allowed) return <section className="panel empty-state"><h1>管理入口</h1><p>{access.reason}</p><Link className="button" href="/login">前往登录</Link></section>;
  return <section className="panel empty-state"><h1>站点管理</h1><p>站主身份校验已通过。用户权限、审核、上传额度和 AI 设置面板将在后续内容服务阶段接入。</p></section>;
}
