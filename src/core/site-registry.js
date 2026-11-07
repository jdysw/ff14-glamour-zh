import { dataGetStatus, ensureTables, onTablesReady } from './data/data-manager.js';
import { observeUntilDomReady } from './observer.js';
import { findSitePolicy } from './site-policy.js';
import { _zhxErr, safe } from './runtime.js';
import { applyItemZh, EARLY_EQUIPMENT_SEL, startItems, translateEarlyEquipment, translateKnownEquipmentText } from './targets.js';
import { bindECPieceTiles, startEC, translateECPage, translateECTitle } from '../sites/eorzea-collection.js';
import { bindFCBanners, fixFCMenu, startFC, translateFCPage, translateFCTitle } from '../sites/ff14-fc.js';
import { startACL, translateACLPage, translateACLTitle } from '../sites/ffxiv-collection.js';
import { injectWikiButton, startWiki } from '../sites/huiji-wiki.js';
import { startMirapri, translatePage } from '../sites/mirapri.js';
import { startRonka, translateRonkaPage, translateRonkaTitle } from '../sites/ronka.js';
import { startEndCloset, translateEndClosetPage, translateEndClosetTitle } from '../sites/endcloset.js';
import { startMiramiru, translateMiramiruPage } from '../sites/miramiru.js';
import { startEden, translateEdenPage } from '../sites/mirapri-eden.js';
import { startXivc, translateXivcPage } from '../sites/xivc.js';
export { SITE_REGISTRY, createSiteAdapter, findSite };

const FC_EARLY_EQUIPMENT = 'a[href*="/equipment/"], a[href*="/equipment_"], a[href*="/playguide/db/item/"]';
const ACL_EARLY_EQUIPMENT = '.item-name > p:not(.region-name)';

  /* @zhixia:site-registry-start */
  /* ── Site Registry：站点启动行为与 DOM 适配器 ──────────────────
     域名、数据表、索引需求统一由 site-policy.js 提供，禁止在此重复维护。
     本模块只绑定站点启动函数和页面生命周期回调；启动与数据策略分层后，
     数据管理器不需要加载站点启动适配器。 */
  // Register only the lifecycle hooks used by main.js and data readiness.
  // Host matching and data requirements stay in site-policy.js.
  function createSiteAdapter(cfg) {
    const c = cfg || {};
    return {
      id: c.id,
      prepare() {
        const early = c.early;
        if (!early || (early.matches && !early.matches(location.pathname))) return;
        const ready = ensureTables().then(() => dataGetStatus().state === 'ready');
        observeUntilDomReady(ready, early.selector, early.translate);
      },
      boot() {
        // Phase 18：适配器入口错误边界——单站启动失败不影响脚本其余部分（其余站点/兜底/探测照常）
        if (typeof c.start === 'function') { try { c.start(); } catch (e) { _zhxErr('boot:' + (c.id || 'site'), e); } }
        if (typeof c.onDataReady === 'function') {
          onTablesReady((status) => {
            // 保持历史回调调用时机，并将只读加载状态交给站点适配器。
            // 将来若多个站点适配器共用同一脚本实例，不跨站派发数据状态。
            if (status?.site && status.site !== c.id) return;
            try { c.onDataReady(status); } catch (e) { _zhxErr('dataReady:' + (c.id || 'site'), e); }
          });
        }
      },
      pageshow() {
        if (typeof c.onPageShow === 'function') { try { c.onPageShow(); } catch (e) { _zhxErr('pageshow:' + (c.id || 'site'), e); } }
      },
    };
  }

  const SITE_REGISTRY = [
    // 站点顺序须与 site-policy.js 的配置一致。
    // （注册顺序 = 匹配优先级，保持 Phase 3 金标准不变）
    createSiteAdapter({
      id: 'mirapri',
      early: { selector: EARLY_EQUIPMENT_SEL, translate: translateEarlyEquipment },
      start() { startMirapri(); startItems(); },
      onPageShow() { safe(translatePage, 'pageshow')(); safe(applyItemZh, 'pageshow')(); },
    }),
    createSiteAdapter({
      id: 'ec',
      early: {
        selector: EARLY_EQUIPMENT_SEL,
        matches: path => /^\/glamour\/\d+(?:\/|$)/.test(path),
        translate: translateEarlyEquipment,
      },
      start() { startEC(); startItems(); },
      onDataReady() {
        const rescan = () => {
          safe(translateECPage, 'EC 补扫')();
          // 自动推导的套装名要等 V3 nameMap 加载，浏览器标题也需补翻译。
          safe(translateECTitle, 'EC 数据就绪页面标题')();
        };
        // 先让物品链接的就绪回调完成，再在渲染机会之后补扫整页。
        if (document.visibilityState === 'visible' && typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => setTimeout(rescan, 0));
        } else {
          setTimeout(rescan, 0);
        }
      },
      onPageShow() {
        safe(translateECPage, 'pageshow')();
        safe(translateECTitle, 'EC pageshow 标题')();
        safe(bindECPieceTiles, 'pageshow')();
        safe(applyItemZh, 'pageshow')();
      },
    }),
    createSiteAdapter({
      id: 'wiki',
      start() { startWiki(); },
      onDataReady() { safe(injectWikiButton, 'Wiki 反查刷新')(); },
      onPageShow() { safe(injectWikiButton, 'pageshow')(); },
    }),
    createSiteAdapter({
      id: 'fc',
      early: {
        selector: FC_EARLY_EQUIPMENT,
        translate: root => translateKnownEquipmentText(root, FC_EARLY_EQUIPMENT, translateFCPage),
      },
      start() { startFC(); },
      onDataReady() { safe(translateFCPage, 'FC 补扫')(); safe(translateFCTitle, 'FC 标题')(); safe(fixFCMenu, 'FC 菜单')(); safe(bindFCBanners, 'FC 横幅')(); },
      onPageShow() { safe(translateFCPage, 'pageshow')(); },
    }),
    createSiteAdapter({
      id: 'ronka',
      start() { startRonka(); },
      onDataReady() { safe(translateRonkaPage, 'Ronka 补扫')(); safe(translateRonkaTitle, 'Ronka 标题')(); },
      onPageShow() { safe(translateRonkaPage, 'pageshow')(); safe(translateRonkaTitle, 'pageshow')(); },
    }),
    createSiteAdapter({
      id: 'collection',
      early: {
        selector: ACL_EARLY_EQUIPMENT,
        translate: root => translateKnownEquipmentText(root, ACL_EARLY_EQUIPMENT, translateACLPage),
      },
      start() { startACL(); },
      onDataReady() { safe(translateACLPage, 'ACL 补扫')(); safe(translateACLTitle, 'ACL 标题')(); },
      onPageShow() { safe(translateACLPage, 'pageshow')(); },
    }),
    createSiteAdapter({
      id: 'endcloset',
      start() { startEndCloset(); },
      onDataReady() { safe(translateEndClosetPage, 'EndCloset 补扫')(); safe(translateEndClosetTitle, 'EndCloset 标题')(); },
      onPageShow() { safe(translateEndClosetPage, 'pageshow')(); safe(translateEndClosetTitle, 'pageshow')(); },
    }),
    createSiteAdapter({
      id: 'miramiru',
      start: startMiramiru,
      onDataReady() { translateMiramiruPage(); },
      onPageShow: translateMiramiruPage,
    }),
    createSiteAdapter({ id: 'eden', start: startEden,
      onDataReady() { translateEdenPage(); }, onPageShow: translateEdenPage }),
    createSiteAdapter({ id: 'xivc', start: startXivc,
      onDataReady() { translateXivcPage(); }, onPageShow: translateXivcPage }),
  ];

  // 只保留站点启动行为；站点选择和数据需求由纯策略模块负责。
  function findSite() {
    const policy = findSitePolicy();
    return policy ? SITE_REGISTRY.find(adapter => adapter.id === policy.id) || null : null;
  }
  /* @zhixia:site-registry-end */
