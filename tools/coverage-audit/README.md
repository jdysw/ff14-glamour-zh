# coverage-audit — 汉化覆盖审计工具

对 FF14 幻化站汉化 userscript（ff14-glamour-zh）做**真站遍历审计**：在真实站点上注入脚本后，收集残留外文（日/韩文），自动分类（真漏译/错译候选/用户内容/广告/豁免/已知限制），输出结构化报告。

## 通道

| 通道 | 说明 | 适用站点 |
|---|---|---|
| `local` | 本机 headless Chrome CDP（9223） | fc、ronka、collection（本机可达） |
| `cloud` | 云浏览器（BROWSER_USE_API_KEY） | mirapri、EC（本机被 CF 拦） |
| `user` | 用户在自己浏览器跑收集器，复制结果回传 | 任意站（补充样本） |

## 用法

```bash
# 1. 构建产物（必须）
npm run build

# 2. 扫描本地可达站
node tools/coverage-audit/run-scan.mjs --site fc --pages home,equip --channel local
node tools/coverage-audit/run-scan.mjs --site ronka --channel local
node tools/coverage-audit/run-scan.mjs --site collection --channel local

# 3. 云浏览器扫描（mirapri/EC）——先生成计划，再用 Python 执行
node tools/coverage-audit/run-scan.mjs --site mirapri --channel cloud
~/.venvs/bu-cloud/bin/python tools/coverage-audit/cloud-audit.py --site mirapri

# 4. 生成报告
node tools/coverage-audit/run-scan.mjs --report --out docs/coverage-audit-report.md

# 5. 用户浏览器收集器（可选）：生成油猴脚本，在自己浏览器跑
node tools/coverage-audit/audit.mjs collect-script --out /tmp/coverage-collector.user.js
```

## 输出

- 每页 JSON：`tests/.cache/coverage-audit/<site>-<page>-<ts>.json`
- 汇总报告：`docs/coverage-audit-report.md`

每条残留带：站点 / 页面 / DOM path / 原文 / 上下文 / 分类。

## 分类

| 分类 | 含义 |
|---|---|
| `real` | 真漏译（UI/分类/物品名/控件属性未译） |
| `wrong` | 错译候选（部分汉化残留源语言） |
| `user` | 用户内容（投稿标题/昵称/留言/日期），不译 |
| `ad` | 广告（AdSense 等），不译 |
| `exempt` | 豁免（服务器名/品牌/站名缩写/未收录装备名） |
| `known` | 已知引擎限制（fc 长句混合态/alt 长文案） |

**已知限制**：mirapri/EC 本机 403/CF 拦，需云浏览器；wiki 被 WAF 拦 headless，用本地夹具覆盖（见 `tests/integration/test-wiki.mjs`）。

**复跑注意**：真站内容动态变化，残留计数会有波动；同版本重跑 2-3 次取稳定区间。