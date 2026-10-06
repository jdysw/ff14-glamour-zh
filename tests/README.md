# tests/ —— 持久化测试资产

v1.4 Phase 1 建立：PR #15 及此前的全部回归验证已迁入本目录，作为仓库内可重复执行的测试基线。
默认套件**不依赖真实外网、不依赖开发者私人目录**（历史脚本位于开发机临时目录，已整体相对化）。

## 快速开始

```bash
npm run build     # 生成 dist/（测试读取构建产物）
npm test          # = unit + integration（离线可跑；自动确保 headless Chrome）
```

## 目录

| 目录 | 内容 | 需要 Chrome | 需要外网 |
|---|---|---|---|
| `unit/` | 纯 Node 单元测试（正则行为、数据层 golden） | 否 | 否 |
| `integration/` | 夹具（fixtures）级集成测试 + 构建幂等 | 是（自动维护） | 否 |
| `live/` | 真站连通测试（fc / ronka / ACL / 数据站 e2e） | 是 | **是** |
| `benchmark/` | 读取路径性能基准（PR #15 工具） | 是 | 否 |
| `fixtures/` | 静态夹具页面（wiki / EC 页结构） | — | — |
| `helpers/` | CDP 客户端、Chrome 守护、路径解析、词典生成 | — | — |

## 命令

| 命令 | 说明 |
|---|---|
| `npm test` | unit + integration（离线，推荐日常） |
| `npm run test:unit` | 单元测试（秒级） |
| `npm run test:integration` | 夹具集成测试 |
| `npm run test:live` | 真站测试（需要外网） |
| `npm run test:all` | unit + integration + live |
| `npm run test:core` | 发布前核心 8 项（跨套件快跑） |
| `npm run test:bench` | 性能基准（耗时较长） |

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

- **测试产物**（注入副本、日志、Chrome profile、词库生成物）一律写 `tests/.cache/`（已 gitignore），不污染工作区。
- **锚点纪律**：部分测试用「锚点计数断言 + split/join 全量替换」向测试副本注入埋点（如 `bench-read-path` 的数据链埋点、`test-index-scope` 的 `__zhxDebug`）；
  修改 `src` 的 `buildTables` / `_ensureReadLocal` 等被锚定区段时，**必须同步检查相关测试的锚点计数**（历史多次踩坑）。
- **站点测试钩子（v1.4 Phase 3 起内建于 src）**：`__zhxTestSite`（指定站点）/ `__zhxTestTables` / `__zhxTestIndexes`（覆写表 / 索引配置）——集成测试在页面注入前 eval 设置即可，无需文本注入。
- **数据层测试（`unit/test-data-layer.mjs`）**：按锚点从 `dist` 提取数据层代码段、在 Node 内装配运行（无需 Chrome / 外网）；
  改动数据层函数的首尾特征文本时，提取会以「锚缺失 / 锚不唯一」明确报错，按报错更新该文件的 `ANCHORS` 即可。
- **Site Registry 测试（`unit/test-site-registry.mjs`）**：从 `dist` 提取 `@zhixia:site-registry` 区段装配运行；
  六站 host 匹配 / 表与索引清单 / 未知 host 不启动 / 测试钩子均在此冻结；改动区段内 host 判定逻辑前先看此文件。
- 失败返回非 0；runner 汇总结果见 `tests/.cache/logs/last-summary.txt`。
- 本目录基线来自 PR #15 的 16 项回归 + 构建幂等测试（新增）；迁移历史见仓库提交记录。
