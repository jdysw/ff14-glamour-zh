# Eorzea Collection 智能输入：页面与装备类别隔离

## 目标

智能中文候选依据**当前 EC 页面以及具体输入框**限定装备类型，不把全站数万件允许幻化装备都显示在任何搜索控件里。

| 场景 | 使用的权威分类 | 候选 |
| --- | --- | --- |
| `/companion-glamours` | 游戏 `ItemAction.csv` 的 `Action=1013` | 鸟甲和鸟甲部件；包括 `Flyer Shaffron`、`Egg Harness` 等不能靠名称判断的物品 |
| `/facewear` 和面饰详情 | 独立 `Glasses.csv` 表（CN/EN 同一行 ID，按 Style 去重） | 面饰种类及对应国服中文名；**不含普通头部装备、遮阳伞和鸟甲** |
| `/accessories` 与饰品详情页的未分部位搜索框 | 官方耳、颈、腕、指 `EquipSlotCategory` 的并集 | 只显示饰品，不再回退到全装备索引 |
| EC Vue 装备部位输入 `Any head/body/hands/legs/feet` | V3 `names.tsv` 第四列，源自官方 `EquipSlotCategory` | 仅对应的头／身／手／腿／脚装备 |
| 普通 `/gearsets` 主搜索框 | 已有 Gearsets 中文套装目录 | 套装，不按具体装备部位过滤 |
| EC 其他没有明确类别标识的中文搜索 | 既有物品索引 | 保留当前站点行为，不根据中文字符串猜装备部位 |
| 非 EC 站点 | 无变化 | 原有搜索和候选行为 |

## 分类的可靠性

- 不能凭 `Barding` 字样判断鸟甲：例如 `Flyer Shaffron`、`Egg Harness` 是鸟甲，`Barding Repair Materials` 不是鸟甲。
- 不能凭“眼镜”二字判断面饰：游戏的面饰已独立于装备 Item 表，`Glasses.csv` 的中文和英文对照应直接使用，而不是把头盔中的眼镜物品也加入。
- 五大装备部位使用现有 V3 的数值元数据；没有确切部位时不跨组造候选。
- 饰品页面未指定耳、颈、腕、指具体部位时使用官方四部位并集；一旦指定具体部位则优先遵循该部位过滤，页面路径不会覆盖更窄的选择器分类。
- 候选过滤**先于**通用上限和排序执行，避免过滤前结果已被大量其他部位挤占。
- 中文别名不允许绕过类别白名单。用户点选候选时仍使用对应站点原生英文名称触发搜索；直接回车只有在该类别中有唯一明确的候选时才转换。
- EC 独立搜索组件在增量 DOM 变更时保留页面路径与输入框的分类限制。原本的 Gearsets 搜索、非 EC 站点、投稿标题/作者字段不受影响。

## 数据来源与更新

鸟甲与面饰数据不额外依赖运行时网络：

- 鸟甲：`xivapi/ffxiv-datamining/csv/en/Item.csv` 配合 `ItemAction.csv`，按 Action 类型筛选。
- 面饰：`xivapi/ffxiv-datamining/csv/en/Glasses.csv` 与 `thewakingsands/ffxiv-datamining-cn/Glasses.csv`，使用 Row ID 配对并按 Style 去重。
- 当前静态快照为 **104 个鸟甲相关物品、61 个基础面饰类型**。游戏更新后可执行以下命令再提交受版本控制的差异：

```bash
python3 tools/update-ec-search-categories.py \
  --item /path/to/en-Item.csv \
  --actions /path/to/en-ItemAction.csv \
  --glasses-en /path/to/en-Glasses.csv \
  --glasses-zh /path/to/cn-Glasses.csv
```

使用 `--check` 可比对源数据与代码快照而不写入文件。V3 装备部位元数据继续通过现有的数据站部署工作流和 `FF14_EQUIP_SLOTS_CSV` 生成；不修改游戏物品 TSV 格式。

## 验证重点

通过 `node tests/unit/test-item-resolver.mjs`、`node tests/unit/test-chinese-search-ui.mjs` 以及 CI 三组集成测试。在线页面仍应复测面饰中文精确项、鸟甲特殊部件、五个装备部位、普通套装主搜索，以及中日韩站点既有搜索互不干扰。
