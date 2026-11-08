# 二次元个人站

Next.js 全栈 + FastAPI 专项服务的基础工程。当前为可运行的首版骨架，未完成全部业务功能。

## 启动网站

需要 Node.js 22.12+（本次验证为 24.19）、pnpm 11.19。

```powershell
pnpm install
pnpm db:generate
pnpm dev
```

打开 http://localhost:3000 。无外部配置也能浏览首页与七个栏目；文章草稿需要登录和数据库连接。文章栏目读取已发布内容，其他栏目仍为基础展示。

## 界面语言

页面顶部可切换简体中文和 English。默认使用简体中文，选择会保存在当前浏览器。原有页面与文章地址可以继续使用，用户撰写的内容按原文展示。

界面文案和系统提示保存在 `apps/web/src/i18n/dictionaries/` 下的 `zh.json` 和 `en.json`。语言与词典的映射、加载方式和维护步骤见[当前 i18n 方案](doc/i18n.md)。

## 本地数据库

参阅 [Windows PostgreSQL 配置](doc/local-postgresql.md)。复制 apps/web/.env.example 为 apps/web/.env 并填写开发库连接；本地 .env 已存在时不要覆盖。

```powershell
pnpm db:deploy
pnpm db:status
```

也可在 Docker 已运行时使用 `docker compose -f infra/compose.yaml up -d` 创建独立开发库。已有本机 PostgreSQL 时无需 Docker，避免端口冲突。

## Python 服务

需要 uv；在 apps/python-api 中运行：

```powershell
uv sync --python 3.12
uv run uvicorn site_api.main:app --app-dir src --host 127.0.0.1 --port 8000
```

复制该目录 .env.example 为 .env，设置 SERVICE_TOKEN；网站的 PYTHON_SERVICE_TOKEN 使用同一值。未配置服务令牌时拒绝审核调用。当前 AI 适配器尚未接入，已认证调用固定转人工，不模拟通过。

## GitHub 登录

本地创建 OAuth App、填写环境变量与站主验收步骤见 [GitHub 登录配置](doc/github-oauth-local.md)。

填写 apps/web/.env 中的 GITHUB_CLIENT_ID、GITHUB_CLIENT_SECRET、NEXTAUTH_SECRET、NEXTAUTH_URL 和 OWNER_GITHUB_ID。GitHub OAuth 回调地址使用 `<NEXTAUTH_URL>/api/auth/callback/github`，本地默认 http://localhost:3000/api/auth/callback/github 。OWNER_GITHUB_ID 为稳定的账号数字 ID。

数据库迁移和 OAuth 配置完成前，登录按钮不可用。本地 GitHub OAuth 登录和站主身份已验证。权限检查每次读取账号状态，站主身份来自服务端 OWNER_GITHUB_ID；当前 User.role 字段保留于模型，不能依靠客户端或数据库普通角色修改获得站主身份。

## 验证

```powershell
pnpm db:validate
pnpm typecheck
pnpm test
pnpm build
```

Python 测试在 apps/python-api 中执行 `uv run pytest`。

## 当前范围

- 已实现：深紫色响应式首页、七栏目入口、Markdown 实时预览、数据库草稿列表与增删改、登录配置检测、GitHub 认证基础、站主页面访问检查。
- 已建立：Prisma 数据模型与初始迁移、权限/配额/域名/审核规则模块及测试、FastAPI 健康与认证审核接口。
- 待实现：其他栏目 CRUD、上传及配额事务、后台管理、点赞评论接口、审核任务执行、AI 供应商适配、网易云真实播放、宠物动画和角色插画。
- 音乐 Provider 是共享状态基础，不是已完成的网易云播放器；未接入曲目时控件禁用。

更多决策见 [规划目录](doc/README.md) 和 [开发进度](doc/development-status.md)。不在仓库保存真实服务器资料、密码或 API 密钥。

## 代码格式化

在 VS Code 打开仓库根目录并安装工作区推荐的 Prettier 扩展，即可保存时格式化。规则为 2 空格缩进、双引号、分号、尾随逗号、100 字符行宽和 LF 换行。

```powershell
pnpm run format
pnpm run format:check
```

根目录与 apps/web 均可执行上述命令，处理前端、文档和配置；生成文件、锁文件与 Python 缓存不参与。Python 格式化工具尚未同步到这个 E 盘项目。

## 文章草稿

登录后点击“写文章”，或从“我的文章”的“草稿”筛选继续编辑。填写标题和 Markdown 正文，点击“保存草稿”；关闭页面后可从列表重新打开继续编辑。草稿只对作者本人可见；保存后站主可直接发布，普通用户可提交人工审核。列表每页 20 篇；旧 `/drafts` 地址跳转到草稿筛选。

新草稿页可手动导入原浏览器的本地草稿，再保存到数据库。保存不是自动执行；编辑时离开页面前请先保存。旧标签页保存或删除时如有版本冲突，会提示重新打开，不会覆盖新版本。

数据库集成测试（需要已配置的本地数据库，测试用户与草稿全部事务回滚）：

```powershell
pnpm test:drafts
```

## 断点调试

VS Code 已配置 Next.js 服务端、Chrome 前端和一键全栈调试。打开仓库根目录，按 Ctrl+Shift+D 选择配置，再按 F5。详细步骤见 [调试指南](doc/debugging.md)。

## 文章发布与审核

保存草稿后，站主点击“直接发布”，普通用户点击“提交人工审核”。在“我的文章”（`/my-articles`）查看投稿状态；站主从管理后台进入“文章审核”（`/admin/reviews`），通过后立即在文章栏目公开。拒绝时填写原因，作者可复制为新草稿修改后重新投稿。

发布后可在“我的文章”中编辑。站主可直接发布修改，普通作者提交修改后等待人工审核，公开页面在审核通过前继续展示上次发布的版本。

详细流程、当前边界及测试命令见 [文章发布与人工审核](doc/article-publishing.md)。
