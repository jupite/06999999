# 音乐播放器

在音乐页粘贴网易云单曲或歌单的完整链接。加载后点击播放键或队列中的曲目。播放器支持暂停、进度拖动和切歌。离开音乐页后，可在同一语言的站内页面通过悬浮控件继续操作，点击悬浮曲名返回音乐页。拖动位置在当前站内会话中保留。

支持 `music.163.com/song?id=…`、`music.163.com/#/playlist?id=…` 和相应的移动端完整链接。歌单一次加载最多 100 首。不可播放时可以打开网易云原页面。刷新页面或切换语言会重新建立播放实例。粘贴链接只加载到当前会话的播放队列，音乐投稿另行接入。

## 服务配置

1. 部署受信任的 [NetEase Cloud Music API Enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced) 社区服务。
2. 在 `apps/web/.env` 或部署环境设置 `NETEASE_MUSIC_API_URL`，例如 `http://127.0.0.1:3001`。容器部署时使用 Web 服务可访问的内部地址。
3. 重启 Web 服务，进入音乐页加载可公开播放的单曲和歌单。验证播放、暂停、拖动进度，以及离开音乐页后的悬浮控制。

Web 服务通过 `/song/detail`、`/playlist/track/all` 和 `/song/url/v1` 获取元信息和按需解析的音源。浏览器直接向网易云 CDN 请求音频。站内播放依赖 API 所在地区、歌曲版权状态和 CDN 可用性。试听资源会显示为不可播放。
