# 第三阶段：站点配置与数据生命周期依赖解耦

## 目的与边界

本阶段基于第二阶段压缩合并后的 `main`，优先拆除数据层对站点启动层的不必要依赖，并让关键测试直接依赖规范模块源码。

版本继续维持 **1.4.4**。所有新增/修改注释均使用中文；本 PR 不创建发行版，也不自动部署远程数据。

## 架构调整

### 1. 站点数据策略是独立模块

新增 `src/core/site-policy.js`，统一存放七站 `id / hosts / tables / indexes` 配置，并提供 `findSitePolicy()`、`neededTables()`、`_siteIndexes()` 和严格域名匹配函数。纯策略模块没有其他业务模块导入。

数据管理器此前导入 `site-registry.js` 只是为了识别站点及取所需表，却连带加载七个启动器及它们的 DOM 依赖。现在改为导入 `site-policy.js`，不再反向依赖启动适配器。站点注册表只绑定 `boot / pageshow / onDataReady / processRoot`，并通过策略模块查询当前站点的配置。原测试专用 `__zhxTestSite / __zhxTestTables / __zhxTestIndexes` 钩子保持。

依赖关系：

```text
纯配置 site-policy
  ├── 数据管理器 data-manager（加载 V3 表与索引）
  └── 站点注册表 site-registry（组合七站启动行为）
                   └── 订阅 data-manager 的就绪通知
```

这样移除的是 **data-manager → site-registry 的直接反向依赖**，不是声称全部 ESM 环已经消失。项目原有 Rollup 顺序契约、站点模块互相引用、缓存层与数据层互相引用仍存在，需要后续继续拆分。

### 2. 构建契约可观察性

在 `build/module-order.json` 登记新模块，确保其先于数据管理器求值。顺序校验失败时现在打印预期、实际顺序及首个不一致位置，减少远端构建问题的定位成本。

### 3. 测试与生产模块解耦

`test-site-registry.mjs`、`test-observer.mjs` 及 `test-dictionary.mjs` 改为直接读取规范模块的标记区段，注入最小桩环境并执行相同业务断言。它们不再依赖 Rollup 打包产物的模块拼接位置。仍保留现有从构建产物验证最终 IIFE 的集成检查。

新增 `test-architecture.mjs`，持续检查数据策略无业务依赖、数据管理器不导入启动注册表、站点配置单一来源、模块加载顺序以及源码级单元测试。

## 兼容性与留待后续处理的问题

- 维持七站站点顺序、完整宿主匹配、表和索引配置、数据就绪回调以及所有已冻结的翻译、搜索行为。
- `dataManager` 和 `translator` 接口由既有单元测试固定；虽暂时缺少生产调用方，但不宜在同一 PR 内将它们直接删除，以免破坏外部/调试与未来组合 API 的兼容性。它们可在后续小 PR 中明确标记弃用、调整真实调用方后再移除。
- 现有 Rollup 强制模块顺序链尚未取消；其他未迁移的文本提取测试与依赖环需继续逐步处理，不能通过调整测试预期规避行为变化。

## 验证

要求完整 Build & Verify、Unit Tests、Integration A/B/C、CodeQL、SonarCloud Quality Gate 通过后再把 PR 标记为 Ready for review。没有全部通过之前不得合并。
