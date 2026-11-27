# coverage-audit — 汉化覆盖审计（v2）

工具面向当前全部十个站点适配器，包含 Miramiru 三语页面，审计英、日、韩文的 UI 文案，并记录 userscript 翻译前后的差异。审计不会自动修改生产词库，也不会翻译用户生成内容。

本地通道使用当前检出版本生成的 V3 数据，在页面内存中模拟 GM 存储。因此未部署的新站点也能审计，不依赖线上数据提前发布，也不受 localStorage 容量限制。这类扫描验证当前候选代码与数据，不能视为线上部署验收。

## 快速执行

    npm ci
    npm run build

    # local CDP：扫描种子页 + 公开站内链接
    node tools/coverage-audit/run-scan.mjs --site fc --channel local --discover --max-pages 60 --max-depth 2 --per-template 3

    # 装備手帳：目录、详情、兑换、搜索、AF、武器、幻化等 42 个种子入口 + 动态发现
    node tools/coverage-audit/run-scan.mjs --site attire --channel local --discover --max-pages 60 --max-depth 3 --per-template 15

    # collection（包括 weapon 子域）
    node tools/coverage-audit/run-scan.mjs --site collection --channel local

    # EC：仅在站方允许自动访问的环境执行有界种子页检查
    node tools/coverage-audit/run-scan.mjs --site ec --channel local --no-sitemap

    # 将每 URL 的最新成功或失败结果汇总成 Markdown
    node tools/coverage-audit/run-scan.mjs --report

    # 离线测试，不要求真实站点网络可达
    node tests/run.mjs test-coverage-audit

## 扫描边界

| 通道 | 适用范围 |
|---|---|
| local (Chrome CDP) | FC、Ronka、Collection、EndCloset 等可直接访问站点 |
| cloud (Playwright) | 已获得站方自动访问许可的浏览器服务；自备服务密钥，不作为访问拒绝后的自动回退 |
| user | 用户浏览器临时收集器，适用于授权的真实页面 |
| fixture | 灰机 wiki 反查模块的离线集成测试 |

FF14-FC 已收录头、身、手、腿、足五类真实装备搜索入口及足部筛选结果，默认扫描即可覆盖这些页面状态。开启 --discover 时，本地通道还会尝试读取站点 Sitemap（--no-sitemap 可关闭）。

本地/云端使用同一份 coverage-collector.mjs；不再维护两套采集正则。采集内容包括可见文本、输入框 placeholder、title、aria-label、alt、option 和按钮 value 等。翻译前后依据元素路径和属性类型匹配，保留未命中的原文证据。

--discover 启用同站链接的有限深度发现。--max-pages 控制最多浏览多少页面，--max-depth 控制发现层级，--per-template 限制同一页面模板的样本数。浏览器通道访问的是公开站内路径，不执行删除、登录或提交表单操作。

## EC 访问受限时的真实浏览器验收

GitHub 托管 Runner 曾对 EC 四个公开种子页（首页、幻化列表、装备套装列表、关于页）收到 HTTP 403。正常网页内容可读取不等于 CI 自动访问已获许可，不能将该情况记为汉化缺陷或已完成。自动扫描遇到明确的 401/403/429 或 WAF 验证页时停止该站，报告保留失败及未扫描的种子；不切换出口或反复尝试其他页面。EC 不预抓 Sitemap。

若需要恢复自动化实测，请先通过站点工作人员确认允许的检查方式（公开接口或获准的 Runner），再使用上述 EC 单站命令；服务密钥不写入仓库。不具备许可时，使用项目已有的手动审计工具在普通浏览器中逐页验证：

1. 在可信本机检出当前待验收提交，运行 `npm ci`、`npm run build`，安装本次构建的 `dist/ff14-glamour-zh.greasyfork.user.js` 和 [手动审计脚本](../manual-coverage-audit/FF14-Coverage-Audit-V1.1.user.js)，关闭其他版本，记下提交 SHA。
2. 正常浏览 EC 的四个公开种子页、实际装备与幻化详情页，按[手动审计说明](../manual-coverage-audit/README.md)采集原文基线与汉化后状态；如需检查搜索或筛选，在相同交互状态下分别采集。
3. 默认脱敏导出 JSON，用 `node tools/manual-coverage-audit/generate-report.mjs <导出文件.json>` 生成独立报告。提交 SHA 仅为操作者记录，不能作为工具自动验证过的版本标识。
4. 保留自动访问失败报告和手动验收报告两个证据来源，不以手动样本覆盖失败记录或冒充全站自动扫描成功。

## 分类与报告

- 日文假名、韩文残留默认记为待核查项，不能仅凭 CJK 汉字断言已中文化。
- 英文候选依据按钮、导航、菜单、标题、输入属性等语义识别；玩家投稿标题不能仅因为有英文就被判为漏译。
- 翻译前后有变化但仍有源语言的文本列为部分翻译候选。
- 广告、服务器名、品牌、投稿内容应按上下文豁免，人工确认例外。
- 失败页面在报告里独立列出，不作为零漏译计入。
- 同一 URL 的多份缓存以扫描时间最新一份为准；本地缓存不会上传至服务器。

## 复核和修复

| 分类 | 修改位置 |
|---|---|
| 新增 UI 词条 | data/dictionaries/dict-*.json |
| 词条已存在但未被匹配 | src/sites/*.js 或 DOM 采集逻辑 |
| 装备、染剂、副本、职业术语 | 官方国服译名 / data/source/ff14-items.tsv |
| 新 DOM 节点漏翻 | 对应站点适配器和观察器 |
| 子域名不运行脚本 | @match、Site Registry、SITES 三方校验 |
| 玩家投稿或广告 | 不自动翻译，按上下文记录豁免 |

## 验收和未覆盖范围

当前工具可以审计有限样本，尚不能证明百分之百的整站覆盖。交互型筛选、弹窗、中文输入建议、登录后页面和移动端菜单应在后续逐站增加安全、确定性的 Playwright 场景脚本。单站数十个 URL 无法代表无限数量的玩家作品。正式的 UI 文案覆盖率需要在逐站人工标注的基线上计算，不应根据“漏译 0 项”推断为 100%。

离线测试见 tests/unit/test-coverage-audit.mjs。真实站点受网站反爬、网络及动态内容影响，适合独立定期运行，不能把联网扫描强制设为 PR CI 的硬性门禁。

## 实测扫描可信度与当前审计协议

执行按需 GitHub Actions 工作流 `Live localization coverage audit (10 sites)`，或在自己的浏览器使用 `tools/manual-coverage-audit/`。工作流默认不随每次 PR 推送运行，避免网站 WAF/网络故障污染正常代码测试。

- **scan-complete**：本次配置的十站均取得有效业务页面，全部种子页均有采集记录，且没有失败页面；仅表示有限 URL 的扫描执行完整，**不等于整站 100% 汉化**。
- **partial**：至少一个站点采到有效页面，但其他站点或同站页面存在阻断、404、超时、未产生证据等情况。
- **failed**：十站均未获得有效业务页面。
- 工作流扫描步骤允许失败以便收集诊断，但最终报告任务对 incomplete 状态报错；因此不能以单个矩阵任务的绿色状态宣称扫描成功。
- 合并产物包括 `coverage-audit-live.md`、`coverage-audit-live.json`、`coverage-audit-live-manual.json`。最后一个是兼容浏览器审计工具 `zhx-manual-audit-v2` 的脱敏导出，`baselineQuality` 最多为 `partial-inferred`，自动路径配对不冒充人工确认的基线。
- CI 上传之前调用 `sanitize-evidence.mjs`：原始 JSON 留在临时扫描环境，玩家、物品及未知归属文本按作用域脱敏；诊断日志中的 URL 路径同样隐藏。
- 云端 `cloud-audit.py` 每次代理重试使用独立的 `attempt-地区-批次` 目录保留证据，且明确校验最终域名与 HTTP 响应。
- 线上 Wiki 必须使用真实 URL；默认 `fixture:wiki-item.html` 只用于离线集成测试，不得算作真实站点覆盖。

本地可执行的离线回归测试：

    node tests/run.mjs test-coverage-audit test-live-coverage-report
    python3 -m unittest discover -s tools/coverage-audit -p 'test_cloud_audit.py'

离线聚合已有采集结果：

    node tools/coverage-audit/live-report.mjs --input tests/.cache/coverage-audit --out tests/.cache/coverage-report

追加 `--strict` 可让未完成十站扫描的运行以非零状态退出；失败证据仍会写入报告。
### Miramiru 三种语言

使用 `node tools/coverage-audit/audit.mjs scan --site miramiru --pages home-ja,home-en,home-ko --channel local` 可分别检查三种语言首页；日文根路径、英文 `/en`、韩文 `/ko` 及三语排行榜均已登记为入口。浏览器手动采集请安装 `tools/manual-coverage-audit/FF14-Coverage-Audit-V1.1.user.js`，实际版本为 1.3.6。

### 装備手帳批量审计

装備手帳已登记 42 个原站入口（包括搜索、分类、标签、资料片、武器目录、装备详情、特殊兑换及玩家幻化）。按需 CI 为该站提高到最多 60 页、深度 3、同模板最多 15 页，数据从生产配置指定的 mirapri V3 数据集预置。自动报告仍只是有限样本，部分入口可能被 WAF 或缓存阻断；动态生成的隐藏区、交互状态和全文官译准确性须另外验证。原站链接发现受预算限制，不宣称全站无漏译。

涉及审计基础设施的 PR 自动执行十站有界诊断，手动工作流仍严格要求完整证据。采集器仅对装備手帳已存在的原生折叠区/标签区读取隐藏 DOM，不点击或展开真实页面；记录 collapsed 标记。每轮输出 coverage-audit-live-candidates.json，按站点和原文合并已确认 UI 作用域的候选，提供涉及页面和出现次数；脱敏及未知内容不进入批量修复清单。明确列出的种子不因 URL 模板上限被跳过。

物品标签在 CI 脱敏前仅记录是否含日文假名或韩文的布尔值，汇总单独列出已评估、含日/韩文及未评估的标签出现次数，不导出名称本身，也不将其计入 UI 候选。搜索关键词回显属于用户输入；装備手帳的混合获取说明仅在已核实作者正文边界处分开归类，其他未确认文本仍按原有口径处理。该统计不验证英文物品名或同形汉字的正确性。
