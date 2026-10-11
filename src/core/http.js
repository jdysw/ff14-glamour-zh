/* @phase15-module-order:core/http */
/* @phase15-order-link:core/http<-core/storage */
import './storage.js';
export { httpGet };


  /* @zhixia:core-http-start */
  /* ── Core HTTP（v1.4 Phase 4）：GM_xmlhttpRequest 优先（不受页面 CSP /
       CORS 限制），无则 fetch 兜底；统一 timeout 与错误策略。Phase 15 模块化
       构建时，本区段将原样抽出为 src/core/http.js。 */

  /* ── 网络：优先 GM_xmlhttpRequest（不受页面 CSP/CORS 限制），无则 fetch ── */
  let _httpFreshSequence = 0;
  function _httpFreshUrl(url) {
    const hashAt = url.indexOf('#');
    const base = hashAt < 0 ? url : url.slice(0, hashAt);
    const hash = hashAt < 0 ? '' : url.slice(hashAt);
    const sep = base.includes('?') ? '&' : '?';
    const token = Date.now().toString(36) + '-' + (++_httpFreshSequence).toString(36);
    return base + sep + '_zhx_refresh=' + token + hash;
  }

  function httpGet(url, timeout, options) {
    const fresh = options?.fresh === true;
    const requestUrl = fresh ? _httpFreshUrl(url) : url;
    const headers = fresh ? { 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' } : undefined;
    return new Promise((resolve, reject) => {
      let done = false;
      let timeoutTimer = null;
      const finish = (fn, value) => {
        if (done) return;
        done = true;
        if (timeoutTimer !== null) clearTimeout(timeoutTimer);
        fn(value);
      };
      const ok = (t) => finish(resolve, t);
      const bad = (e) => finish(reject, e instanceof Error ? e : new Error(String(e)));
      try {
        if (typeof GM_xmlhttpRequest === 'function') {
          GM_xmlhttpRequest({
            method: 'GET', url: requestUrl, headers,
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
          // Cover both fetch() and response.text(): headers may arrive while the body stalls.
          const ms = Number.isFinite(Number(timeout)) && Number(timeout) > 0 ? Number(timeout) : 20000;
          const ctl = typeof AbortController === 'function' ? new AbortController() : null;
          const fetchOptions = ctl ? { signal: ctl.signal } : {};
          if (fresh) fetchOptions.cache = 'no-store';
          timeoutTimer = setTimeout(() => {
            try { ctl?.abort(); } catch (e) { /* Abort is best-effort. */ }
            bad(new Error('timeout')); // Also settle if AbortController is unavailable.
          }, ms);
          Promise.resolve().then(() => fetch(requestUrl, fetchOptions))
            .then((r) => r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status)))
            .then(ok, bad);
          return;
        }
      } catch (e) { /* 忽略：fetch 不可用——走最后兜底 */ }
      bad(new Error('no http transport'));
    });
  }

  /* @zhixia:core-http-end */
