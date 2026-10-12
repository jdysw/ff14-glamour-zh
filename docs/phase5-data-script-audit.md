# 第五阶段：Runtime Data V3 与用户脚本边界专项审计

## 范围与原则

以当前 `1.4.4` 用户脚本数据链为审计对象。覆盖 canonical TSV/词库 → Python V3 生成器 → Cloudflare Pages 发布 → manifest 下载与 GM 本地缓存 → 站点所需文件 → 数据索引 → 站点适配器翻译补扫。审查**两层各自职责以及跨层唯一契约**，不是单独的代码风格巡检。

本阶段不增删支持站点、不改变既有搜索结果排序、不更改站点表/索引需求，不主动发布数据站或创建 Release。数据异常时继续保持原来的失败后广播语义，防止站点初始化卡死；新状态明确区分成功和降级。

## 依赖与信任边界

```mermaid
flowchart LR
  A[Canonical TSV 与词典] --> B[Python V3 生成器]
  B --> C[七站文件与 manifest]
  C --> D[发布前完整性校验]
  D --> E[Cloudflare Pages HTTPS]
  E --> F[脚本 HTTP 下载器]
  F --> G[纯 V3 Manifest 契约]
  G --> H[SHA-256 与 UTF-8 字节验证]
  H --> I[按指纹 GM 存储缓存]
  H --> J[数据管理器索引]
  J --> K[只读加载状态和就绪广播]
  K --> L[七站适配器与页面翻译]
  ```

- **生成器负责内容语义**：language 裁剪、别名与重名优先级、搜索候选许可、装备部位组、逐文件 SHA-256 / bytes 和版本指纹。
- **数据站负责静态托管**：无按用户定制接口；部署前核验真实字节、站点文件清单和词典 JSON。
- **运行时负责校验及一致性**：只接受合法站点与固定的相对文件名；优先本地内容寻址缓存，不可信文本不能以声明路径扩张下载范围；哈希与字节数共同检查。
- **脚本业务层负责呈现**：通过 `resolveByName`、`resolveByZh` 等稳定查询接口或只读 `dataGetStatus` 访问数据；业务模块不直接管理 GM 持久化缓存或解析远程 manifest。
- **站点适配器负责生命周期**：`onTablesReady(status)` 仍按原时机触发；仅向对应 `site` 派发数据状态，`ready=true` 表示加载流程已经结束，`state=degraded` 则表示此次未加载到可用索引。

## 发现及处置

| ID | 级别 | 问题与风险 | 本阶段措施 |
|---|---|---|---|
| DATA-01 | 高 | Python 的 `SITE_FILES` 与 JS `SITE_POLICIES` 独立维护，增加某站表/索引时可能只修改一侧 | 单元测试直接读取真实 Python 定义，与 JS `requiredV3Files` 和七站名单严格比对 |
| DATA-02 | 高 | 旧 manifest 校验仅验证 URL 为字符串及 SHA 格式，允许与生成器不一致的任意文件路径 | 新增纯 `v3-contract.js`，按站点及文件类型检查确切相对路径，拒绝目录回退、绝对 URL、查询串、未知文件和站点 |
| DATA-03 | 中 | 生成器声明 `bytes`，但脚本缓存及下载只在可能时检查 SHA，未使用声明的大小验证 | 读缓存和拉取网络正文均核对 UTF-8 字节数；对于没有 `bytes` 的历史本地清单保留兼容 |
| DATA-04 | 中 | `onTablesReady` 在首次加载失败时也广播；脚本侧无法分辨成功与已经完成的失败路径 | 新增冻结的 `dataGetStatus()`、状态及来源、代际和版本；以附加回调参数无破坏升级，旧零参数监听仍有效 |
| DATA-05 | 中 | 站点适配器在共享通知队列中未校验消息对应站点 | 桥接层按状态 `site` 过滤，避免未来多实例跨站误触发 |
| DATA-06 | 高 | 数据源部署只校验上游输入 Item.csv，生成的七站 manifest 及文件未独立复核后再部署 | 新增 `verify-publish-contract.mjs`，发布前逐个核验站点所需文件、SHA、字节数、UTF-8 和 JSON 词典；异常拒绝部署 |
| DATA-07 | 中 | 验证只覆盖 Python 或 JS 单侧逻辑，缺少数据生成→实际读取→被篡改拒绝的全链验收 | 保留 119+ 项 V3 既有行为测试，并新增真实生成数据包/篡改拒绝回归和独立契约边界测试 |
| DATA-08 | 中 | 运行时仅校验已出现文件的类型/路径，未限制每站**精确需求集合**，允许混入无关但已知类型的文件并执行额外下载 | 客户端 manifest 校验强制逐站文件名集合与 `requiredV3Files` 完全一致，新增缺失文件/多余已知文件及禁止额外网络请求回归 |
| DATA-09 | 中 | 指纹缓存键存在且内容损坏时直接放弃读取，不会检查仍有效的历史无指纹缓存键，导致本可离线恢复的数据降级 | 对指纹缓存和历史缓存逐个进行完整 SHA/字节核验；只在校验失败时尝试旧键，仍不信任损坏内容 |
| DATA-10 | 高 | 发布端只要求 dict.json 为对象，运行时又通过 Object.assign 更新常驻词典；原型特殊键或非字符串译文缺乏语义约束 | 新增独立纯词库契约：发布端要求七层完整，脚本端兼容历史部分层；统一拒绝原型特殊键、非法层和非字符串值，新增伪造匹配 SHA 的拒绝回归，同时在运行时建立索引前预检词典，防止无效共享文件使部分索引被错误发布 |

## 兼容与状态接口

`dataGetStatus()` 返回冻结快照：

```js
{
  site: 'ec',       // 当前站点标识，无法匹配为 null
  state: 'ready',   // idle / loading / ready / degraded
  origin: 'cache',  // none / cache / network / fallback
  version: '...',   // V3 数据指纹；不可用时为 null
  generation: 0,    // invalidate 后递增
  ready: true       // 就绪广播已完成，不等同于加载成功
}
```

原 `onTablesReady(fn)` 和 `itemDbReady(cb)` 语义仍保持。刷新请求触发的上一代数据不会覆盖后续代际结果；所有已经注册的订阅回调保留。站点翻译器仍按旧补扫路径调用，新增参数可按需读取，但不强制修改所有站点实现。

## 剩余限制与后续验证

1. **WebCrypto 不可用场景**：现有协议仍允许在缺少 `crypto.subtle` 的环境下仅依靠 HTTPS 与显式字节长度读取数据；没有完成 SHA-256 密码学核验。此为保留旧版兼容的安全权衡，不应描述成全浏览器场景均强制散列校验。后续可评估经严格测试的纯 JS SHA-256 回退或不兼容场景的明确拒绝策略。
2. **索引引用可变**：`dataGetIndex` 返回内部索引对象用于既有站点/诊断逻辑，新只读状态不代表所有索引已深冻结。必须先梳理真实调用方与动态引用再考虑代理或快照，以免破坏长会话性能。
3. **词典更新不是跨 DOM/索引的数据库事务**：`applyRuntimeDict` 属于非阻断、best-effort 的词典增量应用，数据包校验可拦截无效 JSON，但不能使 DOM 修改与多表生效原子化。属于架构演进候选。
4. **数据内容正确性**：签名/摘要可以保证内部一致性，不保证游戏版本、翻译语义与素材授权正确。发布前仍应保留 canonical 数据审查及数据集语义抽检。
5. **线上环境**：Cloudflare 数据站部署需要维护者配置的凭证；本 PR 仅通过构建及测试验证新部署前守卫，不主动上线。七站外部网页扫描曾因 HTTP 403 受限，此网络阻塞与 V3 数据层正确性是不同的验收项。

## 验收

- `node tests/unit/test-v3-contract.mjs`：Python vs JS 需求、路径安全和兼容元数据。
- `node tests/unit/test-data-refresh.mjs`：网络/缓存/字节不匹配、成功/降级状态、代际刷新、就绪监听。
- `node tests/unit/test-runtime-v3.mjs`：真实生成器产物与发布前 verifier、篡改拒绝、各站/离线路径。
- `npm run build` + `npm run test:unit`、三组集成、CodeQL、SonarCloud：生产构建与质量门禁。
- 数据站发布的 `Deploy data station` 工作流在 `Assemble site` 后、`Deploy to Cloudflare Pages` 前执行 `node tools/data/verify-publish-contract.mjs --dir site/ff14/v3`。
