# SonarCloud 全量 100% 覆盖率攻坚基线与验收标准

> 本文记录的是 **Sonar 服务端真实指标**，不是 npm 测试通过率，也不是 PR 新代码指标。2026-10-13 以 `jdysw_ff14-glamour-zh` main 分支 API 拉取，供持续增量补测使用。版本始终保持 1.4.4。

## 基线

- main 全量：**coverage 65.3%**，line coverage 65.2%，branch coverage 67.4%。
- 可覆盖代码行 8034、未覆盖行 2796；可覆盖条件 484、未覆盖条件 158。
- PR 对比必须使用 `sonar-metrics/overall.json`，main 对比使用 `sonar-metrics/overall-main.json`；**PR 分支和 main 分支可能包含不同的执行行计数/代码量，不得直接把 PR 覆盖率替代 main 覆盖率**。
- `sonar.coverage.exclusions=build/**` 是现有配置（构建工具不在用户脚本运行时）；本项工作不得新增其它源文件排除、关闭覆盖条件、在 LCOV 中硬编码伪命中。
- 当前 `npm run test:coverage` 由 Node 原生 `--experimental-test-coverage` 和真实 ESM 载入产出 LCOV；历史 `new Function` 字符串片段测试即便通过，也不会被当作对应的源码执行覆盖。

## 主要文件缺口（main 基线）

| 源码 | 未覆盖行 | main 文件覆盖率 |
| --- | ---: | ---: |
| `src/core/chinese-search.js` | 597 | 0.0% |
| `src/sites/eorzea-collection.js` | 405 | 0.0% |
| `src/core/data-manager.js` | 292 | 66.3% |
| `src/sites/ff14-fc.js` | 270 | 0.0% |
| `src/sites/ffxiv-collection.js` | 172 | 0.0% |
| `src/core/targets.js` | 160 | 0.0% |
| `src/sites/huiji-wiki.js` | 153 | 0.0% |
| `src/core/probe.js` | 145 | 0.0% |
| `src/sites/ronka.js` | 109 | 0.0% |
| `src/sites/endcloset.js` | 107 | 0.0% |
| `src/core/cache.js` | 88 | 0.0% |
| `src/core/observer.js` | 81 | 0.0% |
| `src/sites/mirapri.js` | 65 | 0.0% |
| `src/core/dictionary.js` | 49 | 98.5% |
| `src/core/site-registry.js` | 42 | 0.0% |
| `src/core/item-resolver.js` | 30 | 0.0% |
| `src/main.js` | 13 | 0.0% |

注意：0% 并不意味着业务逻辑未经其它单测测试——可能是现有测试在 `new Function`/虚拟字符串里执行，Sonar 未收到真实源码路径上的采样。应迁移为实际 ESM import + DOM/GM 夹具和真实行为断言，而不是屏蔽这些文件。

## 施工要求

1. **数据及纯逻辑：** 完善 `data-manager` 的网络/持久化/签名/损坏/代际竞态/降级分支，`cache` 的前缀与派生键，`storage` 同步/异步/拒绝/异常四种路径。每一例都断言原行为、失败副作用与可观察状态。
2. **搜索及七站：** 把旧 `new Function` 测试分批升级为真实 `src/core/chinese-search.js` 与 `src/sites/*.js` 的 Node ESM 测试；DOM 使用确定性的轻量桩或者真实 DOM 环境，覆盖元素、文本节点、过滤器、React/Vue 提交、MutationObserver、防抖、SPA 恢复和重复运行的幂等性。
3. **脚本总入口和诊断：** 通过受控的浏览器生命周期环境加载 `src/main.js`、站点注册、Probe、Targets，验证启动时机、初始化顺序、错误隔离、数据就绪回调、pageshow、已翻译节点不重复注入。
4. **逐条件收尾：** 只有文件级未覆盖行清零还不够；继续检查 Sonar `uncovered_conditions`，为正反条件、短路分支、异常/恢复路径增加真实测试。

## 统一验收

- 所有代码变更推送到既有 PR #53，压缩合并仅在用户要求时执行，不升级 1.4.4 版本。
- `npm run test:coverage`、`npm run test`、构建、Sonar 扫描全通过，不改旧断言以迎合实现。
- 从 **最新的 main 完整扫描**（而不是 PR 新代码面板）实际读取 `coverage=100.0`、`line_coverage=100.0`、`branch_coverage=100.0` 且 `uncovered_lines=0`、`uncovered_conditions=0`，才能宣布目标完成。
- 在 main 未达到这些值时，必须如实报告当前数字、仍未覆盖文件/行/条件、CI 结果，不宣称 100%。

真实 Sonar 报告自动作为 `sonar-coverage-metrics` 工件上传，内含 `overall*.json`、`files*.json`。
