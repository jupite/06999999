# 二次元个人站

项目采用 pnpm workspace。`apps/web` 是 Next.js 网站，`apps/python-api` 是独立的 FastAPI 服务，`infra` 保存本地基础设施配置。

## 开发前阅读

先打开 [文档目录](doc/README.md)，按任务找到对应的功能文档和验收要求。开发新功能或改动现有交互前，查看 [待确认事项](doc/pending-decisions.md)，确认当前任务涉及的待定范围、权限和交互，再开始实现。

## 启动网站

需要 Node.js 22.12+（本次验证为 24.19）、pnpm 11.19。

```powershell
pnpm install
pnpm db:generate
pnpm dev
```

打开 [本地网站](http://localhost:3000)。需要持久化或登录的开发场景，按下方步骤配置数据库和 GitHub OAuth。

## 国际化维护

界面文案和系统提示保存在 `apps/web/src/i18n/dictionaries/` 下的 `zh.json` 和 `en.json`。语言与词典的映射、加载方式和维护步骤见[当前 i18n 方案](doc/i18n.md)。

## 本地数据库

参阅 [Windows PostgreSQL 配置](doc/local-postgresql.md)。首次配置时，将 `apps/web/.env.example` 复制为 `apps/web/.env` 并填写开发库连接。已有环境文件时，编辑其中对应的变量。

```powershell
pnpm db:deploy
pnpm db:status
```

也可在 Docker 已运行时使用 `docker compose -f infra/compose.yaml up -d` 创建独立开发库。已有本机 PostgreSQL 时无需 Docker，避免端口冲突。

## Python 服务

在 `apps/python-api` 中使用 uv 启动服务。

```powershell
uv sync --python 3.12
uv run uvicorn site_api.main:app --app-dir src --host 127.0.0.1 --port 8000
```

首次配置时，将该目录的 `.env.example` 复制为 `.env` 并设置 `SERVICE_TOKEN`。网站的 `PYTHON_SERVICE_TOKEN` 使用同一值。

## GitHub 登录

本地创建 OAuth App、填写环境变量与站主验收步骤见 [GitHub 登录配置](doc/github-oauth-local.md)。

在 `apps/web/.env` 中填写 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`NEXTAUTH_SECRET`、`NEXTAUTH_URL` 和 `OWNER_GITHUB_ID`。回调地址为 `<NEXTAUTH_URL>/api/auth/callback/github`，本地默认使用 `http://localhost:3000/api/auth/callback/github`。

## 验证

```powershell
pnpm db:validate
pnpm typecheck
pnpm test
pnpm build
```

Python 测试在 `apps/python-api` 中执行 `uv run pytest`。

## 代码格式化

在 VS Code 打开仓库根目录并安装工作区推荐的 Prettier 扩展，即可保存时格式化。规则为 2 空格缩进、双引号、分号、尾随逗号、100 字符行宽和 LF 换行。

```powershell
pnpm run format
pnpm run format:check
```

根目录与 `apps/web` 均可执行上述命令，处理前端、文档和配置。生成文件、锁文件与 Python 缓存按忽略规则排除。

## 断点调试

VS Code 已配置 Next.js 服务端、Chrome 前端和一键全栈调试。打开仓库根目录，按 Ctrl+Shift+D 选择配置，再按 F5。详细步骤见 [调试指南](doc/debugging.md)。
