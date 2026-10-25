# 架构与维护边界

生产脚本保留十站现有功能，十个应用站点对应八个发布数据集。版本以 package.json 为准；当前协议与发布流程见 [V3 数据存储与发布](data-storage-optimization.md)。

## 运行时

- `main.js` 编排数据预加载、中文字体、站点启动与 bfcache 恢复。
- `site-policy.js` 是宿主、表和索引需求的唯一配置来源；`site-registry.js` 只负责实际使用的启动、数据就绪和页面恢复回调，并隔离单站错误。
- `v3-contract.js` 和 `dict-contract.js` 验证现行清单、文件路径和完整词典。`data-manager.js`、`http.js`、`storage.js` 处理加载、校验、持久化提交和失败恢复。
- `cache-primitives.js` 提供有界缓存与失效能力；站点模块保留各自的 DOM、语言和原生事件差异。
- `chinese-search.js` 使用当前页面的检索范围和原生输入／提交事件；EC 套装目录查询保持明确的站点专属能力，具体见 [中文搜索](chinese-search.md)。
- 字体规则由 `dom.js` 统一拥有，不下载外部字体，也不改变字号、粗细、代码和图标字体。

用户内容、输入值、预设和 Canvas 不参与通用文本翻译。Wiki 点击不能替代原生筛选、装备选择或试穿操作。

## 构建

`src/` 明确使用原生 ESM；`npm run build` 与 `bash build.sh` 共用 `build/build.mjs`，没有另一条构建实现。Python 可通过 `PYTHON_BIN` 指定。

构建同步版本、再生词典，使用 Acorn 检查真实模块语法、依赖方向和循环，再用 Rollup 打包并裁剪未使用代码；随后验证最终脚本语法、内嵌／源 JSON／发布 JSON 的词典一致性与版本。测试还会实际篡改产物，验证拒绝损坏及可重现构建。

不维护固定输出顺序快照、迁移锚点验证器或未投产的另一套数据协议。旧片段测试仍使用的区段标记保留在源码，不承担生产执行职责。

## 修改和验证

只编辑 `src/`、`dict/` 与权威数据源，不手改生成词典块。验证入口见 [测试说明](../tests/README.md)。手动和自动汉化审计分别见 [手动审计](../tools/manual-coverage-audit/README.md) 与 [自动审计](../tools/coverage-audit/README.md)。

构建产物、临时扫描报告和日志放在 `dist/` 或 `.cache/`，不提交过期快照。测试夹具和性能基准仍是可执行回归的输入，不能按“历史记录”删除。

合并不自动创建脚本发行版；数据站按现有部署工作流执行。清单、摘要、字节数和平台路径验证仍是发布前提。

站点维护说明：[Miramiru](miramiru-adaptation.md)、[Mirapri Eden](mirapri-eden-adaptation.md)、[xivc](xivc-adaptation.md)。
