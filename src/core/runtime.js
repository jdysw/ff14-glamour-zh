/* @phase15-module-order:core/runtime */
import { resolve } from './data-manager.js';
export { ERR_LOG_CAP, __zhxBootAt, _errLog, _zhxErr, lookupZh, safe };

  'use strict';

  /* @zhixia:core-runtime-start */
  /* ── Core Runtime（v1.4 Phase 4）：脚本注入时刻（运行探测用；未启用时零
       开销）。本模块共 2 处标记区段（段2 = 错误边界 safe，见下文）；Phase 15
       模块化构建时，本区段将原样抽出为 src/core/runtime.js。 */
  // 运行探测（URL 带 zhx_probe 参数时启用）用：脚本注入时刻；未启用时零开销
  let __zhxBootAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  /* @zhixia:core-runtime-end */

  function lookupZh(a, name) {
    const h = (a?.getAttribute('href')) || '';
    const m = h.match(/lodestone\/playguide\/db\/item\/([0-9a-f]+)/i);
    return resolve({ hash: m?.[1], name }, { latinFallback: true });   // hash → 名称 → 外文名兜底（等价原逻辑）
  }

  /* ── 通用工具层（工程做法借鉴 maboloshi/github-chinese）───────────── */

  /* @zhixia:core-runtime-start */
  /* ── Core Runtime（段2/2）：错误边界——包住关键函数，单点出错不拖垮整批
       翻译；Phase 18 起统一经 _zhxErr 记录（降低静默失败；Probe 开启时同时
       保留到 __zhxErrs 供诊断）。Phase 15 随段1 一同抽出为 src/core/runtime.js。 */
  // 错误记录：有界缓冲（常驻、极小）+ console.warn；Probe 开启后同时镜像 __zhxErrs
  const ERR_LOG_CAP = 20;
  const _errLog = [];
  function _zhxErr(where, e) {
    try {
      const msg = String(where || 'safe') + '：' + String((e && (e.message || e)) || 'e').slice(0, 100);
      if (_errLog.length < ERR_LOG_CAP) _errLog.push(msg);
      if (Array.isArray(window.__zhxErrs) && window.__zhxErrs.length < ERR_LOG_CAP) window.__zhxErrs.push(msg);
    } catch (_e) { /* 忽略：记录缓冲失败不影响警告输出 */ }
    try { console.warn((where || 'safe') + '：', e); } catch (_e) { /* 忽略：控制台不可用时静默 */ }
  }
  // 错误边界：包住关键函数，单点出错不拖垮整批翻译
  function safe(fn, tag) {
    return function () {
      try { return fn.apply(this, arguments); }
      catch (e) { _zhxErr(tag || fn.name || 'safe', e); }
    };
  }

  /* @zhixia:core-runtime-end */
