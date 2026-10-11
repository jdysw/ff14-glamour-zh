# EC Gearsets 命名结构数据覆盖审计

该报告由 `data/ff14-items.tsv` 自动统计，**只是国服物品数据，不代表 EC 实际存在所有对应套装**。
最终页面存在性应根据 EC 官方页面或其真实链接另行核验。

## 规模与风险

- 国服装备英中对照记录：50,471
- 生产／战斗职能 `of Role` 装备条目：11,650
- 英文套装包命名（所有物品）：831
- 其中中文译名以「套装」「装束」结尾：651
- 同一英文系列含 ≥2 个括号变体：29 个系列
- 只有一个括号变体的正式套装物品：3
- 不带括号变体的正式套装物品：590
- 套装包英文后缀命中但中文不以「套装」「装束」结尾：180

## 按英文包类型分类

| 英文类型 | 物品条数 |
| --- | ---: |
| Armor | 87 |
| Attire | 650 |
| Gear | 30 |
| Set | 63 |
| Uniform | 1 |

## 单变体（当前搜索规则未涵盖的候选）

- `Uraeus Attire (Coat)` → 圣蜥蜴革外套套装
- `Dhalmelskin Attire (Coat)` → 长颈驼革外套套装
- `Wool Attire (Suspenders)` → 呢绒背带衬衫套装

## 单套装包（当前搜索规则未涵盖的候选）

- `Antecedent's Attire` → 血盟女士套装
- `Scion Striker's Attire` → 血盟拳手套装
- `Head Engineer's Attire` → 首席机械师套装
- `Sake Set` → 酒杯套装
- `Picnic Set` → 野餐套装
- `Brand-new Alphinaud's Attire` → 新款阿尔菲诺服装套装
- `Omega-M Attire` → 欧米茄M服装套装
- `Omega-F Attire` → 欧米茄F服装套装
- `Lyse's Leadership Attire` → 阿拉米格莉瑟服装套装
- `Ironworks Tool Set` → 加隆德工具套装
- `Planter Set` → 植物套装
- `Brand-new Alisaie's Attire` → 新款阿莉塞服装套装
- `Gaia's Attire` → 盖娅服装套装
- `Toy Cooking Set` → 烹饪玩具套装
- `Sealing Wax & Letter Set` → 蜡封信纸套装
- `Dream Attire` → 梦幻套装
- `Reindeer Attire` → 驯鹿套装
- `Company Attire` → 部队套装
- `Mended Imperial Attire` → 修好的帝国装备套装
- `Snowman Attire` → 雪人套装
- `Highland Attire` → 高地套装
- `Glacial Attire` → 冰河套装
- `Sailor Attire` → 水手套装
- `Light Steel Attire` → 轻钢套装
- `Taffeta Attire` → 平纹套装
- `Sweet Dream Attire` → 美梦套装
- `Moogle Attire` → 莫古莫古套装
- `Starlight Attire` → 星芒套装
- `Best Man's Attire` → 伴郎套装
- `Bridesmaid's Attire` → 伴娘套装
- `Gambler's Attire` → 胜负师套装
- `Bunny Attire` → 兔女郎套装
- `Riviera Attire` → 海滨套装
- `Glade Attire` → 丛林套装
- `The Emperor's New Attire` → 皇帝的新装备套装
- `Advent Attire` → 孤云装备套装
- `Manderville Attire` → 绅士套装
- `Spotted Attire` → 女王豹纹套装
- `Wild Rose Attire` → 野玫瑰装备套装
- `Witch's Attire` → 魔女套装
- `Bunny Chief Attire` → 黑兔女郎套装
- `Falconer Attire` → 鹰猎人套装
- `Lord's Suikan Set` → 君子水干装束
- `Scion Conjurer's Attire` → 血盟幻术师套装
- `Scion Thief's Attire` → 血盟盗贼套装
- `Scion Thaumaturge's Attire` → 血盟咒术师套装
- `Scion Chronocler's Attire` → 血盟记录者套装
- `Amatsu Attire` → 天水影流装束
- `Lady's Suikan Set` → 淑女水干装束
- `Ramie (Shirt) & Dragonskin Set` → 青麻衬衫套装
- `Tantalus Attire` → 坦塔罗斯装备套装
- `Ironworks Engineer's Attire` → 炼铁厂工作服套装
- `Ramie (Tabard) & Dhalmelskin Set` → 青麻短袖罩衣套装
- `Wind Silk Attire` → 风绢套装
- `Housemaid's Attire` → 女仆装备套装

## 包物品已存在，但中文标题不以「套装／装束」结尾

- `Heavy Iron Armor` → 黑铁重甲
- `Aetherial Heavy Iron Armor` → 以太黑铁重甲
- `Heavy Steel Armor` → 白钢重甲
- `Aetherial Heavy Steel Armor` → 以太白钢重甲
- `High Mythril Armor` → 秘银重甲
- `Aetherial High Mythril Armor` → 以太秘银重甲
- `Heavy Darklight Armor` → 暗耀重甲
- `Heavy Darksteel Armor` → 玄钢重甲
- `Heavy Allagan Armor` → 亚拉戈重甲
- `Onion Armor` → 洋葱之铠
- `Wild Onion Set` → 野洋葱球根
- `Popoto Set` → 新薯芽块
- `Dalamud Popoto Set` → 卫月新薯芽块
- `Afternoon Tea Set` → 午茶组合
- `Glade Tea Set` → 林间午茶组合
- `Green Tea Set` → 抹茶组合
- `Riviera Garden Table Set` → 海滨庭院桌组合
- `Ishgardian Knight's Armor` → 伊修加德骑士甲
- `Ishgardian Banneret's Armor` → 伊修加德方旗骑士甲
- `Gobwalker Gear` → 哥布林战车齿轮
- `Alpine Tea Set` → 山岳午茶组合
- `Gordian Gear` → 戈耳狄齿轮
- `Large Gordian Gear` → 戈耳狄大齿轮
- `Oriental Tea Set` → 东方午茶组合
- `Replica Heavy Allagan Armor` → 亚拉戈重甲（复制品）
- `Alpine Supper Set` → 伊修加德晚餐组合
- `High House Supper Set` → 高贵晚餐组合
- `Uraeus Body Armor` → 圣蜥蜴革背心
- `Midan Gear` → 弥达斯齿轮
- `Allagan Aetherstone - Body Gear` → 亚拉戈以太石：身体防具
- `Allagan Aetherstone - Hand Gear` → 亚拉戈以太石：手部防具
- `Allagan Aetherstone - Leg Gear` → 亚拉戈以太石：腿部防具
- `Allagan Aetherstone - Foot Gear` → 亚拉戈以太石：脚部防具
- `High Allagan Aetherstone - Body Gear` → 亚拉戈高位以太石：身体防具
- `High Allagan Aetherstone - Hand Gear` → 亚拉戈高位以太石：手部防具
- `High Allagan Aetherstone - Leg Gear` → 亚拉戈高位以太石：腿部防具
- `High Allagan Aetherstone - Foot Gear` → 亚拉戈高位以太石：脚部防具
- `Neo Aetherstone - Body Gear` → 亚拉戈新型以太石：身体防具
- `Neo Aetherstone - Hand Gear` → 亚拉戈新型以太石：手部防具
- `Neo Aetherstone - Leg Gear` → 亚拉戈新型以太石：腿部防具
- `Neo Aetherstone - Foot Gear` → 亚拉戈新型以太石：脚部防具
- `Shire Custodian's Armor` → 田园管理者战甲
- `Shire Pathfinder's Armor` → 田园探索者战甲
- `Augmented Shire Custodian's Armor` → 改良型田园管理者战甲
- `Augmented Shire Pathfinder's Armor` → 改良型田园探索者战甲

## 多变体系列示例

- **Anemos**: Anemos Attire (Jacket) → 常风皮甲套装; Anemos Attire (Gambison) → 常风紧身衣套装
- **Belt-leather**: Belt-leather Attire (Trousers) → 皮带软甲裤套装; Belt-leather Attire (Cropped Slops) → 皮带七分裤套装
- **Collegiate**: Collegiate Attire (Slacks) → 学院长裤套装; Collegiate Attire (Skirt) → 学院短裙套装
- **Educand's**: Educand's Attire (Slacks) → 就学长裤装备套装; Educand's Attire (Skirt) → 就学短裙装备套装
- **Eternal Devotion**: Eternal Devotion Attire (Tailcoat) → 钟情燕尾礼服套装; Eternal Devotion Attire (Gown) → 钟情典礼纱裙套装
- **Eternal Innocence**: Eternal Innocence Attire (Tailcoat) → 纯情燕尾礼服套装; Eternal Innocence Attire (Gown) → 纯情典礼纱裙套装
- **Eternal Passion**: Eternal Passion Attire (Tailcoat) → 激情燕尾礼服套装; Eternal Passion Attire (Gown) → 激情典礼纱裙套装
- **Expeditioner's**: Expeditioner's Attire (Coat) → 远征外套套装; Expeditioner's Attire (Tabard) → 远征罩衣套装
- **Frontier**: Frontier Attire (Jacket) → 前沿外套套装; Frontier Attire (Dress) → 前沿礼服套装
- **High House**: High House Attire (Justaucorps) → 高贵紧身上衣套装; High House Attire (Bustle) → 高贵裙撑礼服套装
- **Isle Vacationer's**: Isle Vacationer's Attire (Shirt) → 海岛假日衬衫套装; Isle Vacationer's Attire (Tie-front Shirt) → 海岛假日系结衬衫套装
- **Martial Artist's**: Martial Artist's Attire (Vest) → 习武背心套装; Martial Artist's Attire (Sleeveless Vest) → 习武无袖背心套装
- **Moonfire**: Moonfire Attire (Vest) → 月火男式坎肩套装; Moonfire Attire (Halter) → 月火女式夏衣套装
- **Oasis**: Oasis Attire (Doublet) → 绿洲工作服套装; Oasis Attire (Tunic) → 绿洲束腰衣套装
- **Pagos**: Pagos Attire (Shirt) → 恒冰衬衫套装; Pagos Attire (Bolero) → 恒冰短外套套装
- **Rainbow**: Rainbow Set (Justaucorps) → 虹布紧身上衣套装; Rainbow Set (Bustle) → 虹布裙撑礼服套装
- **Salon Server's**: Salon Server's Attire (Vest) → 沙龙服务员坎肩套装; Salon Server's Attire (Dress Vest) → 沙龙服务员礼服坎肩套装
- **Spring**: Spring Attire (Dress) → 春意套装; Spring Attire (Shirt) → 春意衬衫套装
- **Summertide Formal**: Summertide Formal Attire (Jacket) → 夏令礼服套装; Summertide Formal Attire (Dress) → 夏令礼裙套装
- **Thavnairian**: Thavnairian Attire (Bolero) → 萨维奈短外套套装; Thavnairian Attire (Bustier) → 萨维奈舞裙套装
- **Valentione**: Valentione Attire (Apron) → 恋人围裙服套装; Valentione Attire (Apron Dress) → 恋人围裙装套装
- **Valentione Acacia**: Valentione Acacia Attire (Waistcoat) → 相思树恋人坎肩套装; Valentione Acacia Attire (Dress) → 相思树恋人礼服套装
- **Valentione Emissary's**: Valentione Emissary's Attire (Jacket) → 爱情传道士外套套装; Valentione Emissary's Attire (Ruffled Dress) → 爱情传道士褶边连衣裙套装
- **Valentione Forget-me-not**: Valentione Forget-me-not Attire (Waistcoat) → 勿忘草恋人坎肩套装; Valentione Forget-me-not Attire (Dress) → 勿忘草恋人礼服套装
- **Valentione Rose**: Valentione Rose Attire (Waistcoat) → 玫瑰花恋人坎肩套装; Valentione Rose Attire (Dress) → 玫瑰花恋人礼服套装
- **Varsity**: Varsity Attire (Jacket) → 校园外套套装; Varsity Attire (Buttoned Jacket) → 系扣校园外套套装
- **Wintertide**: Wintertide Attire (Culottes) → 冬季宽松直筒裤套装; Wintertide Attire (Sheath Skirt) → 冬季紧身短裙套装
- **Woodland Warden's**: Woodland Warden's Attire (Breeches) → 林地守护者马裤装备套装; Woodland Warden's Attire (Skirt) → 林地守护者短裙装备套装
- **Yakaku**: Yakaku Attire (Koshita) → 夜鹤装束; Yakaku Attire (Fundoshi) → 夜鹤裈装束

## 风险控制建议

- 索引候选来自已有国服物品库；不能据此构造未经验证的 EC 详情页 URL。
- 区分「套装中文译名覆盖」「搜索关键词转换」「EC 实际存在性」三个独立指标。
- 单套装包不能被 ≥2 括号款式算法涵盖，应通过确切物品对应或实页证据进入检索。
- 含特别款式、不规则标题、套装包名称与页面标题不同的套装需测试回归。
