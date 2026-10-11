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

### 2. 其余循环引用拆解

- `core/runtime.js` 不再导入 `data-manager.js`；装备链接查询 `lookupZh` 移到真实调用方 `core/targets.js`，保留 hash 优先及原生名称兜底行为。
- `core/cache.js` 统一拥有英文/日文名称缓存、FC 职能名称表与 Ronka 装备缓存；站点和解析器只能依赖缓存层，不再由缓存层反向导入这些对象。
- 缓存层仍存在注明 `@phase15-order-link` 的纯副作用顺序导入，这属于旧版 Rollup 输出排序约束，而非业务数据依赖；独立图分析按标记排除。
- 缓存与数据管理器、数据管理器与解析器等其他业务耦合仍存在，不声称全部 ESM 环已消除。

### 3. 移除未使用的兼容接口

- 删除只有历史测试调用的 `core/translator.js`，不改变七站适配器原有的直接翻译路径；新增七站启动、文本处理、数据就绪与页面恢复的真实调用顺序回归断言。
- 删除没有生产调用方的 `dataManager` 对象包装器，但保留 `ensureTables / itemDbReady / dataGetIndex / dataGetTable / dataInvalidate` 等实际使用的生命周期 API。
- 两者都是用户脚本 IIFE 内部的过渡接口，不属于对外公开的 ESM 包 API。

### 4. 构建契约可观察性

在 `build/module-order.json` 登记新模块，确保其先于数据管理器求值。顺序校验失败时现在打印预期、实际顺序及首个不一致位置，减少远端构建问题的定位成本。

### 5. 测试与生产模块解耦

`test-site-registry.mjs`、`test-observer.mjs`、`test-dictionary.mjs` 和 `test-item-resolver.mjs` 改为直接读取规范模块的标记区段，注入最小桩环境并执行相同业务断言。它们不再依赖 Rollup 打包产物的模块拼接位置。仍保留现有从构建产物验证最终 IIFE 的集成检查。

新增 `test-architecture.mjs` 和 `test-dependency-direction.mjs`，分别守护架构约束、解析真实业务 import 与 Tarjan 强连通分量。后者不计入人为的构建顺序导入，并如实报告尚存的业务循环。

## 兼容性与留待后续处理的问题

- 维持七站站点顺序、完整宿主匹配、表和索引配置、数据就绪回调以及所有已冻结的翻译、搜索行为。
- 对退役的内部接口改用真实站点调用链和直接生命周期方法进行回归验证；没有放宽现存业务断言。
- 现有 Rollup 强制模块顺序链尚未取消；其他未迁移的文本提取测试与依赖环需继续逐步处理，不能通过调整测试预期规避行为变化。

## 验证

要求完整 Build & Verify、Unit Tests、Integration A/B/C、CodeQL、SonarCloud Quality Gate 通过后再把 PR 标记为 Ready for review。没有全部通过之前不得合并。
