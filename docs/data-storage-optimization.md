# V3 数据存储专项优化（单 PR 分阶段推进）

> 基线版本保持 **1.4.4**。本专项只在一个 PR 中持续提交，不创建 Release，不自动部署 Cloudflare。
> P3 真机性能专项不在本次计划内；本项目的 P3 指**存储协议演进阶段**，与旧质量阶段编号无关。

## 总目标

保持静态数据站与用户脚本解耦，实测现有 V3 数据的重复字节、请求数量、压缩率和持久缓存成本。
**在测量结果明确之前，不替换现有 TSV、manifest 或 GM 缓存协议。**

## 阶段一：可复现存储基准（本次提交）

- 输入：canonical TSV、词典和与生产部署完全相同、已固定提交及 Git blob 的上游 Item.csv。
- 独立工作流 `V3 Storage Baseline` 通过 `.github/deploy/prepare.py` 生成完整 V3 产物，不调用 Cloudflare Pages API。
- `tools/data/audit-storage.mjs` 在计量前执行生产发布契约验证，拒绝缺失、摘要错误、异常字节数或非法词典。
- 按站报告：请求文件数、原始字节、gzip-9 与 Brotli-11 的逐文件压缩字节。
- 全量报告：逻辑文件数、内容唯一 SHA-256 数量、重复原始字节及具体重复文件清单。
- `tests/unit/test-storage-audit.mjs` 使用真实七站契约及模拟跨站共享的 alias 文件验证重复计算，不修改既有单测期待值。
- 产物：Actions artifact `v3-storage-baseline/storage-baseline.json`；原始样本保留在工作流工件，而不是把未经实测的数字写进文档。

### 执行方式

```sh
# 本地先按照部署流程生成站点文件（需要 FF14_EQUIP_SLOTS_CSV）。
FF14_EQUIP_SLOTS_CSV=build/.cache/datamining/en-Item.csv python3 .github/deploy/prepare.py
node tests/unit/test-storage-audit.mjs
node tools/data/audit-storage.mjs --dir site/ff14/v3 --out storage-baseline.json
```

### 指标解释与限制

- `rawBytes`：逐个静态资源原始字节之和；不含 HTTP 响应头、TLS、manifest 自身或浏览器实际网络开销。
- `gzipBytes` / `brotliBytes`：对每个文件单独以指定参数压缩后的估算传输体积；**不等于** CDN 协商后的真实传输字节，也不保证 Pages 真的选用该算法。
- `duplicateRawBytes`：在**内容字节完全相同**（SHA-256 相同）时，通过只存一份理论上可以消除的逻辑冗余；**不等于** Cloudflare 物理存储账单的节省。
- `uniqueRawBytes`：各不同内容文件计一份的原始字节之和；当前 manifest 的存储方式尚不支持跨站复用。
- `requests`：每站 manifest 中引用的资源文件数，不包含 manifest 请求；命中 GM 缓存后网络请求可能为零。
- GM 本地缓存空间、脚本冷启动耗时、跨站 CDN 缓存命中率，需要单独的浏览器测量，不能直接从生成文件大小推断。

## 阶段二：非破坏性优化（已提交，CI 验证中）

1. 根据第一阶段真实报告筛选收益最高的共享数据，制定等价性断言。
2. 审核 CDN 缓存头与不变指纹资源的适用范围；动态 manifest 不能用永久缓存。
3. 加入 Pages 单文件部署约束和检测，而不改变现有客户端允许的历史元数据范围。
4. 继续验证离线回退、旧 manifest 兼容与失败拒绝行为。

### 本阶段已实施

1. **共享候选等价断言**：新增 `tools/data/verify-shared-candidates.mjs`，按照实际生成语义分别锁定 FC/Collection 同源 `names`、EC/FC/Mirapri 同源 `hash`，以及 `series`、`alias`、同语种 `dup`。复用原生产发布校验器先核对磁盘字节和 SHA-256，再断言候选组元数据完全一致。未来如修改某站数据来源而导致文件变异，发布前会明确报错，不能误用去重方案。
2. **正确划分浏览器缓存策略**：`.github/deploy/_headers` 将 `manifest.json` 和 `dict.json` 显式设置为 `no-cache, must-revalidate`，TSV/TXT 仍以 `text/plain; charset=utf-8` 提供，但不再把 JSON 错误声明为纯文本。当前全部 V3 路径仍是可变固定路径，所以**不设置 immutable**；只在第三阶段生成真实内容指纹 URL 后才可考虑长期不变缓存。
3. **Cloudflare Pages 发布边界**：新增 `tools/data/verify-pages-assets.mjs` 遍历**完整** `site/` 部署目录，校验每个静态资源大小不超过 25 MiB；拒绝符号链接和非普通文件。该限制属于 Pages 部署平台，与浏览器 V3 旧 manifest 的 64 MiB 兼容上限**分开**，不改变客户端接受范围。
4. **生产发布前执行**：现有 `deploy-data.yml` 在上传 Pages 前按顺序运行发布契约、共享候选验证和平台文件校验；独立 V3 Storage Baseline CI 也执行同一组校验，维持生产数据站未部署状态。
5. **测试保护**：新增共享候选的 SHA、字节数和缺文件负面测试，以及 25 MiB 边界、超限和符号链接拒绝测试；强化部署生成目录的 `_headers` 契约测试。原有 `test-data-refresh.mjs` 保留旧缓存键、离线降级、刷新代际和无 WebCrypto 拒绝的测试，不改变其期待结果。

**边界与影响**：本阶段没有替换现有 V3 数据文件、manifest URL 或 GM 缓存布局，因此与旧版脚本兼容，且存储总量仍约为第一阶段的 29.71 MiB；5.90 MiB 是下一阶段*理论*去重空间，不是本阶段已经节省的字节。Pages 的 `_headers` 控制静态文件响应（主要影响浏览器缓存），不能凭此断言 Cloudflare 边缘 CDN 的实际缓存命中率或 Tampermonkey 的 GM 网络调用行为。实际 HTTP 响应验证需在具备相应权限的环境部署后进行。

文档依据：[Cloudflare Pages 文件上限](https://developers.cloudflare.com/pages/platform/limits/)；[Cloudflare Pages `_headers` 静态响应规则](https://developers.cloudflare.com/pages/configuration/headers/)。

## 阶段三：可选 V3.1 存储协议（仍在同一 PR，须先取得基准）

- 评估跨站内容寻址对象池、按内容 SHA 命名与旧对象保留策略。
- 考虑 hash/alias/series 等完全相同的资源，但不以类型名称相同推定内容相同。
- 制订旧 V3 manifest 与新方案并存的迁移和回滚方式。
- 禁止生产读路径提前切换；只有完整七站契约、构建与集成回归通过后才可进入上线讨论。

## 阶段四：验收、定量对比与决策

以第一阶段的真实报告为对照，逐项记录压缩比、存储冗余降低、冷/热缓存请求、离线回退和失败注入的结果。
如果收益不足以覆盖复杂度，维持 V3 静态文件方案，不为了升级而升级。

## 交付边界

- 全程使用中文代码注释；不修改测试预期来掩盖真实失败。
- 不更改脚本版本与数据站的自动部署策略，不在 PR 内触发生产发版。
- 保持 PR 为 Draft，阶段一 CI 完成后再根据结果决定下一阶段方案。

## 第一阶段真实实测结果（2026-10-12）

基准运行：GitHub Actions [V3 Storage Baseline #38237789387](https://github.com/jdysw/ff14-glamour-zh/actions/runs/38237789387)，使用固定 datamining Item.csv、Python 生成器和完整发布契约；原始 JSON 工件名 `v3-storage-baseline`。

| 指标 | 实测值 |
|---|---:|
| manifest.version | `0e89254e11fc` |
| 实际资源文件数 | 27 |
| 内容唯一 SHA-256 数 | 16 |
| 原始逻辑文件总量 | 31,154,264 B（29.71 MiB） |
| 唯一内容总量 | 24,966,475 B（23.81 MiB） |
| 完全重复的原始字节 | 6,187,789 B（5.90 MiB；19.86%） |
| 逐文件 gzip-9 估算 | 8,021,876 B（7.65 MiB） |
| 逐文件 Brotli-11 估算 | 5,071,458 B（4.84 MiB） |

完全相同内容分组（仅按 SHA-256 判定）：

| 文件组 | 相同副本数 | 理论重复原始字节 |
|---|---:|---:|
| `fc/names.tsv`、`collection/names.tsv` | 2 | 3,192,415 B |
| `ec/hash.tsv`、`fc/hash.tsv`、`mirapri/hash.tsv` | 3 | 2,686,338 B |
| `fc/series.txt`、`collection/series.txt` | 2 | 297,477 B |
| 六站 `alias.tsv`（不包括 wiki） | 6 | 9,455 B |
| `collection/dup.tsv`、`fc/dup.tsv`、`mirapri/dup.tsv` | 3 | 2,104 B |

**结论：** 优先验证 `names` 和 `hash` 两组共享资源，它们贡献了绝大部分理论去重空间。单独优化 `alias` 的收益非常小，不宜先投入复杂协议。压缩后传输体积是离线估算，不能用于声称线上 CDN 流量已经降低。第二阶段应以这些真实数字作为收益基线。
