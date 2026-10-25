# Miramiru 三语适配

适配日文 <https://miramiru.co/>、英文 <https://miramiru.co/en> 和韩文 <https://miramiru.co/ko>。

- 固定界面、种族、部位、来源、染剂与职业筛选按已核实词条汉化；职业缩写只在筛选面板显示中文简称。
- 装备名使用英／日／韩索引，详情优先按 Lodestone hash 查国服译名。只改装备主链接，保留官方来源详情和同款穿搭入口。
- 官方标签使用明确映射，用户标签和未知标签保留原文；选项值、slug、React 回调与输入值不改写。
- 翻译异步内容、提示属性和复用节点；数据就绪和 bfcache 恢复时补扫。当前不接入公共中文搜索。
- 玩家创作、可编辑内容和未知装备不猜译。中文字体由公共层提供，保留原布局和图标。

词典源为 `dict/dict-miramiru.json`。Miramiru 发布多语 V3 数据；Eden 和 xivc 复用该数据集，不额外分发同一份物品索引。

## 本地测试

运行 `npm run build:miramiru-test`，在 `dist/` 生成带当前 package 版本号的独立测试脚本，仅匹配 Miramiru。词库内置，缓存限于页面内存，不读写正式版 GM 缓存或 localStorage。

修改代码或词典后重新生成；正式版支持相应功能时停用独立测试版，避免重复处理。CI 的 `site-test-userscripts` 工件也包含测试包。

默认回归覆盖三语页面、筛选／标签、Wiki 目标、未知装备、输入保护和观察器稳定；线上验证需另用真实页面核对。
