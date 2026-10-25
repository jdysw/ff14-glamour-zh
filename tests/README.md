# 测试

先运行 `npm run build`，再运行 `npm test`。默认执行离线 Node 行为测试和 Chrome 夹具测试，不访问真实站点。

| 命令 | 目的 |
| --- | --- |
| `npm test` | 默认离线回归：unit + native + integration |
| `npm run test:unit` | Node 回归，包含直接导入生产模块的 native 测试 |
| `npm run test:integration` | 完整脚本在 Chrome 夹具上的用户行为 |
| `npm run test:coverage` | native 测试，同时生成真实 V8 / LCOV |
| `npm run test:build` | 构建可重现、篡改词典被拒绝、重新生成能够修复 |
| `npm run test:experimental` | 显式运行存储审计和基准报告工具的回归 |
| `npm run test:live` | 显式运行真站检查，需要网络，可能受 403／反爬影响 |
| `npm run test:bench` | 性能测量 |

CI 的 build job 生成待测产物并验证可重现性，后续单元／浏览器任务下载同一份产物。Node 回归与 native 覆盖率各运行一次，浏览器按 `wiki`、`sites` 两个明确套件分组。数据基线工作流只验证现行 V3 的发布完整性、存储审计和 Pages 去重路径；未投产的 V3.1 原型已移除。外站审计工作流仅手动触发，仍严格保留受阻页面和失败状态。

## 选择测试

```powershell
node tests/run.mjs --list
node tests/run.mjs --suite=wiki
node tests/run.mjs --suite=sites
node tests/run.mjs integration/test-miramiru
```

按完整路径或唯一文件名精确匹配，不再使用子串。名字不存在或同时命中离线／在线文件时直接报错，防止多跑、漏跑和意外联网。单项耗时记录在 `tests/.cache/logs/last-summary.json`。

Chrome 默认使用隔离的 9223 端口，runner 只关闭自己启动的实例。可设置 `ZHX_CDP_PORT`、`ZHX_CHROME_BIN`、`ZHX_TEST_TIMEOUT_MS`、`ZHX_TEST_QUIET`。Windows 的 Python 子进程默认使用 UTF-8 输出。

## 保留什么测试

- 从实际故障、用户动作或对外协议出发，断言可观察结果。例如中文搜索保留筛选、向原站派发原文、输入框仍显示中文。
- 保留失败分支：HTTP 响应体超时、存储拒绝、损坏缓存、未知物品、慢页面、用户内容保护。
- 运行时只测试当前数据格式；旧清单、旧缓存与缺层词典只保留“必须拒绝”的输入反例，不再维持旧版成功迁移路径。
- 同一行为跨站点用数据矩阵；站点独有的 Vue 控件、Wiki 慢加载等单独验证。
- 优先直接导入生产模块。旧提取式测试仍有独立故障场景的暂时保留，逐步迁移；不把它们当真实源码覆盖率。
- 静态结构、版本和词典一致性由正式构建检查负责。测试补充“故意破坏后应失败”等行为反例。

## 不再新增什么

- 复制生产正则或算法后，只测试副本。
- 用源码字符串、内部函数名、固定缓存数量、文件曾被删除等断言冻结实现。
- 把完整词典复制成期待表，再逐条断言同一份译文。少量独立样本代表边界，实际漏翻交给真实页面审计。
- 为覆盖率数字重复执行同一批浏览器场景。独立安装包只检查内置数据和缓存隔离，不再重跑完整三语功能测试。

站点测试包可用 `build:miramiru-test`、`build:eden-test`、`build:xivc-test` 生成；`build:font-test` 只测试共用字体。产物带当前 package 版本，正式版支持后停用独立测试版。

临时日志、扫描结果与报告放在 `tests/.cache/` 或 `.cache/`，不把一次性验收记录提交成维护文档。可执行夹具和 `tests/benchmark/baseline/` 是回归输入，继续保留。
