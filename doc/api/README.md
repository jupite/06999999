# API 文档

网站在 `/docs/api` 提供只读接口参考。通过页面顶部选择 Web、Python 或后台草案，查看方法、路径、认证要求、参数、响应和示例。

| 分组        | 状态   | 定义来源                                                      |
| ----------- | ------ | ------------------------------------------------------------- |
| Web         | 已实现 | [web.openapi.yaml](./web.openapi.yaml)                        |
| Python 服务 | 已实现 | [python.openapi.json](./python.openapi.json)，由 FastAPI 导出 |
| 后台权限    | 设计中 | [admin-draft.openapi.yaml](./admin-draft.openapi.yaml)        |

## 书写规则

- 使用 OpenAPI 3.1。每个操作填写唯一的 camelCase `operationId`、简短 `summary`、已登记的 `tags` 和 `security`。公开接口写 `security: []`。
- 有参数时写明位置、是否必填、类型及约束。JSON 和表单内容提供结构和示例。二进制内容注明媒体类型。
- 响应列出实际使用的状态码。示例中的 ID、Cookie、令牌和授权码使用占位值。
- 设计中的后台契约与已实现接口分开维护。网页展示文档，各接口的访问权限由服务端校验。

## 验证和更新

在仓库根目录运行 `pnpm api:lint` 校验三份规范。生产构建也会执行这个检查。

Python 路由、模型或示例有变动时，先运行 `pnpm api:python:generate` 更新快照，再运行 `pnpm api:python:check` 确认快照与源码一致。网页读取快照，Python 服务无需为展示文档而启动。
