import Link from "next/link";
export default function NotFound() {
  return (
    <section className="panel empty-state">
      <span className="eyebrow">404 / LOST IN TIME</span>
      <h1>这段时间线，还没有留下记录。</h1>
      <Link className="button" href="/">
        回到首页
      </Link>
    </section>
  );
}
