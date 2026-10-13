# 架构与构建边界

当前实现基于主分支 1.4.4，保留 EC 套装 / 分类搜索、V3 严格数据契约、缓存刷新、Pages 透明去重和真实原生覆盖率。各阶段设计详见 `phase3-architecture-and-test-isolation.md`、`phase4-quality-governance.md` 和 `phase5-data-script-audit.md`。

`src/` 是唯一业务源码，Rollup 仅打包。`site-policy.js` 是纯站点策略；`v3-contract.js` 负责文件需求、路径与摘要契约；`data-manager.js` 管数据和就绪状态；`cache-primitives.js` 提供不依赖站点的缓存基础能力。站点模块保持各自翻译和 DOM 生命周期。

多站共享的跳过标签由 `dom.js` 拥有；物品点击和样式由 `item-links.js` 拥有。原生测试仍能通过站点的转发接口验证这些真实函数。Core 中文搜索对 EC 的依赖限于既有套装目录查询能力，不启动站点生命周期。

## 构建

`npm run build` 调用跨平台 `build/build.mjs`；`build.sh` 是便捷包装。构建顺序为版本同步、词典再生、源码 / 依赖门禁、语法检查、Rollup、产物顺序 / 标记校验、两路词典一致性与版本一致性。Python 自动检测，也可通过 `PYTHON_BIN` 指定。

一次性切分、接口生成和块索引迁移脚本已删除。当前仍在使用的产物顺序快照与标记校验保留，避免破坏主分支的测试契约。不得恢复反向生成源码或人为顺序 import。

词典工具只支持当前对象声明，以及源码对 JSON 源 / 发布 JSON 两种校验。修改词条仍只编辑 `dict/*.json`，生成块由构建维护。

## 验证与发布

使用 `npm test`、`npm run test:coverage` 和 `npm run check:deps` 验证行为、真实 V8 源码覆盖率及模块依赖。浏览器夹具和原生测试均保留最新主分支的范围；Windows 使用目录 junction 验证同一符号链接安全边界，测试文本比较统一处理换行格式。

版本继续保持 1.4.4。合并 main 不自动创建发行版，发版仍由维护者手动触发；数据站部署保留主分支的完整性检查及平台资源上限。
