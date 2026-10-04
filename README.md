# ff14-glamour-zh —— FF14 幻化站中文化脚本 · 词库与构建工作区

栀夏维护的 FF14 幻化站中文化油猴脚本（mirapri.com / ffxiv.eorzeacollection.com / ff14-fc.com /
灰机 wiki / lookbook.ronkacloset.com / ffxivcollection.com）的**词库源文件**与**构建流水线**。
本目录是唯一源，改词只动这里。

## 目录结构

```
ff14-glamour-zh/
├── dict/                  ★ 界面词典（改词只改这里）
│   ├── dict-common.json   — 各站共用界面词
│   ├── dict-main.json     — mirapri/wiki 界面词
│   ├── dict-ec.json       — Eorzea Collection 界面词
│   ├── dict-fc.json       — ff14-fc.com 界面词
│   ├── dict-ronka.json    — Ronka LookBook 界面词
│   └── dict-acl.json      — FFXIV ARMOURY COLLECTION 界面词
├── data/                  ★ 数据表（装备/染剂对照）
│   ├── ff14-main.txt      — 主表: hash|中文名|英文名|EC_ID（44,310 行）
│   ├── ff14-jp2zh.txt     — 日文名→中文名（50,615 条）
│   ├── ff14-ecid.txt      — 中文名→EC_ID
│   ├── ronka-items.txt    — 韩文名对照（Ronka 用）
│   ├── ff14-series.txt    — 系列/副本名
│   ├── ff14-dyes2.txt     — 染剂表
│   └── acl-cfc.txt        — 副本名（fc/collection 用）
├── src/                   ★ 脚本模板（外置数据版母版）
│   └── ff14-glamour-zh.external.user.js
├── build/
│   ├── inject_dicts.py    — 词典注入：dict/*.json → src/ 模板
│   ├── make_embedded5.py  — 内嵌生成：src/ + data/ → dist/ 内嵌版
│   ├── extract_dicts.py   — 反向提取：src/ 模板 → dict/*.json（同步用）
│   └── verify_dicts.js    — 词典一致性校验（src vs dist）
├── dist/                  — 构建产物（生成物，不手改）
│   ├── ff14-glamour-zh.user.js            — 内嵌版（7 表全内嵌，自用推送）
│   └── ff14-glamour-zh.greasyfork.user.js — Greasy Fork 发布版（数据外置）
└── build.sh               — 一键全链构建
```

## 发布形态（v1.0.0+）

| 产物 | 体积 | 用途 |
|---|---|---|
| `dist/ff14-glamour-zh.user.js` | ~8.06 MB | 内嵌版：数据全打包，自用（TMUpd2 推送安装） |
| `dist/ff14-glamour-zh.greasyfork.user.js` | ~192 KB | GF 版：数据运行时按需加载（Greasy Fork ≤2MB 合规） |

**GF 版数据流**：按站点从 `https://zhixia-data.pages.dev/ff14/v1/` **按需**拉取（7 张表中仅本站所需，
如 fc 只拉 jp2zh+series）→ 缓存到本地（GM 存储）→ **每日至多一次**版本检查
（sha256 指纹比对，变化才重新下载）。数据为只读纯文本（非可执行代码）。

> 站点 → 数据表映射见 src 里 `SITE_TABLES`；站点-表若有调整，两边同步。

## 开源仓库与更新链路（GitHub）

- 全部源码、词库与构建脚本开源在 GitHub 仓库 **ff14-glamour-zh**。
- **Greasy Fork 脚本从仓库自动同步**——Raw 源：
  `https://raw.githubusercontent.com/jdysw/ff14-glamour-zh/main/src/ff14-glamour-zh.external.user.js`
  （一次性设置：GF 脚本页 → Sync → 填入上述 URL；之后每次发布点一下 Sync，或配 webhook 自动触发）

**一次修改，两条分发线：**

```bash
# ① 构建 + 校验（改词库或改代码后都先跑）
bash build.sh
# ② 上传 GitHub
git add -A && git commit -m "..." && git push
# ③ 数据站（词库/数据变动时）
python3 ~/zhixia-data/update-data.py --deploy
# ④ 脚本（代码变动时）——GF 端 Sync 拉取最新版
```

- 只改**词库数据** → 走 ①③；只改**脚本代码** → 走 ①②④。

## 数据站更新流程（改完词/表并构建后）

```bash
bash build.sh                                   # 1. 本地构建（含 GF 发布件再生）
python3 ~/zhixia-data/update-data.py            # 2. 同步 7 个数据文件 + 重建 version.json
python3 ~/zhixia-data/update-data.py --deploy   # 3. 部署到 CF Pages
#   （或手动：cd ~/zhixia-data && wrangler pages deploy . --project-name=zhixia-data --branch=main --commit-dirty=true）
```

- 指纹 = `sha256(文件内容) 前 12 位`，由 update-data.py 自动计算写入 version.json。
- **数据更新与脚本版本解耦**：数据变了不必发新脚本版，GF 用户次日自动取到新数据。
- GF 发布件需重新上传 Greasy Fork 的场景只有：**脚本代码变动**。

## 日常维护流程

**改界面词**（最常见）：
```bash
# 1. 直接编辑 dict/dict-*.json（JSON: {"kind":"kv","entries":{"原文":"译文"}}）
# 2. 一键构建 + 验证
bash build.sh
# 3. 推送安装
# （自用可选）经自建链路推送到本机脚本管理器；开源使用可跳过此步
# 4. 主人刷新页面即生效
```

**改装备表**：编辑 `data/*.txt` → `bash build.sh`（无需注入步骤改动词典）；若要 GF 用户拿到新数据 → 走「数据站更新流程」。

**同步方向注意**：
- **常规：只改 JSON**（dict/），模板里的词典由 inject 覆盖生成，手改模板词典会被下次构建抹掉。
- 如已在模板里改了词，用 `python3 build/extract_dicts.py` 反向提取回 JSON。

## 规则

- `dist/` 是生成物，不手改。
- 词典键值冲突时以 JSON 为准（inject 全量替换整块）。
- 生成器与数据路径已全部指向本目录；不再依赖 /tmp 或 workspace 副本。
- 每次构建后跑 `verify_dicts.js`（build.sh 已含），确保 src 与 dist 词典逐条一致。
- **Greasy Fork 版走的 Go 路径**：src 模板即外置数据母版；`make_embedded5.py` 只把「数据加载器块」替换成内嵌数据块生成内嵌版。修改数据层时只动 src，两版行为一致。

## 许可

GNU General Public License v3.0（见 [LICENSE](LICENSE)）。Copyright © 2026 栀夏（https://zhixia.uk）。
词库与对照数据整理自公开游戏资料与社区协作。
