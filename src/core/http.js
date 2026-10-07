/* @phase15-module-order:core/http */
/* @phase15-order-link:core/http<-core/storage */
import './storage.js';
export { httpGet };


  /* @zhixia:core-http-start */
  /* ── Core HTTP（v1.4 Phase 4）：GM_xmlhttpRequest 优先（不受页面 CSP /
       CORS 限制），无则 fetch 兜底；统一 timeout 与错误策略。Phase 15 模块化
       构建时，本区段将原样抽出为 src/core/http.js。 */

  /* ── 网络：优先 GM_xmlhttpRequest（不受页面 CSP/CORS 限制），无则 fetch ── */
  function httpGet(url, timeout) {
    return new Promise((resolve, reject) => {
      let done = false;
      const ok = (t) => { if (!done) { done = true; resolve(t); } };
      const bad = (e) => { if (!done) { done = true; reject(e instanceof Error ? e : new Error(String(e))); } };
      try {
        if (typeof GM_xmlhttpRequest === 'function') {
          GM_xmlhttpRequest({
            method: 'GET', url,
            timeout: timeout || 20000,
            onload: (r) => { (r?.status >= 200 && r.status < 300) ? ok(r.responseText || '') : bad(new Error('HTTP ' + r?.status)); },
            onerror: () => bad(new Error('network')),
            ontimeout: () => bad(new Error('timeout')),
          });
          return;
        }
      } catch (e) { /* 忽略：GM 通道不可用——按序尝试 fetch 兜底 */ }
      try {
        if (typeof fetch === 'function') {
          let ctl = null, tm = null;
          try {
            if (typeof AbortController === 'function') {
              ctl = new AbortController();
              tm = setTimeout(() => { try { ctl.abort(); } catch (e) { /* 忽略：abort 清理调用失败无碍 */ } }, timeout || 20000);
            }
          } catch (e) { /* 忽略：无 AbortController——不设置取消 */ }
          fetch(url, ctl ? { signal: ctl.signal } : {}).then(
            (r) => { if (tm) { clearTimeout(tm); } return r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status)); },
            (e) => { if (tm) { clearTimeout(tm); } throw e; }
          ).then(ok, bad);
          return;
        }
      } catch (e) { /* 忽略：fetch 不可用——走最后兜底 */ }
      bad(new Error('no http transport'));
    });
  }

  /* @zhixia:core-http-end */
