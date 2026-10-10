/* @phase15-module-order:core/site-registry */
/* @phase15-order-link:core/site-registry<-core/http */
import './http.js';
import { DATA_REMOTE } from './constants.js';
import { onTablesReady } from './data-manager.js';
import { _zhxErr, safe } from './runtime.js';
import { applyItemZh, startItems } from './targets.js';
import { bindECPieceTiles, startEC, translateECPage, translateECTitle } from '../sites/eorzea-collection.js';
import { bindFCBanners, fixFCMenu, startFC, translateFCPage, translateFCTitle } from '../sites/ff14-fc.js';
import { startACL, translateACLPage, translateACLTitle } from '../sites/ffxiv-collection.js';
import { injectWikiButton, startWiki } from '../sites/huiji-wiki.js';
import { startMirapri, translatePage } from '../sites/mirapri.js';
import { startRonka, translateRonkaPage, translateRonkaTitle } from '../sites/ronka.js';
import { startEndCloset, translateEndClosetPage, translateEndClosetTitle } from '../sites/endcloset.js';
export { SITE_REGISTRY, _siteIndexes, createSiteAdapter, findSite, neededTables, onHost };


  /* @zhixia:site-registry-start */
  /* ── Site Registry（v1.4 Phase 3）：六站唯一配置源 ─────────────────────
     一处维护：新增站点 = 本表加一条（并同步 userscript @match 头）；为某站
     新增索引 = 站内 indexes 加一项；调整所需数据表 = 站内 tables。hosts 用
     onHost 精确匹配（含子域）；boot = 页面加载即启动；pageshow = bfcache
     恢复补跑（各函数幂等，safe 包裹）。Phase 15 模块化构建时，本区段将
     原样抽出为 src/core/site-registry.js。 */
  // 域名精确匹配（含子域）：evilmirapri.com 不匹配、www.mirapri.com 匹配
  // （安全加固：原 endsWith('mirapri.com') 会被任意前缀域名绕过——CodeQL js/incomplete-url-substring-sanitization）
  const onHost = (h, d) => h === d || h.endsWith('.' + d);

  // 统一站点适配器工厂（v1.4 Phase 9）：六站标准接口——
  //   id / hosts / tables / indexes   配置面（Phase 3 约定）
  //   start()        页面加载即启动（原 boot 的站点入口）
  //   processRoot()  统一处理入口（root 缺省 = 全页；元素 = 局部）
  //   onDataReady()  数据就绪补扫（外置版；由 boot 统一登记到 onTablesReady）
  //   onPageShow()   bfcache 恢复补跑（原 pageshow）
  //   destroy()      预留：站点销毁（现状站点均常驻，无实现）
  // 站点实现（startXxx / translateXxx）仍居各自区段，后续渐进迁移；
  // Phase 15 模块化构建时，各 adapter 将随区段原样抽出为 src/sites/*.js。
  function createSiteAdapter(cfg) {
    const c = cfg || {};
    return {
      id: c.id,
      hosts: c.hosts || [],
      tables: c.tables || [],
      indexes: c.indexes || [],
      boot() {
        // Phase 18：适配器入口错误边界——单站启动失败不影响脚本其余部分（其余站点/兜底/探测照常）
        if (typeof c.start === 'function') { try { c.start(); } catch (e) { _zhxErr('boot:' + (c.id || 'site'), e); } }
        if (DATA_REMOTE && typeof c.onDataReady === 'function') {
          onTablesReady(() => { try { c.onDataReady(); } catch (e) { _zhxErr('dataReady:' + (c.id || 'site'), e); } });
        }
      },
      pageshow() {
        if (typeof c.onPageShow === 'function') { try { c.onPageShow(); } catch (e) { _zhxErr('pageshow:' + (c.id || 'site'), e); } }
      },
      processRoot: typeof c.processRoot === 'function' ? c.processRoot : () => {},
      destroy: typeof c.destroy === 'function' ? c.destroy : () => {},
    };
  }

  const SITE_REGISTRY = [
    // ── 站点拆分顺序（计划书 9.2）：① ronka ② ec ③ mirapri ④ fc ⑤ collection ⑥ wiki ──
    // （注册顺序 = 匹配优先级，保持 Phase 3 金标准不变）
    createSiteAdapter({
      id: 'mirapri', hosts: ['mirapri.com'], tables: ['items', 'dict'], indexes: ['nameMap', 'itemHash'],
      start() { startMirapri(); startItems(); },
      processRoot(root) { safe(translatePage, 'mirapri 处理')(root); },
      onPageShow() { safe(translatePage, 'pageshow')(); safe(applyItemZh, 'pageshow')(); },
    }),
    createSiteAdapter({
      id: 'ec', hosts: ['eorzeacollection.com'], tables: ['items', 'dict'], indexes: ['nameMap', 'itemHash'],
      start() { startEC(); startItems(); },
      processRoot(root) { safe(translateECPage, 'EC 处理')(root); safe(applyItemZh, 'EC 物品处理')(); },
      onDataReady() {
        safe(translateECPage, 'EC 补扫')();
        // 自动推导的套装名要等 V3 nameMap 加载，浏览器标题也需在此时补翻译。
        safe(translateECTitle, 'EC 数据就绪页面标题')();
      },
      onPageShow() {
        safe(translateECPage, 'pageshow')();
        safe(translateECTitle, 'EC pageshow 标题')();
        safe(bindECPieceTiles, 'pageshow')();
        safe(applyItemZh, 'pageshow')();
      },
    }),
    createSiteAdapter({
      id: 'wiki', hosts: ['huijiwiki.com'], tables: ['items', 'dict'], indexes: ['ecidMap', 'koByZh'],
      start() { startWiki(); },
      onDataReady() { safe(injectWikiButton, 'Wiki 反查刷新')(); },
      onPageShow() { safe(injectWikiButton, 'pageshow')(); },
    }),
    createSiteAdapter({
      id: 'fc', hosts: ['ff14-fc.com'], tables: ['items', 'series', 'dict'], indexes: ['nameMap', 'itemHash'],
      start() { startFC(); },
      processRoot(root) { safe(translateFCPage, 'FC 处理')(root); },
      onDataReady() { safe(translateFCPage, 'FC 补扫')(); safe(translateFCTitle, 'FC 标题')(); safe(fixFCMenu, 'FC 菜单')(); safe(bindFCBanners, 'FC 横幅')(); },
      onPageShow() { safe(translateFCPage, 'pageshow')(); },
    }),
    createSiteAdapter({
      id: 'ronka', hosts: ['ronkacloset.com'], tables: ['items', 'dict'], indexes: ['nameMap'],
      start() { startRonka(); },
      processRoot(root) { safe(translateRonkaPage, 'Ronka 处理')(root); },
      onDataReady() { safe(translateRonkaPage, 'Ronka 补扫')(); safe(translateRonkaTitle, 'Ronka 标题')(); },
      onPageShow() { safe(translateRonkaPage, 'pageshow')(); safe(translateRonkaTitle, 'pageshow')(); },
    }),
    createSiteAdapter({
      id: 'collection', hosts: ['ffxivcollection.com'], tables: ['items', 'series', 'acl', 'dict'], indexes: ['nameMap'],
      start() { startACL(); },
      processRoot(root) { safe(translateACLPage, 'ACL 处理')(root); },
      onDataReady() { safe(translateACLPage, 'ACL 补扫')(); safe(translateACLTitle, 'ACL 标题')(); },
      onPageShow() { safe(translateACLPage, 'pageshow')(); },
    }),
    createSiteAdapter({
      id: 'endcloset', hosts: ['end-closet.com'], tables: ['items', 'dict'], indexes: ['nameMap'],
      start() { startEndCloset(); },
      processRoot(root) { safe(translateEndClosetPage, 'EndCloset 处理')(root); },
      onDataReady() { safe(translateEndClosetPage, 'EndCloset 补扫')(); safe(translateEndClosetTitle, 'EndCloset 标题')(); },
      onPageShow() { safe(translateEndClosetPage, 'pageshow')(); safe(translateEndClosetTitle, 'pageshow')(); },
    }),
  ];

  // 测试钩子：__zhxTestSite 指定站点 id（file:// 集成测试用；生产不存在，零开销）
  function findSite() {
    if (window.__zhxTestSite) { for (const s of SITE_REGISTRY) { if (s.id === window.__zhxTestSite) return s; } }
    const h = location.hostname;
    for (const s of SITE_REGISTRY) {
      for (const d of s.hosts) { if (onHost(h, d)) return s; }
    }
    return null;
  }

  // 索引依据全库调用链核查——nameMap：各站文本翻译共用；itemHash：lookupZh
  // （EC/mirapri 装备链接）与 fcLinkZhName（FC）；ecidMap/koByZh：仅 wiki
  // 反查块（EC/韩服链接）。未知站点返回 null（全建，保守）。
  function neededTables() {
    if (window.__zhxTestTables) return window.__zhxTestTables;
    const s = findSite();
    return s ? s.tables : [];
  }

  function _siteIndexes() {
    if (window.__zhxTestIndexes) return window.__zhxTestIndexes;
    const s = findSite();
    return s ? s.indexes : null;
  }
  /* @zhixia:site-registry-end */
