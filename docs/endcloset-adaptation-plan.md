# End Closet（end-closet.com）适配方案

> 侦察日期：2026-10-08
> 状态：历史方案文档；End Closet 已纳入七站支持，中文搜索与幻化反查已在 v1.4.2 实现。下文为实施前侦察与方案记录。

## 一、站点侦察结论

### 1.1 站点性质
- **FF14 韩服幻化站**（类似 ronka/collection），分享「투영 세트」（投影/幻化套装）
- **React SPA**（Vite 构建，`<div id="root">`），数据存 **Firebase Firestore**（项目 `ff14-d`）
- 有 **Cloudflare 保护**，本机 headless Chrome 被挑战页拦截（`readyState` 卡 loading）
- UI 语言通过 `localStorage.language` 控制（默认 `"ko"`），有韩/英/日三语 UI 文本

### 1.2 路由结构
| 路由 | 说明 |
|---|---|
| `/` | 首页：幻化套装列表（分页、排序「최신순/인기순」） |
| `/detail/:id` | 幻化套装详情（glamourSet） |
| `/items/:id` | 装备详情 |
| `/items` | 装备列表 |
| `/palette` | 调色板 |
| `/concepts/:id`、`/concepts/create` | 搭配概念 |
| `/authors` | 作者列表 |
| `/create` | 创建套装 |
| `/login`、`/signup` | 登录注册 |
| `/donate`、`/my-code`、`/admin/approvals`、`/upload-job-icons` | 其他 |

### 1.3 数据模型（关键）
- **装备名原生三语**：Firestore `items` 集合文档含 `name: { ko, en, ja }` 三语字段
- **本地韩文装备表**：`/data/equipment-ko.json`（29,341 条，`{id, name(ko), slot, category, level}`），用于搜索建议
- **XIVAPI 集成**：`https://v2.xivapi.com/api`，用英文/日文名反查装备（字段 `Name, Name@ja, Icon, LevelEquip, EquipSlotCategory, ClassJobCategory`），实现 AutoFill
- **套装（glamourSets）集合**：`{ mainImage, glamourItems: [{itemId, slot, dyeColor, dyeColor2}], jobs, races, styleTags, likeCount, authorUid, ... }`
- **装备 id 体系**：`equipment-ko.json` 的 `id` 与 XIVAPI row_id 可对应（AutoFill 用 XIVAPI id 匹配本地 DB）

### 1.4 关键代码线索（bundle 静态分析）
- 搜索建议：`py()` 懒加载 `/data/equipment-ko.json`，`Em()` 按韩文名模糊过滤
- 多语言搜索：`qA()` 检测输入语言（日文→`Name@ja`，英文→`Name`），多策略查询 XIVAPI
- 装备名渲染：`name.ko / name.en / name.ja` 三语字段，UI 有语言切换（`localStorage.language`）
- 样式标签（styleTags）也是三语：`{ko, en, ja}`

## 二、实施前与当时五站脚本的差异（历史记录）

| 维度 | 现有五站 | End Closet |
|---|---|---|
| 装备名 | 单语（日/英/韩），需汉化 | **原生三语**（ko/en/ja） |
| 数据源 | 静态 TSV/JSON | Firebase Firestore + equipment-ko.json + XIVAPI |
| UI 语言 | 日/英/韩 | 韩/英/日（可切换） |
| 渲染 | SSR/普通页面 | React SPA（动态渲染，需 MutationObserver） |
| 访问 | 部分站可直连 | Cloudflare 保护（需云浏览器/用户浏览器） |

**核心差异**：End Closet 提供英、日、韩装备名，可借助现有物品表映射中文，用于界面汉化与 wiki 跳转。

## 三、当时讨论过的适配方案（历史记录）

### 方案 A（推荐）：UI 汉化 + 装备名跳灰机 wiki
1. **新增站点适配器** `src/sites/endcloset.js`，注册到 Site Registry（hosts 加 `end-closet.com`）
2. **UI 界面词汉化**：新建 `dict/dict-endcloset.json`，覆盖首页/详情页/搜索/导航/按钮等韩文 UI 词 → 中文
   - 韩文 UI 词：검색（搜索）、최신순（最新）、인기순（热门）、더보기（更多）、투영 세트（投影套装）等
   - 英文/日文 UI 词也一并覆盖
3. **装备名点击跳灰机 wiki**：
   - 详情页装备名元素（`name.ko/en/ja` 渲染处）打标记 `data-zhx-item`，点击跳 `https://ff14.huijiwiki.com/wiki/物品:<中文名>`
   - 用 `ff14-items.tsv` 的 nameMap：韩文名/英文名/日文名 → 中文名
   - 三语名都映射：`nameMap[ko]`、`nameMap[en]`、`nameMap[ja]` 均可查
4. **装备名显示策略**：保留站点原生语言（默认韩文），但**悬停显示中文名**（title 属性）？或直接替换成中文？——待主人定
5. **测试**：因 Cloudflare 拦 headless，用 fixture + 单元测试；真站验证走云浏览器/用户浏览器收集器

### 方案 B：只加装备名跳灰机 wiki
- 不动 UI 词，只做装备名点击跳转
- 工作量最小

### 方案 C：全站彻底汉化（UI + 装备名全换中文）
- UI 词 + 装备名都替换成中文显示
- 装备名替换用 `nameMap`（韩/英/日 → 中文）
- 注意：React SPA 重渲染频繁，observer 要防抖 + 幂等

## 四、实施前待确认的问题（历史记录）
1. **适配范围**：A / B / C？
2. **装备名显示**：保留原文（悬停显示中文）还是直接替换成中文？
3. **UI 语言**：站点默认韩文，汉化时以哪种界面词为主？（韩文 UI 词 + 英文/日文 UI 词都翻）
4. **中文搜索**：是否要像 v1.4.2 一样支持「在 End Closet 搜索框输入中文装备名 → 自动转韩文/英文提交」？（需要接入 chinese-search 链路）
5. **版本与发布**：是否 bump 版本号？还是跟随下次 PR？

## 五、侦察资产
- `/tmp/endcloset-bundle.js`（113KB bundle，已静态分析）
- `/tmp/equipment-ko.json`（29,341 条韩文装备名）
- `tests/.cache/probe-endcloset.mjs` / `probe-endcloset2.mjs`（CDP 探针，被 CF 拦）