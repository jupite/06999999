# Windows 本地 PostgreSQL 配置

已检测到本机 PostgreSQL 18 服务。本文仅提供本地开发说明，不记录实际凭据。

## 1. 创建开发专用用户与数据库

在 pgAdmin 的 postgres 数据库 Query Tool 中，以 postgres 管理员执行以下命令；将占位密码替换为自己设置的密码，不要提交真实密码到仓库：

```sql
CREATE ROLE site_app LOGIN PASSWORD 'REPLACE_WITH_YOUR_PASSWORD';
```

然后单独执行下一条，确保开启自动提交，不在事务块内运行 CREATE DATABASE：

```sql
CREATE DATABASE site_dev OWNER site_app;
```

若角色或数据库已经存在，不要重复创建，也不要删除现有数据。选择专用的空开发库，避免将迁移应用到其他项目的数据库。

## 2. 配置连接

编辑 apps/web/.env 的 DATABASE_URL：

```dotenv
DATABASE_URL=postgresql://site_app:YOUR_URL_ENCODED_PASSWORD@localhost:5432/site_dev
```

密码包含 @、#、:、/、% 等字符时，需要对密码部分进行 URL 编码。SQL 中设置的原密码不进行 URL 编码。

.env 已被 Git 忽略；不要将真实密码写入 .env.example 或文档。默认本机端口为 5432，若安装时修改过端口则使用实际端口。

## 3. 应用现有迁移

在项目根目录运行：

```powershell
pnpm db:deploy
pnpm db:status
pnpm db:generate
```

db:deploy 使用已提交的迁移，不需要 shadow database。以后修改模型使用 db:migrate 时需配置独立 shadow database 或为本地开发账号设置相应权限；正式运行账号不因此获得创建数据库权限。

当前迁移创建基础表，不会填充内容。数据库接通不代表后台 CRUD 已完成。

## 4. 验证

db:status 应显示迁移已应用。修改环境配置后重启 Next.js 服务。GitHub 登录还需另行填写 OAuth 配置与 NEXTAUTH_SECRET；数据库密码不必发给助手。
