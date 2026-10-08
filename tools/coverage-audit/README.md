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
