/* @phase15-module-order:main */
/* @phase15-order-link:main<-core/probe */
import './core/probe.js';
import { DATA_REMOTE } from './core/constants.js';
import { DATA_TEXT, _irBuildAux, ensureTables, itemDbReady } from './core/data-manager.js';
import { _zhxErr, safe } from './core/runtime.js';
import { findSite } from './core/site-registry.js';


  // 数据就绪后建立衍生注册表（加载早期未注册时保持 null——查询路径均有回退）。
  if (typeof itemDbReady === 'function') {
    try { itemDbReady(() => { try { _irBuildAux(DATA_TEXT.items); } catch (e) { _zhxErr('resolverAux', e); } }); }
    catch (e) { _zhxErr('itemDbReady', e); }
  }
  /* @zhixia:core-item-resolver-end */

  /* ===================================================================== */

  const host = location.hostname;
  const _ver = (typeof GM_info !== 'undefined' && GM_info?.script?.version) ? GM_info.script.version : 'dev';
  console.log('FF14 幻化站中文化脚本已加载 v' + _ver + ' →', host);
  // 外置版：先行触发数据加载（各站的就绪回调在数据到达后补扫）
  if (DATA_REMOTE && typeof ensureTables === 'function') safe(ensureTables, '数据预加载')();
  const __site = findSite();
  if (__site) { try { __site.boot(); } catch (e) { _zhxErr('boot:' + __site.id, e); } }   // 站点入口（Site Registry 配置驱动；Phase 18 边界）

  // v1.3：bfcache 兜底——页面从浏览器缓存恢复（快速刷新/后退前进）时可能带着
  // 未完成的注入状态回来，补跑一次各站入口（全部幂等）+ 数据就绪检查。
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    try {
      if (__site) __site.pageshow();   // 各站补跑入口（Site Registry 配置驱动）
      safe(ensureTables, 'pageshow 数据')();
    } catch (err) { _zhxErr('pageshow', err); }
  });
