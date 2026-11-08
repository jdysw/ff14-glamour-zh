# FF14 幻化站中文化 · 与灰机 wiki 双向互查

> 将 FF14 的多个国际服幻化网站进行全局汉化（以国服译名为准），并实现与灰机 wiki 双向互查。

[![Release](https://img.shields.io/github/v/release/jdysw/ff14-glamour-zh)](https://github.com/jdysw/ff14-glamour-zh/releases/latest)
[![Test](https://github.com/jdysw/ff14-glamour-zh/actions/workflows/test.yml/badge.svg)](https://github.com/jdysw/ff14-glamour-zh/actions/workflows/test.yml)
[![License](https://img.shields.io/badge/License-GPL--3.0-blue)](./LICENSE)


## ✨ 这个脚本能做什么

- 🌐 **全站中文化** —— 界面、装备名、染剂色名、副本名自动显示为国服中文
- 🔗 **装备点一下，直达中文 wiki** —— 汉化后的装备名均可点击，直接跳转灰机 wiki 物品页查国服译名与获取途径
- 🔄 **双向互查** —— 灰机 wiki 物品页会多出「幻化反查」区块，从 wiki 一键跳转到幻化网站，找到使用该装备的穿搭
- **装备操作** —— 悬停已识别装备后点击「⋯」，或按住 Alt 点击装备，可复制中文及当前已知的原文名称，并到其他支持站点搜索。未加载的语言不会生成猜测链接；更多入口可使用 Wiki 幻化反查。
- **词库管理** —— 用户脚本管理器菜单提供「词库状态」「立即检查词库更新」「复制诊断」。手动检查不会清空所有缓存。这两项菜单功能暂未接入 xivc。

玩家的投稿标题、作者名、描述、评论和用户标签保留原文；网站官方界面、标签及装备清单按已知译名汉化。

## 🌏 支持站点

| 站点 | 简介 |
|---|---|
| [Mirapri](https://mirapri.com) | 日服幻化网站 |
| [Eorzea Collection](https://ffxiv.eorzeacollection.com) | 国际服幻化网站 |
| [ミラプリライフ FF14-FC](https://ff14-fc.com) | 日服个人幻化网站（猫娘模特） |
| [Ronka LookBook](https://lookbook.ronkacloset.com) | 韩服幻化网站 |
| [FFXIV ARMOURY COLLECTION](https://www.ffxivcollection.com) | 国际服装备收藏站 |
| [Miramiru](https://miramiru.co/en) | 幻化展示站（英／日／韩界面、装备和染剂汉化，装备名称跳转灰机 Wiki，筛选弹窗支持中文装备搜索） |
| [Mirapri Eden](https://mirapri.ff14eden.work/) | 幻化搭配、装备排行与制作器（日／英界面汉化、装备 Wiki 跳转、中文装备搜索） |
| [xivc.app](https://xivc.app/) | 幻化搭配站（界面与装备汉化、中文装备搜索，已知装备可跳转 Wiki） |
| [End Closet](https://end-closet.com) | 韩服幻化网站 |
| [灰机 wiki](https://ff14.huijiwiki.com) | 最终幻想 14 中文维基（物品页新增「幻化反查」区块） |

## 📦 安装

1. 先安装一个用户脚本管理器（任选其一）：
   - [Tampermonkey](https://www.tampermonkey.net/)（推荐）
   - [Violentmonkey](https://violentmonkey.github.io/)
2. **Chrome / Edge 138+ 用户**：在扩展管理页（`chrome://extensions`）的脚本管理器详情中开启「**允许用户脚本**」开关（或开启扩展管理页右上角的「开发者模式」），否则用户脚本无法运行——详见 [Tampermonkey 官方指引 Q209](https://www.tampermonkey.net/faq.php?q=Q209&locale=zh)。
3. 安装脚本：
   - **Greasy Fork** → [**点此安装**](https://greasyfork.org/zh-CN/scripts/598839-ff14-%E5%B9%BB%E5%8C%96%E7%AB%99%E4%B8%AD%E6%96%87%E5%8C%96-%E4%B8%8E%E7%81%B0%E6%9C%BA-wiki-%E5%8F%8C%E5%90%91%E4%BA%92%E6%9F%A5)
   - **GitHub** → [**点此安装最新版**](https://github.com/jdysw/ff14-glamour-zh/releases/latest/download/ff14-glamour-zh.greasyfork.user.js)
4. 打开任意支持站点，脚本会自动生效。尚未收到更新时，可从上方链接覆盖安装最新版；脚本只读取当前格式缓存，缺失或失效时获取当前 V3 数据，不迁移或主动清理旧格式缓存。


## 🛠 开发与构建

<details>
<summary><b>点击展开：目录结构 / 构建流水线 / 发布流程（开发者向）</b></summary>

[![SonarQube Cloud Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=jdysw_ff14-glamour-zh&metric=alert_status)](https://sonarcloud.io/project/overview?id=jdysw_ff14-glamour-zh)

### 目录结构

```
data/source/           权威物品、套装与副本数据
data/dictionaries/     人工维护的界面词典
src/main.js            userscript 入口
src/core/              共享运行时、翻译与搜索
src/core/data/         词库、缓存读写和 V3 协议
src/sites/             十站适配器（九个幻化站与灰机 wiki）
build/userscript/      脚本打包、版本同步与构建校验
build/data/            源数据维护、V3 生成与 Pages 组装
.github/workflows/     测试、发布与数据站部署
tests/e2e/             离线浏览器用户流程与工具验证
tests/unit/            数据契约与按需的源码回归
tools/coverage-audit/  汉化覆盖审计工具
```

`data/dictionaries/*.json` 是界面词典源。`data/source/ff14-items.tsv` 是九列物品表，其中 glam 列包含候选标记。可幻化装备按 IsGlamorous 和装备槽判定，ItemAction 20086 为时尚配饰，1013 为鸟甲。

### 数据与发布

只维护当前脚本与当前 V3 数据格式，不再分发旧版数据、不迁移旧缓存。清单必须使用 candidatePolicy=1、声明 SHA-256 与 bytes，名称数据必须有四列，共享词典必须包含完整八层。旧格式会被拒绝并重新获取当前数据；已经缓存的当前格式仍可离线使用。

Eden 与 xivc.app 复用 Miramiru 的多语数据集与缓存；界面词条分别使用 `eden:` 和 `xivc:` 前缀隔离，保存在现有 main 层。十个应用站点对应八个发布数据集，不额外分发相同的物品数据，也不增加词典层。

数据站由 deploy-data 工作流构建为纯静态站点，只部署 `/ff14/v3/`。旧 V2 入口及专用 Functions 已删除，未提供的数据路径使用站点的 404 页面。无需维护双版本分发或旧版脚本兼容方案。

### 构建与发布

需要 Node.js 22 或更新版本。克隆仓库后先安装依赖，再构建和运行默认的离线浏览器端到端测试。

```bash
npm ci
npm run build
npm test
```

重建物品数据需提供四语 Item.csv 和英语 ItemAction.csv（en-ItemAction.csv）；可通过 --csv-dir 指定本地目录。package.json 是版本唯一源。推送到 main 后，GitHub Actions 按相关路径变更自动部署数据；数据站工作流也可在 Actions 页面手动运行。脚本发行需手动触发 Release 工作流，不随合并自动发布。Release 只发布通过质量检查的当前 main 提交；已有版本号指向其他提交时会拒绝发布，必须先递增版本号。数据更新不需新脚本版本。

### 维护约定

- 修改代码只编辑 `src/` 模块；构建不会覆盖模块源码。
- 修改界面词编辑 `data/dictionaries/*.json`，构建会同步 `src/core/data/dictionary.js` 中的词典块。
- 修改物品数据后运行 `python3 build/data/rebuild-db.py` 和 `npm run build` 校验。
- `dist/` 是本地构建产物，不提交；构建会校验词典、版本和发布产物。
- `src/` 明确使用原生 ESM。构建按真实依赖图检查语法、依赖方向和循环，由 Rollup 裁剪未使用代码；不再维护迁移期的模块顺序快照或注释锚点检查。
- 维护说明见 [架构边界](docs/architecture.md)、[中文搜索](docs/chinese-search.md) 和 [V3 数据存储与发布](docs/data-storage-optimization.md)。

</details>

## 📄 许可与声明

- 本项目以 **GPL-3.0** 许可开源（见 [LICENSE](LICENSE)）。
- 词库与对照数据整理自公开游戏资料与社区协作，仅供学习交流。
- 本脚本与 SQUARE ENIX 及所涉站点均无隶属关系；「FINAL FANTASY XIV」及相关素材版权归 SQUARE ENIX 所有。
