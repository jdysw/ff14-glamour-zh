# 第四阶段：代码质量、诊断可观察性及部署完整性

## 发布原则

在第三阶段 PR #48 压缩合并后开展，仍使用 `1.4.4`，不创建或触发 Release，不主动部署 Cloudflare 数据站。新增或修改注释使用中文。

## 1. 真实源码覆盖率（不再全量排除）

原 `sonar-project.properties` 使用 `sonar.coverage.exclusions=**/*`，让 Sonar 的新代码覆盖率长期显示 0.0%，即使单元测试通过也不能形成可审计的生产源码覆盖率。本次改为 Node 22 原生 `--experimental-test-coverage` + `lcov` 报告器，不新增 npm 依赖。

`tests/unit/test-native-source.test.mjs` 直接导入并执行三个规范 ESM 模块：`site-policy.js`、`cache-primitives.js`、`runtime.js`。用实际生产函数验证七站域名边界、缓存分类失效与容量、运行时异常边界和滚动日志。`tools/coverage/run-native-coverage.mjs` 校验 LCOV 中这三个源码路径确实有执行命中，然后将报告提供给 Sonar。

`.github/workflows/test.yml` 增加独立 `Native Source Coverage` 任务，生成并上传 LCOV；Sonar 在扫描之前运行同一测试，并读取 `tests/.cache/coverage/lcov.info`。只从覆盖率范围中排除不属于用户脚本运行路径的 `build/**`。

**口径限制：** 目前直接源码覆盖率仅针对以上三个模块，不等于 24 个生产模块都已被完整执行。原先基于 `new Function` 的隔离测试虽然仍验证大量业务逻辑，但不会被伪装成对应规范源码的执行命中。应在后续阶段逐步迁移更多模块到原生可测试入口。

## 2. 历史预览清理

PR #44 已合并。删除仅用于已完成开发分支的 `.github/workflows/pr44-ec-preview.yml`、`tools/build-pr44-preview.mjs` 和两份过时的可安装 `.user.js` 预览文件。消除了旧工作流对分支的写权限和循环自动提交；正式 userscript 构建入口不受影响。曾安装过 PR44 预览用户脚本的用户应卸载旧测试版，使用正式版本。

## 3. 诊断错误日志滚动

`runtime.js` 原本只保存前 20 条错误，长时间运行后无法记录最新故障。现在使用容量为 20 的滚动缓冲，始终保留最新错误。`_errLog` 和已有 Probe 镜像 `window.__zhxErrs` 均保持原数组引用，不主动创建 Probe 镜像；`console.warn` 行为保持。

回归覆盖超过容量后的头尾记录、数组同一性、镜像是否懒创建以及异常安全边界。保留与第三阶段已有测试的兼容性，不降低断言。

## 4. 上游数据完整性

数据部署仍固定到 `xivapi/ffxiv-datamining` 提交 `d9582a624eaec69d45649366dee801c2f3a6e9b3`。新增与该提交树一致的 `Item.csv` Git blob SHA-1：`7ba78567b60c763375f2f0596119cd5aff149229`（源对象 19,945,674 字节）。部署步骤用 `git hash-object` 验证 CDN 实际下载的完整文件，失败直接阻断部署，并输出 SHA-256 摘要供审计。Git blob ID 是 Git 对象格式的哈希而不是 SHA-256；两者不可混称。

## 5. 回归和未完成事项

CI 需同时通过 Build & Verify、Unit、Native Source Coverage、Integration A/B/C、SonarCloud 和 CodeQL。新增治理单元测试检查旧预览不会恢复、手动发版、真实 LCOV 接入与完整覆盖率排除不会恢复。

仍待推进的事项：扩展原生源码覆盖到数据管理器、站点适配器与中文搜索；对移动端搜索、启动和内存建立实机 P50/P95 基准；执行人工触发的七站真实页面覆盖审计；继续将基于 dist 文本片段的历史单元测试迁移到规范 ESM。以上不能用本阶段的三个模块源码覆盖率代替。
