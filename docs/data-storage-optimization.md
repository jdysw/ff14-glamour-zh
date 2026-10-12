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

## 阶段三：隔离 V3.1 内容寻址原型（已提交，验收见 CI）

### 设计与版本边界

**生产数据模式仍为 V3**：原有 `site/ff14/v3/manifest.json`、七站 TSV/TXT、`dict.json`、浏览器 `src/core/data-manager.js` 和 GM 缓存键均未修改。新协议的测试版清单是 `manifest.v31.json`（内部 `schema: 31`），**不是**旧 `manifest.json` 的替代品；旧 V3 严格验证器会拒绝它。

- `tools/data/v31-contract.mjs`：共享对象以 `objects/<SHA 前两位>/<完整 SHA-256>.<tsv|txt|json>` 命名。站点文件白名单完全来自现有 `SITE_POLICIES/requiredV3Files`；拒绝目录回退、意外站点、未知文件、超限字节与不匹配的路径/指纹。对象类型仍由 TSV/TXT/JSON 扩展名表示。
- `tools/data/v31-preview.mjs`：先通过完整 V3 发布契约校验，再逐文件读取、核对字节长度与 SHA，按内容路径去重生成 16 个左右的不可变对象及一个预览清单；二次逐字节比对原文件，拒绝多余产物。**只允许在 `site/` 外的空目录生成**，不会覆盖 V3 或打包进当前生产 Pages 站点。
- 新清单包含 `source.version`、`source.manifestSha256`，可以严格绑定对应 V3 快照；源 manifest 变化则不允许复用过时的验证结论。没有引入远端动态查询或数据库。
- `tools/data/v31-preview-reader.mjs` 是纯 Node 的**独立试读器**，不进入生产构建或浏览器。优先校验 V3.1 对象；缺失、摘要损坏、网络不可用或新 manifest 不合法时，仅在旧 V3 清单满足原契约、对应文本通过 SHA 校验时回退。旧 V3 缺省 `bytes` 的兼容行为保留，但不得省略摘要校验。
- `tools/data/v31-retention.mjs` 用**两代以上完整预览**演练追加式合并：校验两代源对象及其 SHA，将对象并集写入新目录，独立归档旧版和新版清单，最后写入最新清单指针；拒绝覆写已有目录或发布到 `site/`。

### 本地或 CI 验证

```sh
# 输入已用 prepare.py 生成并验证的 V3 数据目录；输出必须在 site/ 之外。
node tools/data/v31-preview.mjs --dir site/ff14/v3 --out build/.cache/v31-preview
node tests/unit/test-v31-preview.mjs

# 当有两个彼此独立的预览目录时，验证旧对象保留。
node tools/data/v31-retention.mjs \
  --inputs build/.cache/v31-previous,build/.cache/v31-next \
  --out build/.cache/v31-retained
```

独立 **V3 Storage Baseline** 工作流会生成隔离预览、运行全套原型回归，并上传 `v31-isolated-preview` 供审计；不调用 Cloudflare 发布 API。原有 `v3-storage-baseline` 报告保持可比。本阶段预览对象本身可真实去重，但**因生产 V3 文件仍完整保留，线上数据站的逻辑发布体积没有减少**。

### 未来上线时的安全顺序（本 PR 不执行生产切换）

1. V3 与 V3.1 并存；旧脚本仍以 `/ff14/v3/manifest.json` 为唯一入口。先在独立新前缀准备全部不可变对象，并完成远端可达性、SHA 和长度校验。
2. 备份、归档每代 V3.1 manifest，保留至少覆盖客户端实际缓存最大滞留窗口的旧对象；如无法确定滞留上限，先不自动垃圾回收。**发布顺序必须是对象 → 清单归档 → 当前清单指针**，不可先发布清单再上传文件。
3. 将来只有单独通过全部七站端到端、离线和失败注入测试，才允许增加浏览器端 V3.1 选择开关。试点失败则停止读取新清单，回退已验证 V3；必要时将当前指针重置到已归档的旧 V3.1 清单（其全部对象仍应存在）。
4. 当前固定 V3 路径不得设置 `immutable`。仅新对象的真正内容指纹 URL 适合评估长期 `Cache-Control: immutable`；未部署前不宣称 CDN 缓存改善。Cloudflare Pages 的整站部署可能替换旧静态文件，所以正式上线时必须确保旧对象仍包含在**完整待部署目录**中。
5. 发布与回滚需原子/可恢复；任何数据完整性验证失败均中止新协议启用。数据量、缓存命中和真实跨站请求收益均在第四阶段与第一阶段基准对照后决策。

### 回归与安全保证

`tests/unit/test-v31-preview.mjs` 覆盖完整七站 27 个逻辑文件、真实内容去重、合法/畸形 manifest、路径穿越、重复与差异对象、未知字段、损坏对象、丢失对象、旧 V3 无 bytes 兼容、断网安全回退、双端损坏拒绝、禁止生产目录误写，以及双版本旧对象保留和归档恢复。所有变更和注释以中文解释，原有七站数据契约与旧测试不变。

## 阶段四：定量评估、回滚验收与生产决策（已实施）

### 验收方法及可信度

`tools/data/v31-evaluate.mjs` 首先独立校验生产格式 V3 数据包、严格验证 V3.1 预览的全部内容指纹及逐文件字节等价，再使用第一阶段已通过验证的逐文件 gzip-9/Brotli-11 大小生成一份**确定性离线对照报告**。其正式 CI 工件为 `v31-phase4-evaluation`，不采集或上传用户数据。

比较场景：

1. **单站冷访问**：每站首次加载完整资源（包含一份 manifest），均未缓存。
2. **七站顺序访问 + URL 共享缓存**：以完全相同的资源 URL 为缓存键，共用文件只获取一次；这是理想化的共享请求上界，**不等于已实现的 GM 缓存**。
3. **七站顺序访问 + 缓存完全隔离**：各站分别从零开始获取各自所需文件，manifest 假设由统一脚本缓存只下载一次。
4. **充分预热重复访问**：所有资源仍在可用缓存内且清单未到更新时机，模型中两者均零次网络请求。
5. **故障与离线回退**：引用 `tests/unit/test-v31-preview.mjs` 中真实字节验证、损坏对象、断网、新旧双失败、非法新清单、跨代清单混读拒绝、旧 V3 无 `bytes` 兼容、双版本对象保留及路径隔离回归。

*边界：上面是可重复的本地字节及请求模型，未进行真实浏览器计时、GM 跨域存储、Cloudflare CDN 缓存命中、真实网络 HTTP 响应头或 Pages 预发部署测试。不能把零请求模拟、压缩率或理论收益当作线上指标。*

### 真实数据实测（2026-10-12）

输入：与第一阶段相同的固定上游 Item.csv，manifest 版本 `0e89254e11fc`；参考 GitHub Actions [运行 #38242053409](https://github.com/jdysw/ff14-glamour-zh/actions/runs/38242053409) 导出的 `v31-phase4-evaluation.json`。

| 项目 | V3 | V3.1 隔离预览 | 含义 |
|---|---:|---:|---|
| 资源逻辑文件数 / 唯一内容对象 | 27 | 16 | 去除 11 个重复副本（按内容） |
| 原始正文总字节 | 31,154,264 B | 24,966,475 B | 节省 6,187,789 B / 19.86% |
| 清单原始字节 | 4,576 B | 7,052 B | 新协议多 2,476 B |
| 七站共用 URL 缓存，请求次数（含一次清单） | 28 | 17 | 在跨域共享 URL 缓存模型下减少 11 次 |
| 七站共用 URL 缓存，原始字节 | 31,158,840 B | 24,973,527 B | 已计入清单 |
| 七站共用 URL 缓存，gzip-9 估算字节 | 8,023,004 B | 6,194,813 B | 离线压缩，不是实网 |
| 七站共用 URL 缓存，Brotli-11 估算字节 | 5,072,471 B | 3,798,415 B | 离线压缩，不是实网 |
| 七站**完全隔离**资源缓存，请求次数 | 34 | 34 | 没有请求量收益 |
| 七站**完全隔离**资源缓存，原始字节 | 32,153,628 B | 32,156,104 B | V3.1 多出清单开销 |
| 清单未过期的充分预热回访，资源及清单请求 | 0 | 0 | 两版都已缓存，零请求属模型假设 |

**重要解释：** “七站共用 URL 缓存”是基于相同 URL 的理想模型；当前 V3 客户端按站点/文件名存入 GM 存储，而 V3.1 尚未接入用户脚本。真实用户跨站使用率未知，所以不应以此推断所有用户冷启动或带宽可节约 19.86%。V3.1 仅在隔离目录真正减少了对象副本；正式 Pages 部署产物尚未改变。

### 代码侧验收门禁

- V3 正式发布契约、站点文件需求、SHA 和 UTF-8 检查继续执行，旧版读取路径不变。
- V3.1 预览必须与来源 V3 **完整 manifest SHA-256** 和逻辑版本一致，不能仅依据 12 位版本串混读。
- 内容寻址对象缺失、摘要错误、未知文件/路径、超过 Pages 限制或非法清单时必须失败关闭，只有可信旧 V3 副本可回退。
- 两代归档先保留全部旧对象，再更新清单指针；禁止覆盖现有快照或经符号链接写进生产 `site/`。
- 单站冷访问正文与文件请求保持等价；共享缓存模型的改善与隔离缓存模型的无收益必须同时报告。
- Sonar Quality Gate、完整单元/集成测试与真实基准工作流应以**同一最终 HEAD** 验证；某个旧提交的绿色结果不能代替最新提交的验收。

### 生产上线判定：**暂不切换 V3.1**

第三阶段原型证明了内容去重能够实现，但缺少与上线直接相关的四项证据：

1. 七站真实浏览器内冷/热缓存加载、GM 跨域共享程度与内存变化。
2. 独立 Pages 预发环境真实文件可达性、响应头、压缩协商、缓存失效及 404/网络故障验证。
3. 浏览器生产客户端的**选择开关**、整包 SHA 校验、原子切换、可靠离线回退及相应端到端覆盖。
4. 跨多次 Cloudflare Pages **整站部署**时旧对象仍可访问，且明确对象保留上限、版本回滚和 GC 策略。

因此当前决策是**保持正式 V3，保留 V3.1 作为可量化、可验证的独立原型**。不变更 `DATA_BASE_V3`、`manifest.json`、生产 `site/` 输出、GM 缓存协议、脚本版本 1.4.4，也不创建 Release 或触发 Cloudflare 生产部署。只有补齐四项上线证据且收益覆盖迁移成本时，才适合另行授权切换；本 PR 不默认启用新协议。

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

## 最终简化实施：仅对 V3 静态文件去重，拒绝客户端协议升级

在四阶段评估后，采用复杂度更低的方案：**保留原 V3 manifest、各站文件 URL 和全部 GM 缓存键，只优化 Cloudflare Pages 的物理静态文件目录。** V3.1 仍是隔离原型与对比研究，**不进入部署命令，也不引入新客户端读路径**。

Cloudflare Pages 的 `_redirects` 支持 `200` 内部代理（非浏览器 301/302 跳转）。所以构建产物中的完全相同的 TSV/TXT 可以只保留一份规范文件，其余旧 URL 通过逐条 `/旧路径 /规范路径 200` 服务同样的正文。具体参考 [Pages Redirects · Proxying](https://developers.cloudflare.com/pages/configuration/redirects/#proxying)。此规则仅作用于静态内容，本项目 `_routes.json` 让 Functions 仅覆盖退役的 V2 路由，不接管 V3。

### 代码执行路径

- `tools/data/dedupe-pages.mjs`：先按原 V3 发布契约验证**全部原始 27 份文件**；按 SHA-256、后缀和长度分组，选字典序最小的原 URL 为唯一保留文件，自动写出 `site/_redirects` 的 200 规则；删除其他完全相同的物理副本；最后重新打开每个规范对象检验实际 SHA、字节数、旧 URL 映射及无循环。
- `tools/data/verify-pages-http.mjs`：连接官方 Wrangler Pages 本地运行时，对 `manifest.json` 和所有旧资源 URL 逐一发实际 HTTP 请求，确认状态码 200、没有可见 Location 跳转、返回体 SHA 和字节长度与原 V3 manifest 完全一致。
- `tests/unit/test-pages-dedupe.mjs`：按真实七站需求构造完全合法的 V3 文件，验证精确去重、旧 manifest 原样保留、所有旧 URL 的等价正文、错误代理规则拒绝、规范文件篡改拒绝与禁止重复处理。
- 正式 `deploy-data.yml`：生产原始 V3 生成 → 严格 V3 完整性验证 → 共享候选与 Pages 限制验证 → V3 静态去重 → 完整旧路径复核 → Pages 上传。**正式部署不生成、不上传 V3.1**。
- 独立 `V3 Storage Baseline`：重复同样的生成和去重流程，随后启动官方 Wrangler 本地 Pages 开发服务器运行所有旧 URL 的 HTTP 回归，上传 `v3-pages-dedupe` 规则和摘要工件；整个工作流不会触发生产 Pages 部署。

### 收益和限制

在第一、三阶段锁定的数据集上，原始逻辑文件 27 个、唯一正文 16 个，去重可移除 11 份重复的原始资源副本，合计 **6,187,789 B（5.90 MiB，按资源正文统计为 19.86%）**。新增的 `_redirects` 规则本身也占用少量字节，因此整目录减少量会略小于 5.90 MiB。

**不因此声称减少用户网络流量、单站冷启动请求、GM 存储或 CDN 实际计费。** 浏览器原路径不变，脚本行为不变；本优化的直接指标是待上传 Pages 静态目录中少存了重复文件。不同 Pages 部署版本是否重复存储对象由平台决定，不能以磁盘字节预测其计费节省。

### 生产发布门禁

实际部署前必须取得 Wrangler 对所有旧 V3 URL 的 HTTP 200/SHA 验证通过，及同一 HEAD 的完整 Test/Sonar/基准工作流通过。PR 仍保持 Draft、版本仍为 1.4.4，未经合并不会触发生产部署；**合并之后 `.github/deploy/_headers` 的变化可能触发 `deploy-data.yml` 自动发布**，合并时须明确检查实际部署记录。

若 Pages 200 内部代理不符合预期，应直接中止此次去重上线并保留全量 V3 文件；绝不能以修改旧 manifest 或降低 SHA 校验要求掩盖问题。
