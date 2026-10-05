# FF14 幻化站中文化 · 与灰机 wiki 双向互查

> **把 FF14 的幻化/穿搭网站变成中文** —— 装备名、染剂色名自动显示为国服中文，还能和灰机 wiki 双向互查。

[![SonarQube Cloud Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=jdysw_ff14-glamour-zh&metric=alert_status)](https://sonarcloud.io/project/overview?id=jdysw_ff14-glamour-zh)


## ✨ 这个脚本能做什么

逛幻化站时最头疼的，是满屏日语 / 韩语装备名——想查国服对应的名字还得手动搜。装上这个脚本，常见幻化站**全部变中文**：

- 🌐 **全站中文化** —— 界面、装备名、染剂色名、副本名自动显示为国服中文
- 🔗 **装备点一下，直达中文 wiki** —— 汉化后的装备名可点击，直接跳转灰机 wiki 物品页：查国服名称、获取途径，一步到位
- 🔄 **双向互查** —— 灰机 wiki 物品页也会多出「幻化反查链接」（光之收藏家 / 日服 / 国际服 / 韩服），从 wiki 一键找到同款幻化
- ⚡ **无感翻译** —— 词典本地索引，毫秒级查询；安装即用、无需配置
- 🔒 **纯本地运行** —— 词库按需下载、本地缓存；不收集、不上传任何用户信息

## 🌏 支持站点

| 站点 | 地区 | 汉化内容 |
|---|---|---|
| [Mirapri](https://mirapri.com) | 日服 | 界面 + 装备 / 染剂名 |
| [Eorzea Collection](https://ffxiv.eorzeacollection.com) | 国际服 | 界面 + 装备 / 染剂名 |
| [ミラプリライフ FF14-FC](https://ff14-fc.com) | 日服 | 界面 + 装备 / 副本名 |
| [Ronka LookBook](https://lookbook.ronkacloset.com) | 韩服 | 界面 + 装备 / 染剂名 |
| [FFXIV ARMOURY COLLECTION](https://www.ffxivcollection.com) | 收藏站 | 界面 + 装备名 |
| [灰机 wiki](https://ff14.huijiwiki.com) | 中文 | 物品页新增「幻化反查」区块 |

## 📦 安装

1. 先安装一个用户脚本管理器（任选其一）：
   - [Tampermonkey](https://www.tampermonkey.net/)（推荐）
   - [Violentmonkey](https://violentmonkey.github.io/)
2. 安装脚本：
   - **从 Greasy Fork 安装** → *（即将上架，发布后补充链接）*
   - **从 GitHub 直接安装** → [**点击安装**](https://raw.githubusercontent.com/jdysw/ff14-glamour-zh/main/src/ff14-glamour-zh.external.user.js)
3. 打开任意支持站点，自动生效。

## 💡 使用说明

- 汉化后的装备名 / 染剂名**可以点击** → 跳转灰机 wiki 查国服名称与获取方式。
- 灰机 wiki 物品页会多出「幻化反查」区块 → 一键跳去各幻化站看同款穿搭。
- 词库数据每天至多自动检查一次更新，无需任何手动操作。

## ❓ 常见问题

**Q：会影响网站正常功能吗？**
不会。脚本只做「文本替换」和「附加链接」，不修改站点数据、不触碰你的账号与操作。

**Q：需要特殊网络环境吗？**
不需要。词库托管在 Cloudflare 静态站、按站点按需加载（单站首次约 0.3~1MB，压缩传输后 2~3 秒完成），之后全部走本地缓存。

**Q：发现了翻译缺漏或错误？**
欢迎到 [Issues](https://github.com/jdysw/ff14-glamour-zh/issues) 反馈：说明「哪个站、什么词、正确译文」即可。

## 🛠 开发与构建

<details>
<summary><b>点击展开：目录结构 / 构建流水线 / 发布流程（开发者向）</b></summary>

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
│   ├── acl-cfc.txt        — 副本名（fc/collection 用）
│   └── huiji-icon.b64     — 灰机 wiki 图标（构建时内嵌进脚本）
├── src/                   ★ 脚本模板（发布母版）
│   └── ff14-glamour-zh.external.user.js
├── build/                 — 构建脚本
│   ├── inject_dicts.py    — 词典注入：dict/*.json → src/ 模板
│   ├── extract_dicts.py   — 反向提取：src/ 模板 → dict/*.json（同步用）
│   ├── verify_dicts.js    — 词典校验（src 内词典 vs dict/*.json 源）
│   ├── rebuild-db.py      — 数据表重建（四语权威源 → ff14-items.tsv，跟随游戏版本）
│   └── make_dict_json.py  — 词库打包（dict/*.json → dict.json，数据站发布用）
├── dist/                  — 构建产物（生成物，不手改）
│   └── ff14-glamour-zh.greasyfork.user.js — Greasy Fork 发布版（数据外置）
├── legacy/                — 历史归档（旧独立版 ronka、历代生成器等，不参与构建）
├── .github/               — 仓库自动化
│   ├── workflows/deploy-data.yml — 数据站自动部署（data/ 变动 → CF Pages）
│   └── deploy/            — 部署组装脚本（prepare.py）+ 数据站根页
└── build.sh               — 一键全链构建
```

### 发布形态

| 产物 | 体积 | 用途 |
|---|---|---|
| `dist/ff14-glamour-zh.greasyfork.user.js` | ~195 KB | GF 发布版：数据与词库运行时按需加载（Greasy Fork ≤2MB 合规） |

**GF 版数据流**：装备/染剂数据与界面词库从 `https://zhixia-data.pages.dev/` **按需**拉取
（`ff14/v2/items.tsv` 单文件合表：中英日韩名、光之收藏家 hash、Eorzea Collection ID 一表全含；
`ff14/v2/dict.json` 界面词库）→ 缓存到本地（GM 存储）→ **每日至多一次**版本检查（sha256 指纹比对，
变化才重新下载）。**改词条只需更新数据站的 dict.json，无需发新脚本版本，用户次日自动生效**
（脚本内嵌词库仅作首屏兜底/离线兜底）。数据为只读纯文本/JSON（非可执行代码）。

### 更新链路（一次修改，两条分发线）

Raw 源（Greasy Fork「Sync」用）：
`https://raw.githubusercontent.com/jdysw/ff14-glamour-zh/main/src/ff14-glamour-zh.external.user.js`

```bash
# ① 构建 + 校验（改词库或改代码后都先跑）
bash build.sh
# ② 上传 GitHub
git add -A && git commit -m "..." && git push
# ③ 数据站 —— data/ 三文件变动时，推送 main 即自动部署（见下）
# ④ 脚本（代码变动时）——GF 端 Sync 拉取最新版
```

- 只改**界面词典**（dict/）→ 走 ①②（推送后数据站自动更新词库，用户次日生效）；只改**游戏数据**（data/）→ 重建后推送（③ 自动）；改**代码** → ①④。
- **数据站自动部署**：`data/ff14-items.tsv`、`data/ff14-series.txt`、`data/acl-cfc.txt`、`dict/*.json`（词库）
  任一推送到 main → GitHub Actions（`.github/workflows/deploy-data.yml`）自动组装并部署到 CF Pages
  项目 `ff14-glamour-zh`（域名 `zhixia-data.pages.dev`）；也可在 Actions 页手动触发。
  备用本地通道：`python3 ~/zhixia-data/update-data.py --deploy`。

### 数据更新流程（游戏版本更新后 / 数据表变动后）

```bash
python3 build/rebuild-db.py    # 1. 重建物品总表（自动下载四语权威源；--csv-dir 可离线）
git add data/ && git commit -m "data: 重建物品总表" && git push
                               # 2. 推送 → GitHub Actions 自动组装并部署数据站
# （备用本地通道）python3 ~/zhixia-data/update-data.py --deploy —— 经 wrangler 登录态直连部署
```

- 源数据＝四语 datamining Item.csv（中/英/日/韩）；hash/EC_ID/别名由本表继承，不因重建丢失。
- 指纹 = `sha256(文件内容) 前 12 位`（`.github/deploy/prepare.py` 与 update-data.py 算法一致），写入 version.json。
- **数据更新与脚本版本解耦**：数据变了不必发新脚本版，用户次日自动取到新数据。
- GF 发布件需重新同步的场景只有：**脚本代码变动**。

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

**同步方向注意**：
- **常规：只改 JSON**（dict/），模板里的词典由 inject 覆盖生成，手改模板词典会被下次构建抹掉。
- 如已在模板里改了词，用 `python3 build/extract_dicts.py` 反向提取回 JSON。

### 规则

- `dist/` 是生成物，不手改。
- 词典键值冲突时以 JSON 为准（inject 全量替换整块）。
- 每次构建后跑 `verify_dicts.js`（build.sh 已含），确保 src 内词典与 dict/*.json 源逐条一致。
- **GF 版数据外置**：src 模板即发布母版；界面词典内嵌（首屏即时生效），装备/染剂数据按需从数据站加载。修改一律只动 src（及 dict/、data/），构建产物自动生成。

</details>

## 📄 许可与声明

- 本项目以 **GPL-3.0** 许可开源（见 [LICENSE](LICENSE)）。
- 词库与对照数据整理自公开游戏资料与社区协作，仅供学习交流。
- 本脚本与 SQUARE ENIX 及所涉站点均无隶属关系；「FINAL FANTASY XIV」及相关素材版权归 SQUARE ENIX 所有。
