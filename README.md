# FF14 幻化站中文化 · 与灰机 wiki 双向互查

> 将 FF14 的多个国际服幻化网站进行全局汉化（以国服译名为准），并实现与灰机 wiki 双向互查。

[![Release](https://img.shields.io/github/v/release/jdysw/ff14-glamour-zh)](https://github.com/jdysw/ff14-glamour-zh/releases/latest)
[![License](https://img.shields.io/badge/License-GPL--3.0-blue)](./LICENSE)


## ✨ 这个脚本能做什么

- 🌐 **全站中文化** —— 界面、装备名、染剂色名、副本名自动显示为国服中文
- 🔗 **装备点一下，直达中文 wiki** —— 汉化后的装备名均可点击，直接跳转灰机 wiki 物品页查国服译名与获取途径
- 🔄 **双向互查** —— 灰机 wiki 物品页会多出「幻化反查」区块，从 wiki 一键跳转到幻化网站，找到使用该装备的穿搭
- ⚡ **无感翻译** —— 词库本地索引、毫秒级查询；安装即用，无需配置
- 🔒 **纯本地运行** —— 词库按需下载、本地缓存；不收集、不上传任何用户信息

## 🌏 支持站点

| 站点 | 简介 |
|---|---|
| [Mirapri](https://mirapri.com) | 日服幻化网站 |
| [Eorzea Collection](https://ffxiv.eorzeacollection.com) | 国际服幻化网站 |
| [ミラプリライフ FF14-FC](https://ff14-fc.com) | 日服个人幻化网站（猫娘模特） |
| [Ronka LookBook](https://lookbook.ronkacloset.com) | 韩服幻化网站 |
| [FFXIV ARMOURY COLLECTION](https://www.ffxivcollection.com) | 国际服装备收藏站 |
| [灰机 wiki](https://ff14.huijiwiki.com) | 最终幻想 14 中文维基（物品页新增「幻化反查」区块） |

## 📦 安装

1. 先安装一个用户脚本管理器（任选其一）：
   - [Tampermonkey](https://www.tampermonkey.net/)（推荐）
   - [Violentmonkey](https://violentmonkey.github.io/)
2. **Chrome / Edge 138+ 用户**：在扩展管理页（`chrome://extensions`）的脚本管理器详情中开启「**允许用户脚本**」开关（或开启扩展管理页右上角的「开发者模式」），否则用户脚本无法运行——详见 [Tampermonkey 官方指引 Q209](https://www.tampermonkey.net/faq.php?q=Q209&locale=zh)。
3. 安装脚本：
   - **Greasy Fork** → [**点此安装**](https://greasyfork.org/zh-CN/scripts/598839-ff14-%E5%B9%BB%E5%8C%96%E7%AB%99%E4%B8%AD%E6%96%87%E5%8C%96-%E4%B8%8E%E7%81%B0%E6%9C%BA-wiki-%E5%8F%8C%E5%90%91%E4%BA%92%E6%9F%A5)
   - **GitHub** → [**点此安装最新版**](https://github.com/jdysw/ff14-glamour-zh/releases/latest/download/ff14-glamour-zh.greasyfork.user.js)
4. 打开任意支持站点，自动生效。

## 💡 使用说明

- 汉化后的装备名 / 染剂名**支持点击** → 跳转灰机 wiki 查国服译名与获取途径。
- 灰机 wiki 物品页会多出「幻化反查」区块 → 一键跳去对应幻化站看同款穿搭。
- 词库数据每天至多自动检查一次更新，全程无需手动操作。

## ❓ 常见问题

**Q：会影响网站正常功能吗？**
不会。脚本只做「文本替换」与「附加链接」，不修改站点数据，不触碰你的账号与操作。

**Q：需要特殊网络环境吗？**
不需要。词库托管在 Cloudflare 静态站、按站点按需加载（单站首次约 0.3~1MB，压缩传输约 2~3 秒完成），之后全部走本地缓存。

**Q：发现了翻译缺漏或错误？**
欢迎到 [Issues](https://github.com/jdysw/ff14-glamour-zh/issues) 反馈：说明「哪个站、什么词、正确译文」即可。

## 🛠 开发与构建

<details>
<summary><b>点击展开：目录结构 / 构建流水线 / 发布流程（开发者向）</b></summary>

[![SonarQube Cloud Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=jdysw_ff14-glamour-zh&metric=alert_status)](https://sonarcloud.io/project/overview?id=jdysw_ff14-glamour-zh)

### 目录结构

```
ff14-glamour-zh/
├── dict/                  ★ 界面词典（改词只改这里）
│   ├── dict-common.json   — 各站共用界面词
│   ├── dict-main.json     — mirapri/wiki 界面词
│   ├── dict-ec.json       — Eorzea Collection 界面词
│   ├── dict-fc.json       — ff14-fc.com 界面词
│   ├── dict-ronka.json    — Ronka LookBook 界面词
│   └── dict-acl.json      — FFXIV ARMOURY COLLECTION 界面词
├── data/                  ★ 数据表
│   ├── ff14-items.tsv     — 物品总表（8 列：key|中|英|日|韩|hash|EC_ID|别名；51,225 物品）
│   ├── ff14-series.txt    — 系列/副本名
│   └── acl-cfc.txt        — 副本名（fc/collection 用）
├── src/                   ★ 脚本模板（发布母版）
│   └── ff14-glamour-zh.external.user.js
├── build/                 — 构建脚本
│   ├── inject_dicts.py    — 词典注入：dict/*.json → src/ 模板（构建时全量覆盖生成）
│   ├── extract_dicts.py   — 历史工具：反向提取（仅一次性迁移；权威源 = dict/*.json）
│   ├── verify_dicts.js    — 词典校验（src 内嵌 vs JSON 源 / vs 远程产物）
│   ├── rebuild-db.py      — 数据表重建（四语权威源 → ff14-items.tsv，跟随游戏版本）
│   └── make_dict_json.py  — 词库打包（dict/*.json → dict.json，数据站发布用）
├── dist/                  — 构建产物：本地生成（不入库）
│   └── ff14-glamour-zh.greasyfork.user.js — Greasy Fork 发布版（数据外置）
├── .github/               — 仓库自动化
│   ├── workflows/         — deploy-data（数据站部署）/ release（自动发布）/ sonarqube-cloud（代码质量）
│   └── deploy/            — 部署组装脚本（prepare.py）+ 数据站根页
└── build.sh               — 一键全链构建
```

### 发布形态

| 产物 | 体积 | 用途 |
|---|---|---|
| `dist/ff14-glamour-zh.greasyfork.user.js` | ~195 KB | 发布版：数据与词库运行时按需加载（Greasy Fork ≤2MB 合规） |

**数据流**：装备 / 染剂数据与界面词库从 `https://zhixia-data.pages.dev/` **按需**拉取
（`ff14/v2/items.tsv` 单文件合表：中英日韩名、光之收藏家 hash、Eorzea Collection ID 一表全含；
`ff14/v2/dict.json` 界面词库）→ 缓存到本地（GM 存储）→ **每日至多一次**版本检查（sha256 指纹比对，
变化才重新下载）。**改词条只需更新数据站的 dict.json，无需发新脚本版本，用户次日自动生效**
（脚本内嵌词库仅作首屏兜底 / 离线兜底）。数据为只读纯文本 / JSON（非可执行代码）。

### 更新链路（一次修改，两条分发线）

安装与同步的固定入口（恒指向最新发布版）：
`https://github.com/jdysw/ff14-glamour-zh/releases/latest/download/ff14-glamour-zh.greasyfork.user.js`

```bash
# ① 构建 + 校验（改词库或改代码后都先跑）
bash build.sh
# ② 提交推送
git add -A && git commit -m "..." && git push
# ③ 数据站 —— data/、dict/ 变动时，推送 main 即自动部署
# ④ 脚本发布 —— src/ 变动且 @version 提升时，Actions 自动构建并创建 Release
```

- 只改**界面词典**（dict/）→ 走 ①②（推送后数据站自动更新词库，用户次日生效）。
- 只改**游戏数据**（data/）→ 重建后推送（③ 自动）。
- 改**代码**（src/）→ ①④，建议同时将 `@version` +1，便于发布追踪。
- **数据站自动部署**：`data/` 三个数据文件、`dict/*.json`（词库）任一推送到 main →
  GitHub Actions（`.github/workflows/deploy-data.yml`）自动组装并部署到 CF Pages
  项目 `ff14-glamour-zh`（域名 `zhixia-data.pages.dev`）；也可在 Actions 页手动触发。
  备用本地通道：`python3 ~/zhixia-data/update-data.py --deploy`。

### 数据更新流程（游戏版本更新后 / 数据表变动后）

```bash
python3 build/rebuild-db.py    # 1. 重建物品总表（自动下载四语权威源；--csv-dir 可离线）
git add data/ && git commit -m "data: 重建物品总表" && git push
                               # 2. 推送 → GitHub Actions 自动组装并部署数据站
# （备用本地通道）python3 ~/zhixia-data/update-data.py --deploy —— 经 wrangler 登录态直连部署
```

- 源数据＝四语 datamining Item.csv（中 / 英 / 日 / 韩）；hash / EC_ID / 别名由本表继承，不因重建丢失。
- 指纹 = `sha256(文件内容) 前 12 位`（`.github/deploy/prepare.py` 与 update-data.py 算法一致），写入 version.json。
- **数据更新与脚本版本解耦**：数据变了不必发新脚本版，用户次日自动取到新数据。
- **发布自动化**：`src/` 推送到 main 且 `@version` 有变更 → Actions（`.github/workflows/release.yml`）自动构建并创建 Release（附发布件）；版本号已发布则自动跳过（幂等）。也可在 Actions 页手动触发。

### 日常维护

**改界面词**（最常见）：
```bash
# 1. 直接编辑 dict/dict-*.json（JSON: {"kind":"kv","entries":{"原文":"译文"}}）
# 2. 一键构建 + 验证（顺带更新脚本内嵌兜底）
bash build.sh
# 3. 提交推送 → 数据站自动部署 dict.json → 用户下次访问自动生效（无需发新脚本版本）
git add dict/ && git commit -m "dict: ..." && git push
```

**更新装备数据**：`python3 build/rebuild-db.py` 重建物品总表（四语权威源自动下载，跟随游戏版本）；分发给用户走「数据更新流程」。

**词典单一源（v1.4 Phase 16）**：
- `dict/*.json` 是词典唯一权威源；**只改 JSON，勿手改源码词典块**（块上方有「⚠️ 自动生成」标识，手改会被下次构建覆盖）。
- 构建时自动生成两路产物并互核：源码内嵌兜底（`inject_dicts.py`）与数据站发布词库（`make_dict_json.py` → `dict.json`）；`build.sh` 第 ⑭/⑮/⑯ 步逐条校验「源 ≡ 内嵌 ≡ 远程」一致。
- `extract_dicts.py` 为历史一次性迁移工具（仅「模板已先行改词、需搬回 JSON」时使用），日常勿用。

### 规则

- `dist/` 为本地构建产物（不入库）；发布走 GitHub Releases 自动构建（`release.yml`）。
- 词典键值冲突时以 JSON 为准（inject 全量替换整块）。
- 每次构建后跑 `verify_dicts.js`（build.sh 已含，含 ⑯ 远程产物核验），确保「src 内嵌 ≡ dict/*.json 源 ≡ 数据站 dict.json」三方逐条一致。
- **数据外置**：src 模板即发布母版；界面词典内嵌（首屏即时生效），装备 / 染剂数据按需从数据站加载。修改一律只动 src（及 dict/、data/），构建产物自动生成。
- **站点配置统一在 Site Registry（v1.4 Phase 3）**：src 内 `@zhixia:site-registry` 区段是六站唯一配置源（host 匹配 / 所需数据表 / 构建索引 / 页面入口）——**新增站点**或**为某站新增索引查询**时只改这一处；漏登记的后果是功能静默失效（查表跳过），由各站端到端测试兜底。
- **Core 基础设施以 `@zhixia:core-*` 区段标记（v1.4 Phase 4）**：storage / http / cache / dom / runtime / constants 六组基础设施在 src 内均有独立标记区段（runtime 与 cache 各含 2 段）；**存储键（`zhx.meta` / `zhx.dt.*`）与缓存序列化格式是跨版本兼容契约**（用户本地缓存数 MB 数据），改动须过 `tests/unit/test-core.mjs`。
- **翻译与词典分层（v1.4 Phase 5）**：`@zhixia:core-translator` 是翻译统一接口（按 profile 分发到各站翻译器，**不改变任何译文**）；`@zhixia:core-dictionary` 是运行时词典（dict.json 六层原地合并 / 修订号 / 派生缓存统一失效入口）——**改词典合并机制或派生缓存时认准 `@zhixia:core-dictionary` 区段**，行为由 `tests/unit/test-dictionary.mjs` 冻结。
- **物品索引统一解析层（v1.4 Phase 6）**：`@zhixia:core-item-resolver` 是物品索引（hash / 名称）与衍生注册表（重名 / 别名）的统一访问入口——**站点与翻译器不再直查 `itemHash` / `nameMap`**，一律经 `resolveByHash` / `resolveByName` / `resolveAllByName` / `resolveAlias` / `resolve`；**解析语义与既有查询完全一致（同名键首行胜）**，重名键（同键多译）经 `resolveAllByName` 取全量（顺序 = TSV 行序，历史优先）；行为由 `tests/unit/test-item-resolver.mjs` 冻结。
- **统一观察器（v1.4 Phase 7）**：`@zhixia:core-observer` 是全部站点 MutationObserver 调度的唯一入口——统一 pending 队列 / debounce 计时 / 洪峰保护（超限重置）/ 祖先去重（`dedupeByAncestor` 升级为 O(n·depth) 祖先链查询：同节点去重 + 父子不同队）；`childList` 默认订阅、`characterData` **仅 Ronka 显式开启**（配 RONKA_KR 过滤器），其余站点禁开；**新站点观察器一律经 `createObserver`（或兼容包装 `observeLocal`）创建**，行为由 `tests/unit/test-observer.mjs` 冻结。
- **统一 Target Pipeline（v1.4 Phase 8）**：`@zhixia:core-targets` 是 DOM 目标采集与处理分派的统一层——`collectTargets(root)`（全页缺省 / 局部传元素，输出 `{type, element, text, context}` 标准 target）→ `dispatchTargets`（顺序 item → plain-item → card → dye）→ `processRoot(root, context)`；EC 物品链（装备 / 套装文本 / 卡片 / 染剂）已整体迁入，**新站点目标采集一律经 collectTargets 扩展**；行为由 `tests/unit/test-targets.mjs` 冻结。
- **站点适配器（v1.4 Phase 9）**：`createSiteAdapter` 是六站统一接口——配置面 `id/hosts/tables/indexes`，生命周期 `start / processRoot / onDataReady / onPageShow / destroy`；数据就绪补扫由工厂统一登记（不再散落各站）；站点实现按拆分顺序（① ronka ② ec ③ mirapri ④ fc ⑤ collection ⑥ wiki）渐进归拢，Phase 15 时随区段抽出为 `src/sites/*.js`；接口行为由 `tests/unit/test-site-registry.mjs`（G 组）冻结。
- **Core Probe（v1.4 Phase 10）**：`@zhixia:core-probe` 是运行诊断独立段——默认关闭（`?zhx_probe=1` 启用）、近零开销、不写存储、不发网络请求、不影响正常执行路径；读取面 = runtime timeline（`__zhxMarks`）/ data stats / observer stats（`_obsStats`）/ resolver hit-miss（`_irStats`）/ Wiki stats。Wiki 数据访问只经 Item Resolver：`resolveEcId` / `resolveKo`（禁用对 `ecidMap` / `koByZh` 的直接访问）；Phase 15 时本区段原样抽出为独立文件。
- **Core Data Manager（v1.4 Phase 11）**：`@zhixia:core-data-manager` 是数据链（远程数据 + 版本 + 缓存 + 重试 + ready + fallback）的集中管理段——对外的 `dataManager` 提供统一 API：`ensure / ready / getTable / getIndex / invalidate`；既有入口（`ensureTables` / `itemDbReady` / `onTablesReady`）语义不变；缓存策略（每日至多一次版本探测、指纹复用、失败兜底旧缓存、无数据降级）由 `tests/unit/test-data-manager.mjs` 冻结；Phase 15 时本区段原样抽出为 `src/core/data-manager.js`。
- **Runtime Data v3（v1.4 Phase 12）**：canonical 数据经 `build/make-runtime-data.py` 生成「按站最小数据 + manifest」（`data/v3/`，生成产物不入库；部署时由 `prepare.py` 重建到 `ff14/v3/`）。运行时加载顺序 = **v3 →（失败 / schema 不兼容）→ v2 → 缓存 / 内嵌 fallback**：v3 探测每日至多一次（manifest 24h 缓存）、站点不在 manifest 直接回退不额外请求；文件级 sha256 校验 + 缓存（`zhx.v3.f.<site>.<name>`）；v3 成功时 `_ensureFinalize` 跳过 v2 建表、就绪广播照常；v3 未上线（404）时行为与纯 v2 完全一致。
- **服务端预构建索引（v1.4 Phase 13）**：v3 数据按站裁剪语言列（每站 `names` 只含其翻译链实际查询的语言键：mirapri / fc / collection = 日文、ec = 英文、ronka = 韩文；`dup` 同步裁剪），单站全链 6.35MB → 4.14MB raw（gzip 1.95MB → 1.15MB）、parse 全链 ~270ms → ~55ms；客户端不再做任何二次计算（v3 就绪时 `_irBuildAux` 直接返回）；对比数据见 `tests/benchmark/bench-v3-load.mjs`（结论：维持 TSV 格式）。
- **统一缓存体系（v1.4 Phase 14）**：`@zhixia:core-cache-registry` 把全部内存缓存集中登记（四类职责：`lookup` 名称查找 / `translate` 词典派生 / `derived` 数据派生 / `data` 持久数据由 DataManager 管理）——统一入口 `cacheReset(kind)`（按类清理，无参全清）、`cacheInfo()`（修订号 + 条目数观测）、`cacheGuard`（容量防线：查找缓存上限 5000 条，达限清空重建）；`_fireTablesReady` / `dictInvalidate` 的散落手工 reset 已清零（新增缓存只需登记一行）；机制由 `tests/unit/test-cache.mjs` 冻结。
- **模块化构建（v1.4 Phase 15）**：构建方式 = 「单文件源 → 块切分 → 模块树 → Rollup 打包（`bash build.sh`，含静态验收门）」——`src/ff14-glamour-zh.external.user.js` 是切分母本与唯一手改入口；`src/main.js` / `src/core/*.js`（14）/ `src/sites/*.js`（6）均为构建链原样输出（**直接改模块会被下次构建覆盖**，改动一律落单文件源与 `build/` 链）；块→模块分配（`build/migrate/module-assign.json`）与模块输出顺序契约（`build/module-order.json`，顺序相邻关系 = 测试文本提取的正式约束）是构建约束；产物锚点体系不变（36 锚点 / 16 tag），全量回归由 `tests/` 冻结。
- **词典单一源（v1.4 Phase 16）**：`dict/*.json` 是词典唯一权威源——内嵌兜底由 `build/inject_dicts.py` 构建时全量覆盖生成（6 个词典块上方带「⚠️ 自动生成」标识，手改无效），数据站词库由 `build/make_dict_json.py` 生成；`build.sh` ⑭/⑮/⑯ 步校验「src 内嵌 ≡ JSON 源 ≡ 远程产物」逐条一致；`extract_dicts.py` 降级为一次性迁移工具；契约由 `tests/integration/test-dict-single-source.mjs` 冻结。
- **运行探测**：URL 追加 `?zhx_probe=1`（或 `#zhx_probe`）启用右下角诊断面板（环境 / 时间线 / 数据规模 / wiki 专项），可一键复制；默认关闭、零额外开销，报告仅在本地显示（用于移动端实测反馈，不写存储、不发请求）。

</details>

## 📄 许可与声明

- 本项目以 **GPL-3.0** 许可开源（见 [LICENSE](LICENSE)）。
- 词库与对照数据整理自公开游戏资料与社区协作，仅供学习交流。
- 本脚本与 SQUARE ENIX 及所涉站点均无隶属关系；「FINAL FANTASY XIV」及相关素材版权归 SQUARE ENIX 所有。
