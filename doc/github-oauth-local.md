# 本地 GitHub 登录配置与验收

从实际运行网站的仓库或工作树配置 `apps/web/.env`。本地访问统一使用 `http://localhost:3000`。登录流程、站内身份与会话规则见[GitHub 登录与会话](./github-login.md)。

## 1. 创建 OAuth App

打开 https://github.com/settings/applications/new ，填写：

| 字段                       | 值                                             |
| -------------------------- | ---------------------------------------------- |
| Application name           | Homura Personal Site Local                     |
| Homepage URL               | http://localhost:3000                          |
| Authorization callback URL | http://localhost:3000/api/auth/callback/github |

创建后记录 Client ID，并点击 Generate a new client secret。这里创建的是 OAuth App。

参考：[GitHub 官方说明](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)、[NextAuth 配置说明](https://next-auth.js.org/configuration/options)。

## 2. 填写本机配置

编辑 `apps/web/.env`，保留已有的数据库连接和随机会话密钥。

```dotenv
NEXTAUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=填写创建得到的ClientID
GITHUB_CLIENT_SECRET=填写创建得到的ClientSecret
OWNER_GITHUB_ID=填写站主账号的数字ID
```

登录入口要求 `DATABASE_URL`、`NEXTAUTH_SECRET`、`GITHUB_CLIENT_ID` 和 `GITHUB_CLIENT_SECRET` 均已填写。配置变化后重启当前工作树的开发服务。数据库连接与迁移见[本地 PostgreSQL 配置](./local-postgresql.md)。

查询自己的 GitHub 数字 ID，在 PowerShell 中执行（替换用户名）：

```powershell
(Invoke-RestMethod 'https://api.github.com/users/你的GitHub用户名').id
```

将返回的数字 ID 填入 `OWNER_GITHUB_ID`。服务端用它与 GitHub 登录身份比对。

## 3. 重启并验证

在项目根目录运行 `pnpm dev`，若服务已启动，先停止再重启。

1. 打开 [本地登录页](http://localhost:3000/zh/login)，确认 GitHub 登录按钮已启用。
2. 点击登录，在 GitHub 完成授权。回到网站后刷新，确认顶部显示已登录账号。
3. 用站主账号打开 [账号页](http://localhost:3000/zh/login)，确认「站主身份校验已通过」，再进入[管理后台](http://localhost:3000/zh/admin)。
4. 在未登录的隐私窗口打开管理页，确认会提示登录。使用普通测试账号登录时，确认后台拒绝访问。

真实 OAuth 验收覆盖授权回调、数据库用户写入和站内身份校验。

## 按阶段排查

| 现象                                                          | 检查                                                                                                                                                  |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 登录按钮不可用，或 `/api/auth/providers` 返回 `503`           | 确认当前端口对应的工作树，以及该工作树的数据库和 OAuth 环境变量。                                                                                     |
| 点击后未打开 GitHub                                           | 在浏览器的网络面板查看 `GET /api/auth/csrf` 和 `POST /api/auth/signin/github`。发起请求成功时，返回的授权地址应指向 GitHub。                          |
| GitHub 授权后回到登录页并报错                                 | 查看 Next.js 终端中的 `OAUTH_CALLBACK_ERROR`。核对实际打开的地址、`NEXTAUTH_URL` 和 GitHub 配置的回调地址。使用 `localhost:3000` 发起和接收本地授权。 |
| 回调日志显示 `connect EACCES` 或 `outgoing request timed out` | 检查开发服务所在进程的网络权限和代理配置。浏览器能打开 GitHub 时，Node.js 服务端仍可能无法完成令牌请求。                                              |
| 回调成功后仍显示未登录                                        | 确认站内会话 Cookie 由浏览器接收，并检查 `/api/auth/session`。再查数据库连接、迁移、账号状态和会话密钥是否一致。                                      |
| 已登录但后台拒绝访问                                          | 核对 `OWNER_GITHUB_ID`、账号封禁状态和 `site.manage` 检查结果。                                                                                       |

共享日志时只保留错误类型和时间。授权码、Cookie、密钥和完整环境文件应留在本机。

### 本机已有 HTTPS 代理时

如果已配置可信的 `HTTPS_PROXY`，使用支持该功能的 Node.js 22.21+ 或 24.5+。确认 `NO_PROXY` 包含 `localhost` 和 `127.0.0.1`。先停止旧开发服务，再在同一个 PowerShell 窗口启动。 [Node.js 代理配置](https://nodejs.org/learn/http/enterprise-network-configuration#proxy-configuration)

```powershell
$env:NODE_USE_ENV_PROXY = '1'
pnpm dev
```

代理变量在 Node.js 进程启动时读取。之后从同一个地址重新发起登录，验收真实授权返回和站内会话。
