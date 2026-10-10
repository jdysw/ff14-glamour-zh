# Eorzea Collection Gearsets：套装目录与中文检索

## 适用范围

仅对 `ffxiv.eorzeacollection.com/gearsets` 的搜索启用套装中文检索，且仅修改
`/gearset/<slug>` 套装链接的标题文本与对应详情页标题。原始 `href`、用户幻化投稿、
装备部件译名与其他页面的搜索逻辑均不受目录翻译影响。

## 自动化规则（PR #44 起）

过去的规则是“人工登记英文系列 + 实际职能，再组合国服系列译名和职能译名”，未登记的新套装始终英文。现在采取**官方数据自动推导为主、人工特例兜底**：

- 已经需要加载的 V3 `nameMap` 提供单件装备「英文名 → 国服中文名」，不请求 EC 或第三方 API、不额外下载一份套装数据。
- 针对 `<英文系列> <部件名称> of <英文职能>` 的装备，按系列和职能建立证据集合；支持七种战斗职能以及生产 `Crafting` 和采集 `Gathering`。
- **至少三件不同的单件装备**具有不同中文装备名，且其最长共同中文前缀必须以对应的国服职能译名结尾，才生成 `<中文前缀>套装`。例如五件 Ceremonial Scouting 单件物品均为“仪仗游击……”→“仪仗游击套装”。
- **生产／采集套装的职能翻译与网站 UI 分开**：名称中的 `of Crafting` 对应装备前缀「巧匠」，`of Gathering` 对应「大地」。例如 Everseeker's Crafting/Gathering 分别推导为「探求永恒巧匠套装」「探求永恒大地套装」；页面独立 `Crafting` 标签仍译作「制作」，不更改全站词典。
- 只有当 EC 页面实际出现英文套装标题时才替换标题；部件数据里存在不意味着站点一定存在该套装，避免凭空生成不存在的搜索结果链接。
- 启动早期 V3 未就绪时保持原英文，V3 数据加载后补扫标题、关联套装和浏览器页面标题；手工维护的特殊装备系列仍然有效。
- 特殊的 `Hempen <种族> <性别>` 用**描述性中文名称**标注（如“维埃拉族男性贴身衣套装”）；这不是官方物品名称，不应拿来冒充国服正式套装译名或预生成尚未见过的变体。
- **EC 括号变体与国服套装物品名自动对齐**：EC 使用 `Wintertide (Culottes)`，而国服物品表是 `Wintertide Attire (Culottes) → 冬季宽松直筒裤套装`。对 `Attire`、`Armor`、`Set`、`Outfit` 采用插入规则，保留 `(Culottes)`、`(Sheath Skirt)` 等区分变体的后缀，绝不按名称相似度猜测。仅翻译 EC 页面**已实际出现**的套装标题，不额外增加未验证的搜索候选、无需新增网络请求。自动单测会从官方 TSV 中校验全部同结构套装。
- 不能满足三件装备/职能一致性条件时**宁可保留英文**，不套用通用翻译服务或猜测中文。

以上算法解决规则化装备套装不断新增导致的人工维护成本；单件商城装束、活动奖励、职业专属特殊标题仍需少量人工映射。

## 译名依据与覆盖

- 英文套装名及实际出现的职能组合：Eorzea Collection [Gearsets](https://ffxiv.eorzeacollection.com/gearsets)，包含较早分页。
- 中文译名：仓库 `data/ff14-items.tsv` 中的国服装备前缀，或官方套装物品名（如
  `Fallen's Armor → 堕落套装`、`Galatea Attire → 伽拉忒亚装备套装`）。
- 此次新增历史分页系列包括 Mistwake（雾迹）、Mistic Memory（雾忆）、
  War Cloud's（沃·克劳德）、Prishe's（普利修）、Mayakov（马雅科夫）、
  Orastery（口之院）以及多套商城装束、特殊奖励套装。
- 已有 Phantom Vision、Vana'dielian、Praemagitek 以及其他已核对套装保留。
- `EC_GEARSET_ROLE_SERIES` 显式限定实际存在的职能；不存在的职能变体绝不合成。
  未能核实译名的英文套装（如 Legend）暂时保持原文，等待核验。

## 搜索策略

1. 将中文查询归一化：去除空格、间隔点与中英文标点，以支持
   `瓦纳迪尔`、`希望套装女` 等写法。
2. 用中文**连续子串**筛选套装（含跨系列／职能的片段，如 `幻境意象御`）。
3. 恰好匹配一套时使用该套完整英文名；匹配多套时，寻找所有匹配套装英文名称
   共有的完整词序列。例如 `御敌 → Fending`、`素色 → Plain Hooded`。
4. 没有共同英文词时不随意选择某一套；智能候选列表仍展示各套装，供用户明确选择，
   同时阻止搜索意外回退到单件装备索引。
5. 目录按运行时词典修订号缓存，动态页面重新扫描无需重复构建；
   词典更新后自动失效重建。

## 后续新增套装的步骤

1. 优先在真实 EC Gearsets 页面核对英文标题，并确认 V3 装备库已经收录该套装的相关英中单件物品。符合“三件独立装备 + 共同中文前缀 + 职能一致”即可自动显示中文，不再逐套人工添加。
2. 不满足自动推导条件的特殊装束，查 `data/ff14-items.tsv` 核对国服正式名称；仅在实际需要时添加到 `EC_GEARSET_SINGLE_SERIES` 和 `EC_GEARSET_NAME_EXTRAS`。
3. 执行 `npm run build && node tests/unit/test-ec-gearsets.mjs && npm test`，并通过真实浏览器检查目录页、详情页、关联卡片及检索框。

## 仍需手动复核

历史分页数量庞大，此目录不是全站套装完整清单；Cloudflare/WAF 可能妨碍
CI 从真实页面获取 DOM。本次的源码与离线单元测试验证并不能替代
真实浏览器的完整分页回归。未核实内容不视作已经汉化。

## 可选外部资料与 API

- [FFXIV Text Search Engine](https://github.com/lisongxuan/FFXIV-Text-Search-Engine) 提供剧情／游戏文本跨语种搜索。其开源后端是 Flask-RESTful，API 路由含 `/versions`、`/strict_exact_data_by_data`、`/multi_language_data_by_data` 等；前端配置的后端地址为 `https://ffxivapis.arkady14.fun`。可用于人工核对游戏用词，但**未验证其在线接口稳定性、调用限制或装备套装数据完整性**，不作为玩家脚本的运行时强依赖。
- [XIVAPI V2 中文部署](https://xivapi-v2.xivcdn.com/zh-cn/docs/guides/search/) 具备公开文档的 `/api/search` 游戏数据搜索接口，是后续离线数据构建／缺漏核验可选来源。现阶段优先使用仓库内可版本化的 `data/ff14-items.tsv`，保证国服正式译名来源一致。
