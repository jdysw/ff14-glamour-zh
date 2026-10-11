# 第四阶段真实七站公开页面审计记录

## 运行与判定口径

- 日期：2026-10-11（GitHub Actions 日志 UTC 时间）。
- GitHub Actions [七站扫描运行 #38164185413](https://github.com/jdysw/ff14-glamour-zh/actions/runs/38164185413)，对应测试提交 `409e2aa`。
- 使用无登录凭据的 GitHub Ubuntu 运行器、Headless Chrome、项目正式用户脚本构建物，每站最多 4 个 URL，仅作为 CI 中的自动化抽样。
- [原始脱敏报告与逐站日志工件](https://github.com/jdysw/ff14-glamour-zh/actions/runs/38164185413) 已由扫描工作流上传（保留期 14 天）。
- “访问失败”与“无漏翻”严格区别；只在成功返回业务页面后才计算翻译覆盖情况。

## 第一轮实际结果

| 站点 | 成功抽样 / 总抽样 | 状态和证据 |
|---|---:|---|
| FC | 4 / 4 | 完成扫描 |
| FFXIV Collection | 4 / 4 | 完成扫描 |
| Ronka | 3 / 4 | `/lookbook` 返回 HTTP 404，属错误的审计候选 URL，已从后续扫描配置中删除；首页就是 GALLERY |
| Mirapri | 0 / 2 | `/` 与 `/posts/` 均返回 HTTP 403 |
| Eorzea Collection | 0 / 4 | `/`、`/glamours/`、`/gearsets/`、`/about/` 返回 HTTP 403 |
| End Closet | 0 / 1 | `/` 返回 HTTP 403 |
| 灰机 Wiki | 0 / 1 | 物品详情页返回 HTTP 403 |

整体结果为 **partial（未完成）**；聚合作业按原有真实状态判断规则退出非零。不能把外部访问失败描述为脚本翻译功能故障，也不能把被封锁的页面计入“已检查且零漏翻”。

## 已修复与仍需复核

- 已修复：Ronka 的硬编码无效 `/lookbook` 审计地址；真实 GALLERY 页面为 `https://lookbook.ronkacloset.com/`，网站并不存在独立的 `/lookbook` 路由。
- 待复核：在可访问上述四站且获其服务正常响应的本地网络环境，使用 `npm run build` 后运行：
  ```sh
  node tools/coverage-audit/run-scan.mjs --site mirapri --channel local --discover --max-pages 24 --max-depth 2 --per-template 2 --wait 1500
  node tools/coverage-audit/run-scan.mjs --site ec --channel local --discover --max-pages 24 --max-depth 2 --per-template 2 --wait 1500
  node tools/coverage-audit/run-scan.mjs --site endcloset --channel local --discover --max-pages 24 --max-depth 2 --per-template 2 --wait 1500
  node tools/coverage-audit/run-scan.mjs --site wiki --channel local --discover --max-pages 24 --max-depth 2 --per-template 2 --wait 1500
  ```
- 也可以手动触发 `Live localization coverage audit (7 sites)` 工作流进行完整扫描。工作流保留“任何一站受阻则聚合检查失败”的规则，**不能为通过质量门禁而掩盖受阻状态**。
- GitHub 运行器来源 IP 被拒绝时，本地审计和手动检查才有机会拿到实际业务页面；不尝试绕过目标站点防护，也不收集用户凭证。

## 与性能基准的区别

这里使用真实公网页面，是**覆盖率与可访问性审计**。仓库 `tests/benchmark` 的 Chrome 1×/4×/8× CPU 节流仍运行离线夹具，不能替代真实移动端设备或者公网稳定网络的性能 P95。
