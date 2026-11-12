# 账号密码登录

当前保留 GitHub 登录，增加一个预先配置的本地管理员账号，不提供注册、找回密码或网页修改密码入口。

## 初始化与使用

在 `apps/web` 配好数据库和 `NEXTAUTH_SECRET`，运行 `node scripts/init-admin.mjs`。命令创建 `admin` 站主，随机生成密码；重复执行会拒绝覆盖。运行时自动读取 `.env.admin.local` 中的账号名和 scrypt 哈希。生成的明文凭据仅在 `.admin-credentials.local.txt` 中，查看后可删除；这两个文件均不提交 Git。

重启服务，在 `/zh/login` 或 `/en/login` 输入账号密码，成功进入同语言后台。顶部显示账号，退出登录后旧浏览器会话结束。

## 权限与会话

本地账号与 GitHub 账号独立，不自动合并。本地账号使用保留的 `local:` 身份标识，并且数据库角色必须为 OWNER 才能获得站主管理权限；GitHub 身份只接受数字 ID。管理员身份不能由登录表单指定，也不能通过用户管理封禁本地站主。

复用 NextAuth Credentials、JWT Cookie、CSRF 和现有 sessionVersion 校验。账号封禁或会话版本变更会使旧会话失效。密码不进入 JWT、响应或审计日志。密码使用随机盐和 Node scrypt 派生，比较使用 timingSafeEqual。

单进程每 15 分钟最多尝试 5 次账号密码登录，成功后清零；失败统一提示，不区分账号不存在、密码错误和暂时限制。计数保存在服务进程内，重启清空，多实例部署前需换成共享限流存储。此限制覆盖所有提交，因此其他人连续失败也可能暂时限制管理员登录。

## 重置

停止服务，生成新的 scrypt 哈希并替换 `.env.admin.local` 的 `ADMIN_PASSWORD_HASH`，保持账号名不变。数据库中为对应 `local:admin` 用户增加 sessionVersion 使已有会话失效，然后重启。暂不提供自动重置界面。

## 验收

验证正确密码进入后台、错误密码不建立会话、刷新仍登录、退出后需重新登录；确认 GitHub 登录入口保留，且不存在注册入口。配置及密码文件不应出现在 git status 中。
