# API 文档

接口说明统一在 `/docs/api` 展示。文档公开查看，各接口仍按下方要求验证权限。

- [Web 接口](#web-接口) · 健康检查、GitHub 登录、音乐、媒体
- [后台接口](#后台接口) · 功能开关、角色、用户权限
- [Python 服务接口](#python-服务接口) · 健康检查、审核

## 展示格式

每项包含概览、请求、响应和示例。概览注明方法、路径、用途、权限及实现状态。请求只列实际参数，响应列成功结构和调用方需要处理的错误。示例中的 ID 和凭据均为占位值。

## Web 接口

### `GET /api/health`

**已实现 · 公开 · 检查 Web 服务是否响应**

无请求参数。返回 `200` 和 JSON。

```bash
curl http://localhost:3000/api/health
# {"status":"ok","service":"web"}
```

### GitHub 登录

**已实现 · 站内浏览器 · 由 NextAuth 管理**

| 方法与路径                      | 请求                                                   | 响应                                                             |
| ------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------- |
| `GET /api/auth/providers`       | 无参数                                                 | `200`，已配置的登录提供方                                        |
| `GET /api/auth/csrf`            | 无参数                                                 | `200`，`{ csrfToken }` 和对应 Cookie                             |
| `POST /api/auth/signin/github`  | 表单字段 `csrfToken`，以及站内 `callbackUrl`           | 返回 GitHub 授权地址，浏览器随后跳转                             |
| `GET /api/auth/callback/github` | GitHub 回传授权 `code` 和 `state`                      | 成功时设置会话 Cookie 并跳转，失败时返回登录错误页               |
| `GET /api/auth/session`         | 浏览器会话 Cookie                                      | `200`，有效会话含 `githubId` 和 `expires`，匿名请求通常返回 `{}` |
| `POST /api/auth/signout`        | 会话 Cookie、表单字段 `csrfToken` 和站内 `callbackUrl` | 清除当前会话，返回退出后的跳转地址                               |

未配置登录时以上接口返回 `503`。浏览器通过 NextAuth 客户端发起登录和退出，并保留 CSRF Cookie。调用示例以查询匿名会话为例。

```bash
curl http://localhost:3000/api/auth/session
# {}
```

### `GET /api/music`

**已实现 · 公开 · 查询已入库曲目的歌词或音源**

必填查询参数 `kind` 为 `lyrics` 或 `stream`，`id` 为 1 至 18 位正整数形式的网易云曲目 ID。

- `200` · 歌词返回 `{ lines: [{ time, text }] }`。时间单位为秒，无时间戳时为 `null`，无歌词时 `lines` 为空数组。音源返回 `{ url }`，曲目不可播放时为 `null`。
- `400` 参数无效。 `404` 曲目未入库。 `503` 未配置网易云 API。 `502` 查询失败。这些错误的响应体为空。

```bash
curl "http://localhost:3000/api/music?kind=lyrics&id=12345"
# {"lines":[{"time":12.5,"text":"示例歌词"}]}
```

### 媒体

**已实现 · 上传需登录并具有 `image.upload` 权限 · 读取按图片可见性授权**

| 方法与路径            | 请求                                                               | 响应                                                                                           |
| --------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `POST /api/media`     | 同源请求，携带会话 Cookie。请求体是 JPEG、PNG 或 WebP 的原始二进制 | `201`，`{ url }` 返回站内图片地址                                                              |
| `GET /api/media/{id}` | 路径参数 `id`，取上传响应地址中的图片 ID                           | `200 image/webp`。未发布的图片仅上传者和有管理权限的站主可读。图片不存在或无权读取时返回 `404` |

上传失败以 `{ error }` 返回错误键。常见状态为 `400` 无效图片、`401` 未登录、`403` 禁止上传、`409` 配额不足、`413` 超出大小限制、`503` 存储未配置和 `507` 磁盘空间不足。

```bash
curl -b "$SESSION_COOKIE" -H "Content-Type: image/png" \
  --data-binary @example.png http://localhost:3000/api/media
# {"url":"/api/media/00000000-0000-4000-8000-000000000001"}

curl -b "$SESSION_COOKIE" -o example.webp \
  http://localhost:3000/api/media/00000000-0000-4000-8000-000000000001
```

## 后台接口

**设计中 · 拟开放给通过 `site.manage` 检查的站主**

下表是 HTTP 契约。站内后台可先通过现有 Server Actions 和服务端查询实现相同操作。当前按每个用户分配一个自定义角色设计。

| 方法与路径                                    | 请求                                            | 成功响应                                  |
| --------------------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| `GET /api/admin/features`                     | 无参数                                          | `200`，开关列表，每项包含功能键及开关状态 |
| `PATCH /api/admin/features/{key}`             | 功能键和 `{ enabled: boolean }`                 | `200`，更新后的开关                       |
| `GET /api/admin/roles`                        | 无参数                                          | `200`，角色列表及各角色的分配人数         |
| `POST /api/admin/roles`                       | `{ name, permissions }`                         | `201`，新角色及权限预设                   |
| `GET /api/admin/roles/{id}`                   | 角色 ID                                         | `200`，角色详情                           |
| `PATCH /api/admin/roles/{id}`                 | 角色 ID 及要变更的 `name` 或 `permissions`      | `200`，更新后的角色                       |
| `DELETE /api/admin/roles/{id}`                | 角色 ID                                         | `204`，角色已删除                         |
| `PUT /api/admin/users/{id}/role`              | 站内用户 ID 和 `{ roleId }`，传 `null` 解除分配 | `200`，当前角色分配                       |
| `PUT /api/admin/users/{id}/permissions/{key}` | 站内用户 ID、功能键和 `{ mode }`                | `200`，当前个人设置和生效结果             |
| `GET /api/admin/users/{id}/permissions`       | 站内用户 ID                                     | `200`，角色、个人例外和各项生效原因       |

角色的 `permissions` 按功能键配置，个人权限的 `mode` 使用 `inherit`、`allow` 或 `deny`。判定顺序为账号封禁、全站开关、个人例外、角色、默认规则。变更写入审计日志。

拟定错误响应为 `{ error }`。 `400` 请求无效，`401` 未登录，`403` 无管理权限，`404` 目标不存在。删除仍有用户使用的角色返回 `409`。

```bash
curl -b "$ADMIN_SESSION_COOKIE" \
  http://localhost:3000/api/admin/users/user_example/permissions
```

```json
{
  "roleId": "role_example",
  "permissions": [
    {
      "key": "project.submit",
      "featureEnabled": false,
      "roleRule": "allow",
      "userOverride": "inherit",
      "allowed": false,
      "source": "feature_disabled"
    }
  ]
}
```

## Python 服务接口

**已实现 · 独立服务 · 审核接口使用服务令牌**

| 方法与路径            | 请求                                                                                                                                        | 响应                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `GET /health`         | 无参数，无需认证                                                                                                                            | `200`，`{ "status": "ok", "service": "python-api" }`             |
| `POST /v1/moderation` | `Authorization: Bearer <token>`。JSON 必填字段为 `content_id`（1 至 100 字符）、`version`（大于等于 1 的整数）、`text`（最多 100,000 字符） | `200`，返回内容 ID、版本、审核决定和说明。当前决定固定为 `human` |

审核请求未通过认证返回 `401`，服务令牌未配置返回 `503`，请求字段校验失败返回 `422`。

```bash
curl http://localhost:8000/health
curl -H "Authorization: Bearer $SERVICE_TOKEN" -H "Content-Type: application/json" \
  --data '{"content_id":"example","version":1,"text":"待审核内容"}' \
  http://localhost:8000/v1/moderation
# {"content_id":"example","version":1,"decision":"human","reason":"AI provider not configured; manual review required"}
```
