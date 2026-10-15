# 第三阶段：站点配置与数据生命周期依赖解耦

> 历史阶段记录。后续已删除 itemDbReady、dataGetTable 等冗余接口，当前状态见 [历史清理记录](historical-cleanup-20261015.md)。

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

首先解除 **data-manager → site-registry** 反向依赖；随后在本阶段新增的缓存基础层、诊断钩子与 EC 翻译归属调整中，进一步拆除剩余的业务循环。

### 2. 其余循环引用拆解

- `core/runtime.js` 不再导入 `data-manager.js`；装备链接查询 `lookupZh` 移到真实调用方 `core/targets.js`，保留 hash 优先及原生名称兜底行为。
- 新增无业务导入的 `core/cache-primitives.js`，持有英文查找缓存、缓存注册与失效操作、容量限制、日常时间常量和公共子串算法；数据管理器与词典直接引用基础层，派生缓存层则可单向读取数据与词典。FC 职能名称、日文查找缓存和 Ronka 缓存仍由 `core/cache.js` 统一管理，不再从站点反向导入。
- `trEC` 与 `PATTERNS_EC` 统一留在 `sites/eorzea-collection.js`；通用 `item-resolver.js` 不再导入 EC 站点文案，实现 EC → 核心解析器的单向依赖，原 EC 翻译金标准仍逐条验证。
- 英文名称兜底查找由数据层直接实现，物品解析器只单向读取该接口；数据管理器不再反向导入 `item-resolver.js`。
- 数据加载时的 `__zhxMark` 改为基础运行时提供的轻量回调，Probe 在模块加载时注册原有探测函数；数据管理器不再导入完整诊断模块与 Wiki 页面逻辑。
- 移除全部 `@phase15-order-link` 人为顺序依赖；旧 `build/migrate/order-modules.mjs` 不再可重新制造依赖环。当前生产源码 ESM 导入图由测试强制检查**零循环依赖**。

### 3. 移除未使用的兼容接口

- 删除只有历史测试调用的 `core/translator.js`，不改变七站适配器原有的直接翻译路径；新增七站启动、文本处理、数据就绪与页面恢复的真实调用顺序回归断言。
- 删除没有生产调用方的 `dataManager` 对象包装器，但保留 `ensureTables / itemDbReady / dataGetIndex / dataGetTable / dataInvalidate` 等实际使用的生命周期 API。
- 两者都是用户脚本 IIFE 内部的过渡接口，不属于对外公开的 ESM 包 API。

### 4. 构建契约可观察性

`build/module-order.json` 改为记录正常 ESM 依赖驱动的 Rollup 实际输出顺序，而不是要求每个模块额外导入前驱。`verify-build-order.mjs` 继续执行独立快照校验，发生差异时打印实际/期望顺序和首个差异，便于审查构建重排。

### 5. 测试与生产模块解耦

`test-site-registry.mjs`、`test-observer.mjs`、`test-dictionary.mjs` 和 `test-item-resolver.mjs` 改为直接读取规范模块的标记区段，注入最小桩环境并执行相同业务断言。它们不再依赖 Rollup 打包产物的模块拼接位置。V3 生命周期及缓存基础测试同样调整为真实模块来源；仍保留从构建产物验证最终 IIFE 的集成检查。

新增 `test-architecture.mjs` 和 `test-dependency-direction.mjs`，分别守护架构约束、解析真实业务 import 与 Tarjan 强连通分量。后者借助 AST 与 Tarjan 强连通分量分析全部规范业务 import，明确禁止恢复 `@phase15-order-link` 人工边，并要求**循环强连通分量为零**。

## 兼容性与留待后续处理的问题

- 维持七站站点顺序、完整宿主匹配、表和索引配置、数据就绪回调以及所有已冻结的翻译、搜索行为。
- 对退役的内部接口改用真实站点调用链和直接生命周期方法进行回归验证；没有放宽现存业务断言。
- 强制副作用顺序链已取消。历史迁移文档与少量仍以 dist 文本提取的金标准测试属于后续可整理项目，但不会让它们重新引入运行时循环依赖。

## 验证

要求完整 Build & Verify、Unit Tests、Integration A/B/C、CodeQL、SonarCloud Quality Gate 通过后再把 PR 标记为 Ready for review。没有全部通过之前不得合并。
