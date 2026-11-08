import Link from "next/link";
export function ArticlePagination({
  page,
  more,
  base,
}: {
  page: number;
  more: boolean;
  base: string;
}) {
  return (
    <nav className="draft-actions" aria-label="分页">
      {page > 1 && (
        <Link className="button secondary" href={`${base}?page=${page - 1}`}>
          上一页
        </Link>
      )}
      <span>第 {page} 页</span>
      {more && (
        <Link className="button secondary" href={`${base}?page=${page + 1}`}>
          下一页
        </Link>
      )}
    </nav>
  );
}
export function ArticleAccessNotice({ reason, signedIn }: { reason: string; signedIn: boolean }) {
  return (
    <section className="panel empty-state">
      <h1>{signedIn ? "无访问权限" : "请先登录"}</h1>
      <p>{reason}</p>
      <Link className="button" href="/login">
        {signedIn ? "查看当前账户" : "前往登录"}
      </Link>
    </section>
  );
}
export function ArticleTime({ value }: { value: Date }) {
  return (
    <time dateTime={value.toISOString()}>
      {new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Taipei",
      }).format(value)}
      （UTC+8）
    </time>
  );
}
