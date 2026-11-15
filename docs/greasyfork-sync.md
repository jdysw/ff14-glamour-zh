# Greasy Fork 正式版同步

脚本 598839 的同步标识保持 `https://github.com/jdysw/ff14-glamour-zh/releases/latest/download/ff14-glamour-zh.greasyfork.user.js`，同步方式为 Webhook。

不要将 GitHub 的全部 `release` 事件直接发送给 Greasy Fork：它会优先下载事件里的附件，`latest/download` 只是匹配标识，不能过滤 beta。

正式 Release 工作流创建发行版后直接发送带 HMAC 签名的通知。另有 `Sync stable release to Greasy Fork` 工作流，处理由用户直接发布的 GitHub Release，并支持手动补同步最新正式版。前者使用 GITHUB_TOKEN 创建 Release，不会重复触发后者。

通知脚本再次验证 `draft=false`、`prerelease=false`、标签为 `v数字.数字.数字`、附件已上传且对应 GitHub 最新正式版。beta、rc、草稿不会发送请求，历史正式版也不能覆盖当前版本。HTTP 错误、同步失败或未匹配脚本均使工作流失败。

仓库 Actions Secrets：`GREASYFORK_WEBHOOK_URL` 与 `GREASYFORK_WEBHOOK_SECRET`，取自 Greasy Fork 账号的 webhook 页面。只保存在 Secrets，不写入源码或日志。使用 JSON、HMAC-SHA1（Greasy Fork 要求）和 HMAC-SHA256；HTTPS 校验保持启用。

通知失败后，可修复原因再手动运行同步工作流，输入最新正式版标签；不要重复运行 Release 来覆盖已发布版本。
