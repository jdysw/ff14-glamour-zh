# coverage-audit — 汉化覆盖审计（v2）

工具面向七个站点适配器，审计英、日、韩文的 UI 文案，并记录 userscript 翻译前后的差异。审计不会自动修改生产词库，也不会翻译用户生成内容。

## 快速执行

    npm ci
    npm run build

    # local CDP：扫描种子页 + 公开站内链接
    node tools/coverage-audit/run-scan.mjs --site fc --channel local --discover --max-pages 60 --max-depth 2 --per-template 3

    # collection（包括 weapon 子域）
    node tools/coverage-audit/run-scan.mjs --site collection --channel local

    # mirapri / EC 使用云浏览器，须自行配置 BROWSER_USE_API_KEY
    node tools/coverage-audit/run-scan.mjs --site ec --channel cloud --discover --max-pages 60
    python3 tools/coverage-audit/cloud-audit.py --site ec

    # 将每 URL 的最新成功或失败结果汇总成 Markdown
    node tools/coverage-audit/run-scan.mjs --report --out docs/coverage-audit-report.md

    # 离线测试，不要求真实站点网络可达
    node tests/run.mjs test-coverage-audit

## 扫描边界

| 通道 | 适用范围 |
|---|---|
| local (Chrome CDP) | FC、Ronka、Collection、EndCloset 等可直接访问站点 |
| cloud (Playwright) | mirapri、Eorzea Collection 等受 WAF/CF 限制站点；自备服务密钥 |
| user | 用户浏览器临时收集器，适用于授权的真实页面 |
| fixture | 灰机 wiki 反查模块的离线集成测试 |

FF14-FC 已收录头、身、手、腿、足五类真实装备搜索入口及足部筛选结果，默认扫描即可覆盖这些页面状态。开启 --discover 时，本地通道还会尝试读取站点 Sitemap（--no-sitemap 可关闭）。

本地/云端使用同一份 coverage-collector.mjs；不再维护两套采集正则。采集内容包括可见文本、输入框 placeholder、title、aria-label、alt、option 和按钮 value 等。翻译前后依据元素路径和属性类型匹配，保留未命中的原文证据。

--discover 启用同站链接的有限深度发现。--max-pages 控制最多浏览多少页面，--max-depth 控制发现层级，--per-template 限制同一页面模板的样本数。浏览器通道访问的是公开站内路径，不执行删除、登录或提交表单操作。

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
| 新增 UI 词条 | dict/dict-*.json |
| 词条已存在但未被匹配 | src/sites/*.js 或 DOM 采集逻辑 |
| 装备、染剂、副本、职业术语 | 官方国服译名 / data/ff14-items.tsv |
| 新 DOM 节点漏翻 | 对应站点适配器和观察器 |
| 子域名不运行脚本 | @match、Site Registry、SITES 三方校验 |
| 玩家投稿或广告 | 不自动翻译，按上下文记录豁免 |

## 验收和未覆盖范围

当前工具可以审计有限样本，尚不能证明百分之百的整站覆盖。交互型筛选、弹窗、中文输入建议、登录后页面和移动端菜单应在后续逐站增加安全、确定性的 Playwright 场景脚本。单站数十个 URL 无法代表无限数量的玩家作品。正式的 UI 文案覆盖率需要在逐站人工标注的基线上计算，不应根据“漏译 0 项”推断为 100%。

离线测试见 tests/unit/test-coverage-audit.mjs。真实站点受网站反爬、网络及动态内容影响，适合独立定期运行，不能把联网扫描强制设为 PR CI 的硬性门禁。

## 实测扫描可信度与 V1.1 数据协议

执行按需 GitHub Actions 工作流 `Live localization coverage audit (7 sites)`，或在自己的浏览器使用 `tools/manual-coverage-audit/`。工作流默认不随每次 PR 推送运行，避免网站 WAF/网络故障污染正常代码测试。

- **scan-complete**：本次配置的七站均取得至少一个有效业务页面，且没有记录失败页面；仅表示有限 URL 的扫描执行完整，**不等于整站 100% 汉化**。
- **partial**：至少一个站点采到有效页面，但其他站点或同站页面存在阻断、404、超时、未产生证据等情况。
- **failed**：七站均未获得有效业务页面。
- 工作流扫描步骤允许失败以便收集诊断，但最终报告任务对 incomplete 状态报错；因此不能以单个矩阵任务的绿色状态宣称扫描成功。
- 合并产物包括 `coverage-audit-live.md`、`coverage-audit-live.json`、`coverage-audit-live-v1.1.json`。最后一个是兼容浏览器审计工具 `zhx-manual-audit-v2` 的脱敏导出，`baselineQuality` 最多为 `partial-inferred`，自动路径配对不冒充人工确认的基线。
- CI 上传之前调用 `sanitize-evidence.mjs`：原始 JSON 留在临时扫描环境，玩家、物品及未知归属文本按作用域脱敏；诊断日志中的 URL 路径同样隐藏。
- 云端 `cloud-audit.py` 每次代理重试使用独立的 `attempt-地区-批次` 目录保留证据，且明确校验最终域名与 HTTP 响应。
- 线上 Wiki 必须使用真实 URL；默认 `fixture:wiki-item.html` 只用于离线集成测试，不得算作真实站点覆盖。

本地可执行的离线回归测试：

    node tests/run.mjs test-coverage-audit test-live-coverage-report
    python3 -m unittest discover -s tools/coverage-audit -p 'test_cloud_audit.py'

离线聚合已有采集结果：

    node tools/coverage-audit/live-report.mjs --input tests/.cache/coverage-audit --out tests/.cache/coverage-report

追加 `--strict` 可让未完成七站扫描的运行以非零状态退出；失败证据仍会写入报告。