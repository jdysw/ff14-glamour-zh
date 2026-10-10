# Eorzea Collection Gearsets：套装目录与中文检索

## 适用范围

仅对 `ffxiv.eorzeacollection.com/gearsets` 的搜索启用套装中文检索，且仅修改
`/gearset/<slug>` 套装链接的标题文本与对应详情页标题。原始 `href`、用户幻化投稿、
装备部件译名与其他页面的搜索逻辑均不受目录翻译影响。

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

1. 在 Gearsets 页面确认确实存在对应英文名称及职能，不凭物品表里出现的部件推断每个职能都有套装。
2. 查 `data/ff14-items.tsv` 中相关装备或套装物品的国服名称；无可靠译名时不要猜译。
3. 在 `src/sites/eorzea-collection.js` 的 `EC_GEARSET_ROLE_SERIES` 或
   `EC_GEARSET_SINGLE_SERIES` 登记英文标题；新译名添加到
   `EC_GEARSET_NAME_EXTRAS`。已存在于 `DICT_EC` 的词条不重复保存。
4. 执行 `npm run build && node tests/unit/test-ec-gearsets.mjs && npm test`，
   并用真实浏览器检查目录页、详情页、含来源分类后缀的卡片与检索框。

## 仍需手动复核

历史分页数量庞大，此目录不是全站套装完整清单；Cloudflare/WAF 可能妨碍
CI 从真实页面获取 DOM。本次的源码与离线单元测试验证并不能替代
真实浏览器的完整分页回归。未核实内容不视作已经汉化。
