# 测试

先运行 `npm run build`，再运行 `npm test`。默认用构建后的用户脚本在离线 Chromium 夹具上验证用户流程。

| 命令 | 目的 |
| --- | --- |
| `npm test` / `npm run test:e2e` | 离线浏览器端到端回归 |
| `npm run test:e2e-tools` | 按需验证探测、审计和独立测试安装包 |
| `npm run test:contracts` | V3 数据加载、分类及部署契约 |
| `npm run test:unit` | 按需运行既有 Node 行为回归 |
| `npm run test:coverage` | native 测试，同时生成真实 V8 / LCOV |
| `npm run test:build` | 构建可重现、篡改词典被拒绝、重新生成能够修复 |
| `npm run test:experimental` | 显式运行存储审计和基准报告工具的回归 |
| `npm run test:live` | 显式运行真站检查，需要网络，可能受 403／反爬影响 |
| `npm run test:bench` | 性能测量 |

CI 构建一次待测产物，`wiki` 和 `sites` 两组浏览器流程复用该产物。构建和数据契约检查独立验证可重现性、损坏输入和 V3 发布边界。源码覆盖率只采集一次，同一提交的 Sonar 扫描复用该 LCOV 报告。外站审计和性能测量按需运行。

## 选择测试

```powershell
node tests/run.mjs --list
node tests/run.mjs --suite=wiki
node tests/run.mjs --suite=sites
node tests/run.mjs e2e/test-miramiru
```

按完整路径或唯一文件名精确匹配，不再使用子串。名字不存在或同时命中离线／在线文件时直接报错，防止多跑、漏跑和意外联网。单项耗时记录在 `tests/.cache/logs/last-summary.json`。

Chrome 默认使用隔离的 9223 端口，runner 只关闭自己启动的实例。可设置 `ZHX_CDP_PORT`、`ZHX_CHROME_BIN`、`ZHX_TEST_TIMEOUT_MS`、`ZHX_TEST_QUIET`。Windows 的 Python 子进程默认使用 UTF-8 输出。

## 保留什么测试

- 从实际故障、用户动作或对外协议出发，断言可观察结果。例如中文搜索保留筛选、向原站派发原文、输入框仍显示中文。
- 保留失败分支：HTTP 响应体超时、存储拒绝、损坏缓存、未知物品、慢页面、用户内容保护。
- 运行时只测试当前数据格式；旧清单、旧缓存与缺层词典只保留“必须拒绝”的输入反例，不再维持旧版成功迁移路径。
- 同一行为跨站点用数据矩阵。站点独有的 Vue 控件、Wiki 慢加载等单独验证。浏览器用例等待实际 DOM 或事件，固定等待只用于模拟延迟或验证一段时间内保持不变的行为。
- 同一行为由一个主要入口验证。源码回归优先直接导入生产模块，保留端到端难以复现的超时、缓存和候选策略边界。在线验收覆盖离线夹具无法验证的真实数据站或站点集成。
- 静态结构、版本和词典一致性由正式构建检查负责。测试补充“故意破坏后应失败”等行为反例。

## 不再新增什么

- 复制生产正则或算法后，只测试副本。
- 用源码字符串、内部函数名、固定缓存数量、文件曾被删除等断言冻结实现。
- 把完整词典复制成期待表，再逐条断言同一份译文。少量独立样本代表边界，实际漏翻交给真实页面审计。
- 为覆盖率数字重复执行同一批浏览器场景。独立安装包只检查内置数据和缓存隔离，不再重跑完整三语功能测试。

站点测试包可用 `build:miramiru-test`、`build:eden-test`、`build:xivc-test` 生成；`build:font-test` 只测试共用字体。产物带当前 package 版本，正式版支持后停用独立测试版。

临时日志、扫描结果与报告放在 `tests/.cache/` 或 `.cache/`，不把一次性验收记录提交成维护文档。可执行夹具和 `tests/benchmark/baseline/` 是回归输入，继续保留。
