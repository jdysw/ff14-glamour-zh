/* @phase15-module-order:core/constants */
/* @phase15-order-link:core/constants<-sites/ronka */
import '../sites/ronka.js';
export { DATA_BASE, DATA_BASE_V3, DATA_FILES, DATA_REMOTE, WIKI_ITEM, ZHX_WIKI_ICON };


  /* =====================================================================
   * 第四部分：装备名 / 染剂名 → 国服中文名 + 国服 wiki 物品页
   * 对照数据以四语 datamining（中/英/日/韩）为权威源融合生成，以纯文本
   * 数据文件（非可执行代码）托管在 zhixia-data.pages.dev；
   * 按站点所需下载，并按版本缓存于用户脚本管理器本地存储（跨站共享、
   * 每日至多检查一次更新）。脚本只读数据，不上传任何用户信息。
   * 两站装备链接都带 class="eorzeadb_link"、href 内含 Lodestone hash：
   * 优先用 hash 精确匹配，退化用日文名 / 英文名匹配。
   * ===================================================================== */

  // 灰机 wiki 物品页前缀；灰机 favicon 48×48（data URI 内嵌，用于把外服
  // 链接图标替换为灰机 wiki 标识，免外部请求；图标版权归灰机 wiki）
  const WIKI_ITEM = 'https://ff14.huijiwiki.com/wiki/物品:';
  const ZHX_WIKI_ICON = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBwgHBgkIBwgKCgkLDRYPDQwMDRsUFRAWIB0iIiAdHx8kKDQsJCYxJx8fLT0tMTU3Ojo6Iys/RD84QzQ5OjcBCgoKDQwNGg8PGjclHyU3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3N//AABEIADAAMAMBIgACEQEDEQH/xAAZAAEAAwEBAAAAAAAAAAAAAAAGBAUHAQL/xAAzEAACAgEDAQUFBwUBAAAAAAABAgMEEQAFEiEGIjFBURMyYYGRByNSYnFygkNzobHwFP/EABgBAAMBAQAAAAAAAAAAAAAAAAECBAAD/8QAGBEBAQEBAQAAAAAAAAAAAAAAAQARAiH/2gAMAwEAAhEDEQA/ANt1G3C2KVYy8eb+CIDjk3pqTo5dtx293ljZvu6zCFfjIVLNj9Bj6HQJaBbs3rmRatyxA/06zGMD+Q7x+uo0cTw9YLd2J/HmLLt9QxIPzGp3cECSP4zHu9PX/v8Aeo9d45LVuJ2UCDALZwOoGmyR2tdr3qY246t7DrNkRTKvHvAZ4sPiM4Pwx6aQaGKP/VBdiiKhoXZYm/C4AIPyYf40r220t7b61tfdniWQD0yM6CTlW7jv61Z5q8VG1NNF48AuOo6HGc4+OPI6FRWLkd2hBaRRK80s2A2e8R3ifMe8x6+un+8bRV3aAx2AySBSEnibhJHn8LDqNZlYWLYphRbcGuHb7Ucft5GIdY2J7pHUEAs4z+X4DS+7N5ke3/7S60FmCpFHYElGxIko4gBsEr0OfTOuW/tK7PiGBKkd9mCL7ZmiUc2D8yfe8yT9dOOwNKluT7jblgjaSK6WVSoPRk5D9R94300it7r2epyPHOIOUZIfjVL8SPHJCnQewYnOnlkEn2k7PGZlqi8FkjZuZRQTMVUBiOXhkHWw9gr62+ztOD2cqyVq8aSF1wpPHyPnon2p2+lvHaijtu3mNDZj5SvGgIwwB5fJUHT851pNWCKpWir10VIolCoqjAAGjsre5kaSJ0WRo2YEB1xlfiM9NDt17BU3pyrQkMUjxhXeVsmTvFmZm8z1Ok+57tR2uNWuzhC2eEags8mPHioyT8hqukDbtD7S+QlIjpUVslv7hHj+0dPXOsuWDY/2d2oUqXOlbYL7UvWmQdGjwBgg+8pIJx8ehHjqVboxzE2JqNU3HYcpDM4iLeAYx+f7fPoM+erCbmziRPeGe74Aj01wcZQpKnAOeLdCCPUan6dao5wqnsT2f5XG36zalksNLIEDY93LghunqSemnOicNavHJLPAJ6ztI3I1nKmQ+vHwJznxGrKM74kYlE1WXrn2E0fFsenNTjP8ca66NP1w8t//2Q==';

  /* @zhixia:data-layer-start */
  /* ── 外置数据版（Greasy Fork 发布版）：按需下载 + 版本化本地缓存 ──
     内嵌自用版构建链已退役（v1.4），仅维护本外置版。 */
  /* @zhixia:core-constants-start */
  /* ── Core Constants（v1.4 Phase 4）：数据源与网络契约（DATA_BASE /
       DATA_FILES，均为 https）。Phase 15 模块化构建时，本区段将原样抽出为
       src/core/constants.js。 */
  const DATA_REMOTE = true;
  const DATA_BASE = 'https://zhixia-data.pages.dev/ff14/v2/';
  const DATA_BASE_V3 = 'https://zhixia-data.pages.dev/ff14/v3/';   // Runtime Data v3（Phase 12；失败回退 v2）
  const DATA_FILES = {
    items: 'items.tsv',   // 「key|中|英|日|韩|hash|EC_ID|别名」（制表符分隔，一物品一行）
    series: 'series.txt', // 「日文系列名|国服中文名」
    acl: 'acl.txt',       // 「日文副本名|国服中文名」
    dict: 'dict.json',    // 词库（6 层合并紧凑 JSON；v1.2.0 起运行时更新，改词无需发版）
  };

  /* @zhixia:core-constants-end */
