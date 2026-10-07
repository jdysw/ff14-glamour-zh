# tests/ —— 持久化测试资产

v1.4 Phase 1 建立：PR #15 及此前的全部回归验证已迁入本目录，作为仓库内可重复执行的测试基线。
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
| `npm run validate:data` | 数据与词典结构校验（秒级，CI 同源） |
| `npm run version:check` | 版本单一源校验（package ≡ src ≡ header ≡ dist） |

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
  另注意**产物缩进形态**：Phase 15 起 `dist/` 为 rollup IIFE 输出——模块内容整体较 `src/` +2 缩进；多行内联锚点（含缩进的行）须对照当前产物维护，失配会以「锚点计数异常」明确报错（哨兵，防静默错位；按报错更新锚点即可）。
- **站点测试钩子（v1.4 Phase 3 起内建于 src）**：`__zhxTestSite`（指定站点）/ `__zhxTestTables` / `__zhxTestIndexes`（覆写表 / 索引配置）——集成测试在页面注入前 eval 设置即可，无需文本注入。
- **数据层测试（`unit/test-data-layer.mjs`）**：按锚点从 `dist` 提取数据层代码段、在 Node 内装配运行（无需 Chrome / 外网）；
  改动数据层函数的首尾特征文本时，提取会以「锚缺失 / 锚不唯一」明确报错，按报错更新该文件的 `ANCHORS` 即可。
- **Site Registry 测试（`unit/test-site-registry.mjs`）**：从 `dist` 提取 `@zhixia:site-registry` 区段装配运行；
  六站 host 匹配 / 表与索引清单 / 未知 host 不启动 / 测试钩子均在此冻结；改动区段内 host 判定逻辑前先看此文件。
- **Core 测试（`unit/test-core.mjs`）**：从 `dist` 提取六类 core 区段（runtime / constants / storage / http / cache / dom）装配运行（假 GM / fetch 宿主）；
  storage / http / cache / dom / runtime / constants 行为与跨版本契约（存储键、序列化格式）均在此冻结；
  注意：假宿主桩必须在 `buildCore(env)` 之前设置（装配参数为值捕获，装配后替换不生效）。
- **Dictionary / Translator 测试（`unit/test-dictionary.mjs`）**：从 `dist` 提取 `@zhixia:core-dictionary` / `@zhixia:core-translator` 区段装配运行（六层词表从空对象起、tr 系用前缀桩、修正扫描用 mock TreeWalker）；
  词典接口（get / has / update / getRevision / invalidate）、old→new 定向替换、派生缓存失效与翻译接口分发均在此冻结；「真实译文」由 integration / live 套件端到端覆盖。
- **Item Resolver 测试（`unit/test-item-resolver.mjs`）**：从 `dist` 提取 `@zhixia:core-item-resolver` 区段装配运行（重名 / 别名注册表用构造样例；`itemDbReady` 提供与缺省两条路径都测）；
  统一解析契约（hash / 名称 / 全量重名 / 别名 / 优先级与历史兜底）均在此冻结。
  注意：数据层测试装配体须屏蔽 `itemDbReady`（`'itemDbReady = undefined;'`）——否则 resolver 区段尾的就绪注册会级联 `ensureTables → _ensureFinalize`（装配体未含探测区函数）；注册行为由本文件专测。
- **Observer 测试（`unit/test-observer.mjs`）**：从 `dist` 提取 `@zhixia:core-observer` / `@zhixia:core-dom` 区段装配运行（假 MutationObserver / document / timer 桩，手动触发 + 手动跑 timer）；
  统一调度契约（1/100/1000 节点规模、父子去重、重复入队去重、flood 重置、characterData 默认关闭与 filter、站点独立 debounce、disconnect 扩展位）均在此冻结。
- **Targets 测试（`unit/test-targets.mjs`）**：从 `dist` 提取 `@zhixia:core-targets` 区段装配运行（`resolveByName` / `EC_CARD_SEL` / `document` 以桩注入）；
  全页 / 局部同路径、四类 target（item / plain-item / card / dye）判定与字段、分派顺序、幂等（flag 跳过与 React 重建重采）均在此冻结。
- **Site Adapter（Phase 9，同 `test-site-registry.mjs` G 组）**：适配器接口面（boot/pageshow/processRoot/destroy 齐全、boot 调 start、DATA_REMOTE 两态补扫注册、onPageShow 补跑）；装配采用站点函数桩（STUB_NAMES 记录调用）+ `buildDevice(dataRemote)` 参数化。
- **Probe 与统计（Phase 10）**：`integration/test-probe.mjs` 增验报告含 `obs: / resolver:` 统计行；`unit/test-observer.mjs` H 节冻结观察统计（ticks / nodes）；`unit/test-item-resolver.mjs` A2 节冻结 resolveEcId / resolveKo 与 hit/miss 计数；`unit/test-data-layer.mjs` 已适配 resolver 接口（原 lookupEcIdByZh / ronkaKoByZh 名退役）。
- **DataManager（Phase 11，`unit/test-data-manager.mjs`）**：装配 core-cache（2 段）+ core-data-manager 区段（24 个外部标识符以 new Function 参数注入桩）；冻结快路径零网络（每日至多一次版本检查）、版本变更下载、服务器不可用降级、旧缓存兜底与 invalidate 语义。
- **Runtime Data v3（Phase 12，`unit/test-runtime-v3.mjs`）**：A 段校验生成器产物（manifest 结构、逐文件 sha256/bytes、names 去重与染剂回退、站点清单——`data/v3/` 未预生成时自动重建到临时目录）；B 段装配 core-cache + core-data-manager 区段，冻结 v3 加载（成功应用 + 缓存写入 / 零网络快路径 / manifest-404 / schema 不兼容 / sha 不匹配 → 回退）与 `_ensureMain` / `_ensureFinalize` 接入语义。注意：`_ensureTryFast` / `_ensureFetchAll` / `_waitPageLoad` 在提取段内有真实定义、会遮蔽同名桩参数——回退行为以「发出的 v2 请求」观测。
- **v3 探测与离线集成测试**：`integration/test-ec.mjs`（⑥ 零网络）与 `integration/test-wiki.mjs`（场景 B/C）预置 `gm:zhx.v3.manifest`（本站不在其中 → v3 静默跳过、24h 内不再探测）；未预置时首跑会发一次 v3 manifest 探测请求（每日至多一次），属预期行为。
- **v3 上线后的 live 适配（Phase 14 收尾）**：`live/e2e-real-dict.mjs` 按 v3 链路断言（`zhx.v3.f.fc.*` 缓存 + manifest 写入 + dict 结构）；`live/test-dict-rt.mjs` 预置「新鲜空 v3 manifest」使 v3 静默回退 v2（mock 另含 v3 manifest 兜底）——该测试聚焦 v2 词库运行时链本身。
- **Phase 13 语言裁剪与基准**：`unit/test-runtime-v3.mjs` A 段含语言裁剪断言（ja 表无韩文 / en 表无韩文假名 / ko 表无假名；dup 按语言裁剪 13/20/19）；`unit/test-item-resolver.mjs` 含 `_irBuildAux` 的 v3 守卫断言；`benchmark/bench-v3-load.mjs`（纯 Node、免 Chrome）对比 v2/v3 全链 parse 与 TSV / JSON 格式（结论：维持 TSV）；`bench-read-path` 已随 v1.4 适配（`_btStep` / `__zhxMark` 锚点、v3 探测预置、历史变体退役）。
- **Phase 14 缓存注册表**：`unit/test-cache.mjs`（40 断言）冻结 `@zhixia:core-cache-registry`——登记完整性（8 条 / 三类 kind）、按类清理与全清、`cacheInfo` 观测、`cacheGuard` 容量防线（Map / 对象 + 计数器）、异常安全与同名覆盖语义；`unit/test-core.mjs` 增注册表节（提取 + 登记数 + guard）；`test-dictionary` 与 `test-data-layer` 的装配面含注册表段（`dictInvalidate` / 查找函数已经由注册表按类清理的依赖）。
- **Phase 15 模块化构建**：`src/` 为构建链输出（`bash build.sh`：词典注入 → 块切分 → 接口 → 顺序契约 → Rollup → 顺序 / 锚点 / wiring / 词典四道验收）——**改动一律落单文件源与 `build/` 链，直接改 `src/core|sites` 模块会被下次构建覆盖**；测试提取依赖 `@zhixia` 锚点对（配对健康由构建链守护），部分段尾注释（如 `@zhixia:core-item-resolver-end`）随其前置块迁移属切分器设计行为（提取窗口自适应）；调整块归属（`module-assign.json`）或顺序契约（`module-order.json`）后须全量回归（unit + integration）。
- **Phase 16 词典单一源**：`integration/test-dict-single-source.mjs`（12 断言）冻结「dict/*.json = 唯一权威源」契约——A) src 内嵌 ≡ JSON 源（verify 模式1）；B) 6 个词典块带 inject 维护的「自动生成」标识（恰 6 条）；C) 反证：篡改副本经 verify 必失败 → inject 再生必恢复（手改被覆盖）；D) 远程产物（make_dict_json → dict.json）≡ src 内嵌（verify `--dict-json`）；E) build.sh 含 ⑮/⑯ 两步。改动词典链路（inject / make_dict_json / verify）后须全量回归。
- **Phase 17 发布 / CI 重构**：版本单一源 = `package.json`（`build/version.mjs` 同步 → `--check` 四源校验；build.sh ⓪/⑰ 步、release 发布门前置）；`integration/test-version-consistency.mjs`（13 断言）冻结契约（四源一致 / 唯一性 / 治理工具 / release.yml 与 test.yml 关键步骤）；数据侧 `build/validate-data.py`（`npm run validate:data`）做结构校验；`.github/workflows/test.yml`（push/PR）按「数据校验 → 构建 → 产物语法 → 生成物一致性 → 测试」跑全链，deploy-data.yml 部署前同源校验。改版本链路 / 工作流 / package.json scripts 后须全量回归。
- **Phase 18 错误边界**：`@zhixia:core-runtime` 段2 的 `_zhxErr` 为统一记录设施（有界 20 条 + `console.warn`；Probe 开启后镜像 `__zhxErrs`）——各装配体以「记录桩」注入（缺桩会中断就绪链路，装错先查桩）；新增断言：core +6（记录 / 上限 / 镜像）、observer +3（回调边界）、site-registry +5（适配器入口边界）、`integration/test-probe` +1（`errs:` 行）。**源文件增删顶层块后：先 `build/migrate/reindex-assign.py` 重算块索引**（`--dry` 干跑看 Δ 分布 → `--add 模块:块号` 归入新增块 → 复跑构建至 ⑤ 零遗漏）再全量回归。
- **Phase 19 性能测量基建**：两层冻结——脚本侧（`integration/test-probe.mjs` E1 新行断言 + E3 `__zhxDiagOn` 无面板测量场景）与工具侧（`unit/test-bench-report.mjs` 冻结 `benchmark/report.mjs` 的展开 / 对比 / 阈值逻辑）。约定：报告 = `zhx-bench/1`（写 `.cache/bench/`；`--save` 存 `benchmark/baseline/`）；对比 = `npm run bench:compare -- 旧 新 [--pct 10] [--strict]`；`bench-lifecycle.mjs` 为锚点无关基准（经 `__zhxDiagRecord()` 读取，dist 形态变化零影响），`bench-read-path.mjs` 维持文本锚细分（失配即哨兵报错，属既定行为）。改动测量面（`__zhxMarks` / `_obsStats` / `_domStats` / `_dlStats` / `__zhxDiagRecord`）后须复跑 benchmark 套件。
- 失败返回非 0；runner 汇总结果见 `tests/.cache/logs/last-summary.txt`。
- 本目录基线来自 PR #15 的 16 项回归 + 构建幂等测试（新增）；迁移历史见仓库提交记录。
