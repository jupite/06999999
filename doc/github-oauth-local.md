# 本地 GitHub 登录配置与验收

适用项目：`E:\workspace\06999999`。本地访问统一使用 `http://localhost:3000`。

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

编辑 `apps/web/.env`，只修改对应字段，保留现有数据库连接和随机会话密钥：

```dotenv
NEXTAUTH_URL=http://localhost:3000
GITHUB_CLIENT_ID=填写创建得到的ClientID
GITHUB_CLIENT_SECRET=填写创建得到的ClientSecret
OWNER_GITHUB_ID=填写站主账号的数字ID
```

`NEXTAUTH_SECRET` 已于 2026-11-06 在本机生成，不要清空，也不要复制到示例文件或聊天中。真实 `.env` 不提交 Git。

查询自己的 GitHub 数字 ID，在 PowerShell 中执行（替换用户名）：

```powershell
(Invoke-RestMethod 'https://api.github.com/users/你的GitHub用户名').id
```

将返回的数字填入 `OWNER_GITHUB_ID`，不要填登录名。该字段由服务端与 GitHub 登录身份比对；没有“第一个用户自动成为站主”的规则。

## 3. 重启并验证

在项目根目录运行 `pnpm dev`，若服务已启动，先停止再重启。

1. 打开 http://localhost:3000/login ，确认 GitHub 登录按钮已启用。
2. 点击登录，在 GitHub 完成授权，返回网站。
3. 打开 http://localhost:3000/admin ，站主账号应显示“站主身份校验已通过”。
4. 在未登录的隐私窗口打开管理页，应提示“请先登录”。
5. 若有普通测试账号，其登录后应无法获得站主管理权限。

验收前不要把“已配置”记录为“登录已验证”。真实 OAuth 回调、数据库用户写入和登录后的站主身份需要一起确认。

## 常见问题

- 按钮不可用：检查数据库连接、Client ID、Client Secret 和 NEXTAUTH_SECRET 是否非空，修改后重启。
- 回调地址错误：OAuth App 和本机 NEXTAUTH_URL 都使用 localhost:3000，回调路径必须为 /api/auth/callback/github。
- 登录后不是站主：确认 OWNER_GITHUB_ID 是当前登录账号的数字 ID，账号未封禁，也没有显式禁止 site.manage。
- 登录失败：查看本机服务日志定位，不要公开授权 code、Cookie、密钥或完整环境文件。
