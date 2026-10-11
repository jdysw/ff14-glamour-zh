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

## 6. 延伸治理：减少构建锚点依赖与模拟弱性能基准

- 真实源码 LCOV 由原先三个核心 ESM 模块扩展到六个：新增 `http.js`、`storage.js`、`dom.js`，直接调用其生产导出并对成功、失败和退化场景执行断言。没有修改生产 API 来人为提高覆盖率。
- `test-core`、`test-cache`、`test-storage`、`test-targets` 不再从 Rollup 生成脚本切代码片段，改为从真实所属的 `src/core` 模块提取。原测试的行为预期和区段完整性守卫继续存在。
- `tests/benchmark/report.mjs` 新增明确的“最近秩” P50/P95 统计。EC 读取路径基准记录 1×、4×、8× 的实际执行样本，额外采集 `Runtime.getHeapUsage` 的 JS 堆使用量；生命周期基准记录 CPU 节流倍率、ready/fireDone/mutation 与堆样本。遇到采样不足或完全失败时，不伪造为成功基准。
- `.github/workflows/performance-regression.yml` 在基准脚本变更的 PR 中执行五轮 Chrome/CDP 基准并上传原始 JSON 与统计报告。它使用 Chrome CPU 节流和离线 EC 夹具，是**模拟弱性能环境**，不是实际 Android/iOS 手机 P95 数据。不同运行器之间的结果不宜当成严格的性能回归阈值。
- `.github/workflows/live-coverage-audit.yml` 在相关审计工具变更的 PR 中执行七站有限页数的在线抽样，并保留原来的手动完整审计入口（每站最多 24 页）。对无法访问的站点保持阻塞/未覆盖状态，独立上传脱敏报告及错误证据，绝不把访问失败当作零漏翻。

## 7. 剩余的环境限制

尽管在线审计现在会由 GitHub Actions 实际触发，外部网站仍可能启用反自动化验证、地域封锁、登录门槛或改变页面结构；这些属于真实验收阻塞，不能通过把测试改为模拟页面解决。五轮 CPU 节流只能给出有限样本的粗略 P95，要取得统计意义更强的真机 P95，仍需多设备、较多轮次和稳定网络的人工/设备农场测试。

项目大量较复杂的站点模块仍使用旧隔离夹具和浏览器端测试。六个原生 ESM 模块的真实 LCOV 不等同于所有 24 个模块的完整覆盖率；后续可按边界模块化逐步扩展，继续保留原有功能断言。
