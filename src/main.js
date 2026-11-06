import './core/probe.js';
import { ensureTables } from './core/data-manager.js';
import { _zhxErr, safe } from './core/runtime.js';
import { findSite } from './core/site-registry.js';
import { startChineseSearch } from './core/chinese-search.js';
import { ensureChineseFont } from './core/dom.js';
import { startEarlyECItems } from './core/targets.js';



  /* ===================================================================== */

  const host = location.hostname;
  const _ver = (typeof GM_info !== 'undefined' && GM_info?.script?.version) ? GM_info.script.version : 'dev';
  console.log('FF14 幻化站中文化脚本已加载 v' + _ver + ' →', host);
  // 读缓存和下载词库可以与 HTML 解析并行。
  safe(ensureTables, '数据预加载')();
  const __site = findSite();
  const bootSite = () => {
    if (!__site) return;
    safe(ensureChineseFont, '中文字体')();
    safe(startChineseSearch, '中文装备搜索')(__site.id);
    try { __site.boot(); } catch (e) { _zhxErr('boot:' + __site.id, e); }
  };
  const bootWhenReady = () => {
    // xivc 的局部观察器需要 React 已挂载的抽屉。
    if (__site?.id === 'xivc' && !document.getElementById('drawer') && document.readyState !== 'complete') {
      window.addEventListener('load', bootSite, { once: true });
    } else {
      bootSite();
    }
  };
  if (document.readyState === 'loading') {
    if (__site?.id === 'ec') safe(startEarlyECItems, 'EC 提前翻译装备')();
    document.addEventListener('DOMContentLoaded', bootWhenReady, { once: true });
  } else {
    bootWhenReady();
  }

  // v1.3：bfcache 兜底——页面从浏览器缓存恢复（快速刷新/后退前进）时可能带着
  // 未完成的注入状态回来，补跑一次各站入口（全部幂等）+ 数据就绪检查。
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    try {
      if (__site) { ensureChineseFont(); __site.pageshow(); }   // 各站补跑入口（Site Registry 配置驱动）
      safe(ensureTables, 'pageshow 数据')();
    } catch (err) { _zhxErr('pageshow', err); }
  });
