# FF14 幻化站中文化 · 与灰机 wiki 双向互查

> 将 FF14 的多个国际服幻化网站进行全局汉化（以国服译名为准），并实现与灰机 wiki 双向互查。

[![Release](https://img.shields.io/github/v/release/jdysw/ff14-glamour-zh)](https://github.com/jdysw/ff14-glamour-zh/releases/latest)
[![Test](https://github.com/jdysw/ff14-glamour-zh/actions/workflows/test.yml/badge.svg)](https://github.com/jdysw/ff14-glamour-zh/actions/workflows/test.yml)
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
4. 打开任意支持站点，脚本会自动生效。尚未收到更新时，可从上方链接覆盖安装最新版；首次运行会清理旧数据缓存并获取 V3（设置保留）。

## 💡 使用说明

- 汉化后的装备名 / 染剂名**支持点击** → 跳转灰机 wiki 查国服译名与获取途径。
- 灰机 wiki 物品页会多出「幻化反查」区块 → 一键跳去对应幻化站看同款穿搭。
- 在支持的装备搜索框输入**国服中文装备名或其中的连续词组**，可查看可幻化装备、时尚配饰和鸟甲的双语候选；正式名和中文别名均支持中间包含匹配。按回车、使用站点原有搜索按钮或点击候选，都会按站点需要转换为原生名称并显示中文；输入停顿不会自动搜索。智能候选按照头部、身体、手部、腿部、脚部、其余部位排序（同部位按匹配相关度）；移动端支持触屏滚动与渐进加载。
- 数据首次加载及更新时需要联网。成功缓存后会按每日规则检查更新；日常使用无需手动操作。

## ❓ 常见问题

**Q：会影响网站正常功能吗？**
脚本不会修改站点服务器上的数据，也不收集账号信息。装备搜索会在你主动提交或选择候选时转换搜索词。

**Q：需要特殊网络环境吗？**
不需要特殊网络环境；首次加载及获取更新需要连接数据站，成功缓存后可继续使用缓存内容。本次强制刷新若失败，不会恢复旧数据缓存，下次刷新会重试；成功后按每日规则检查更新。

**Q：发现了翻译缺漏或错误？**
欢迎到 [Issues](https://github.com/jdysw/ff14-glamour-zh/issues) 反馈：说明「哪个站、什么词、正确译文」即可。

## 🛠 开发与构建

<details>
<summary><b>点击展开：目录结构 / 构建流水线 / 发布流程（开发者向）</b></summary>

[![SonarQube Cloud Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=jdysw_ff14-glamour-zh&metric=alert_status)](https://sonarcloud.io/project/overview?id=jdysw_ff14-glamour-zh)

### 目录结构

```
dict/                  七站界面词典（改词编辑对应 JSON）
data/                  权威物品与副本数据
src/main.js            userscript 入口
src/core/              核心数据、词典与翻译模块
src/sites/             七站适配器（六个幻化站与灰机 wiki）
build/                 构建、校验与数据生成脚本
.github/workflows/     测试、发布与数据站部署
tests/                 单元、集成、在线与基准测试
tools/coverage-audit/  七站汉化覆盖审计工具
```

src/main.js、src/core/、src/sites/ 是唯一代码源码。dict/*.json 是界面词典源；data/ff14-items.tsv 是九列物品表，其中 glam 列包含候选标记。候选分类依据 IsGlamorous、EquipSlotCategory 和 ItemAction：可幻化装备按装备槽判定，ItemAction 20086 为时尚配饰，1013 为鸟甲。

### 数据与发布

运行时使用 V3 数据。升级至 1.4.3 后首次运行时会清理旧数据缓存并强制获取新数据，跳过常规检查间隔和 HTTP 缓存；普通设置不会清除。强制刷新失败时不恢复旧数据缓存，下次刷新重试；成功后回到每日检查更新。

数据站只部署 V3，由 GitHub Actions 的 deploy-data 工作流构建并发布。旧 V2 备用上传脚本已停用，请使用该工作流发布。每次线上发布后检查 `/ff14/v2` 和 `/ff14/v2/items.tsv` 均返回 HTTP 410，并确认 `/ff14/v3/manifest.json` 返回有效清单。

### 构建与发布

需要 Node.js 22 或更新版本。克隆仓库后先安装依赖，再构建和运行默认离线套件：

```bash
npm ci
bash build.sh
npm test
```

重建物品数据需提供四语 Item.csv 和英语 ItemAction.csv（en-ItemAction.csv）；可通过 --csv-dir 指定本地目录。package.json 是版本唯一源，新脚本发布时更新版本号。推送到 main 后，GitHub Actions 会按变更自动发布脚本或部署数据；数据站工作流也可在 Actions 页面手动运行。数据更新不需新脚本版本；同版本 Release 会跳过，更新其附件或说明需手动处理。

### 维护约定

- 修改代码只编辑 `src/` 模块；构建不会覆盖模块源码。
- 修改界面词编辑 `dict/*.json`，不要手改 `src/core/dictionary.js` 中自动生成的词典块。
- 修改物品数据后运行 `python3 build/rebuild-db.py` 和 `bash build.sh` 校验。
- `dist/` 是本地构建产物，不提交；构建会校验词典、版本和发布产物。
- 模块架构的历史与进度记录见 [重构计划](docs/v1.4-refactor-plan.md) 和 [重构进度](docs/v1.4-progress.md)。

</details>

## 📄 许可与声明

- 本项目以 **GPL-3.0** 许可开源（见 [LICENSE](LICENSE)）。
- 词库与对照数据整理自公开游戏资料与社区协作，仅供学习交流。
- 本脚本与 SQUARE ENIX 及所涉站点均无隶属关系；「FINAL FANTASY XIV」及相关素材版权归 SQUARE ENIX 所有。
