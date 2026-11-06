"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Github } from "lucide-react";
export const navigation = [
  ["/", "首页"],
  ["/projects", "项目"],
  ["/articles", "文章"],
  ["/photos", "照片墙"],
  ["/music", "音乐"],
  ["/friends", "友链"],
  ["/about", "关于"],
] as const;
export function Navigation() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/">
          <Moon size={22} />
          <span>
            未命名的观测站<span className="brand-dot">.</span>
          </span>
        </Link>
        <nav aria-label="主导航">
          {navigation.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={pathname === href ? "active" : ""}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Link className="login-link" href="/login">
          <Github size={16} />
          <span>登录</span>
        </Link>
      </div>
    </header>
  );
}
