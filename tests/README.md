# tests/ —— 持久化测试资产

本目录维护当前构建的单元、集成、在线及基准测试。
默认套件**不依赖真实外网、不依赖开发者私人目录**（历史脚本位于开发机临时目录，已整体相对化）。

## 快速开始

```bash
npm run build     # 生成 dist/（测试读取构建产物）
npm test          # = unit + integration（离线可跑；自动确保 headless Chrome）
```

CI（`.github/workflows/test.yml`）：push / PR 自动跑「数据校验 → 构建 → 产物语法 → 生成物一致性 → 测试」，与本地命令同源。

## 目录

| 目录 | 内容 | 需要 Chrome | 需要外网 |
|---|---|---|---|
| `unit/` | 纯 Node 单元测试（正则行为、数据层 golden） | 否 | 否 |
| `integration/` | 夹具（fixtures）级集成测试 + 构建幂等 | 是（自动维护） | 否 |
| `live/` | 真站连通测试（fc / ronka / ACL / 数据站 e2e） | 是 | **是** |
| `benchmark/` | 性能基准（读取路径细分 + v2/v3 parse 对比） | 是 | 否 |
| `fixtures/` | 静态夹具页面（wiki / EC / mirapri 页结构） | — | — |
| `helpers/` | CDP 客户端、Chrome 守护、路径解析、词典生成 | — | — |

## 命令

| 命令 | 说明 |
|---|---|
| `npm test` | unit + integration（离线，推荐日常） |
| `npm run test:unit` | 单元测试（秒级） |
| `npm run test:integration` | 夹具集成测试 |
| `npm run test:live` | 真站测试（需要外网） |
| `npm run test:all` | unit + integration + live |
| `npm run test:core` | 发布前核心测试子集（跨套件快跑） |
| `npm run test:bench` | 性能基准（耗时较长） |
| `npm run validate:data` | 数据与词典结构校验（秒级，CI 同源） |
| `npm run version:check` | 版本单一源校验（package ≡ header ≡ dist） |

单跑某项：`node tests/integration/test-wiki.mjs`（任何测试都可直接运行，需先构建且 Chrome 就绪）。

## Chrome 约定

- 默认连接 `127.0.0.1:9223` 的 headless Chrome；**没有实例时会自动拉起**（结束后若为自动拉起则关闭）。
- `9222` 为 VNC 手工环境，测试**不会**触碰。
- 可用环境变量覆盖：`ZHX_CHROME_BIN`（浏览器可执行文件）、`ZHX_CDP_PORT`（端口）。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `ZHX_CDP_PORT` | `9223` | CDP 端口 |
| `ZHX_CHROME_BIN` | 自动探测 | Chrome 可执行文件路径 |
| `ZHX_TEST_TIMEOUT_MS` | `320000` | 单项测试超时 |
| `ZHX_TEST_QUIET` | 未设置 | =1 时 runner 不实时透传输出（日志仍保留） |
| `GF` | `dist/` 产物 | 覆盖待测脚本文本路径 |

## 维护约定

- 测试生成物（临时脚本、日志、浏览器配置等）写入 `tests/.cache/`。
- 缓存测试应预置成功检查状态与 candidatePolicy=1，避免首次强制刷新改变测试网络路径；修改 v3 数据生成源后，应重新生成 v3 测试数据。
- 测试读取构建后的 `dist/`；改动相关源码或打包形态后，先运行 `npm run build`，再运行受影响的测试套件。
- 部分测试从构建产物提取带 `@zhixia` 标记的代码段，或依赖文本锚点。改动对应段落时，按测试报错更新提取范围或锚点，避免测试悄悄失效。
- `src/main.js`、`src/core/`、`src/sites/` 是当前唯一代码源码；构建不会覆盖这些模块。词典源为 `dict/*.json`，构建生成的内嵌词典不应手改。
- 站点 host 与数据配置集中在 Site Registry；新增或修改站点支持时，同步维护适配器、词典和相关集成测试。
- 测试项目与模块架构的历史记录见 [重构计划](../docs/v1.4-refactor-plan.md) 和 [重构进度](../docs/v1.4-progress.md)。
