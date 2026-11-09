# VS Code 断点调试

在 VS Code 打开仓库根目录 `E:\workspace\06999999`，不要只打开 apps/web。配置位于 `.vscode/launch.json`，使用 VS Code 内置 JavaScript 调试器，无需额外扩展。

## 一键全栈调试

1. 先停止已运行的 `pnpm dev`（对应终端按 Ctrl+C），避免占用 3000 端口。不要同时运行两个服务端调试配置。
2. 按 Ctrl+Shift+D，选择 **Next.js：全栈调试（Chrome）**。
3. 按 F5。配置启动 Next.js，服务就绪后自动打开调试 Chrome。
4. 在源码行号左侧点击设置断点，操作页面触发对应代码。
5. 按 Shift+F5 停止调试。全栈配置会同时结束其启动的浏览器调试会话。

固定使用 http://localhost:3000，以匹配 GitHub OAuth 回调。调试 Chrome 通常使用独立的浏览器资料，需要在这个窗口重新登录 GitHub/本站；它不一定共享日常 Chrome 的 Cookie。

Next.js 从 apps/web 读取现有 .env，不需要把密钥复制到 launch.json。Node 调试端口绑定本机回环地址；子进程自动附加，覆盖 Next.js 实际处理请求的进程。

## 三种配置

| 配置                                  | 用途                                                      |
| ------------------------------------- | --------------------------------------------------------- |
| Next.js：全栈调试（Chrome）           | 同时调试页面组件、Server Actions 和数据库服务             |
| Next.js：仅服务端调试                 | 调试服务端；可以用原来已登录的 Chrome 访问 localhost:3000 |
| Chrome：仅前端调试（先启动 pnpm dev） | 服务已运行时调试客户端，不会再启动 Next.js                |

## 用保存草稿练习

- 前端断点：`apps/web/src/components/markdown-editor.tsx` 中 `saveDraftAction(draft)` 所在行。
- 服务端断点位于 `apps/web/src/app/[lang]/write/actions.ts` 的 `currentActor()` 或事务调用所在行。
- 数据库服务断点：`apps/web/src/server/services/drafts.ts` 中 `saveDraft()` 内解析输入的位置。

登录后进入“我的草稿”，新建文章并点击保存。前端断点可查看 draft 的标题和正文，继续执行会进入服务端断点，再查看 actor、输入版本及数据库操作结果。

F5：继续；F10：单步跳过；F11：单步进入；Shift+F11：跳出当前函数。左侧 VARIABLES 查看变量，WATCH 添加关注表达式，CALL STACK 切换调用栈。

## 常见问题

- 3000 端口占用：先结束原来的开发服务；配置使用固定端口，不自动切换到 3001，以免 OAuth 地址不一致。
- 9229 调试端口占用：结束另一个 Node 调试会话。
- 断点为空心：先访问对应页面触发编译；确认客户端组件选用了 Chrome 调试，服务端代码选用了 Node 调试。
- 仅服务端模式不能停在按钮事件里：按钮事件在浏览器执行，需要全栈或仅前端配置。
- Node 或依赖找不到：在 VS Code 终端确认 `node --version`、`pnpm --version` 可运行，并完成 `pnpm install`、`pnpm db:generate`。

参考：[Next.js 调试文档](https://nextjs.org/docs/app/guides/debugging)、[VS Code Node.js 调试](https://code.visualstudio.com/docs/nodejs/nodejs-debugging)。
