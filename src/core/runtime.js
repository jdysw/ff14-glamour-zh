/* @phase15-module-order:core/runtime */
export { ERR_LOG_CAP, __zhxBootAt, __zhxMark, registerProbeMark, _errLog, _perfNow, _zhxErr, safe };

  /* @zhixia:core-runtime-start */
  /* ── Core Runtime（v1.4 Phase 4）：脚本注入时刻（运行探测用；未启用时零
       开销）。本模块共 2 处标记区段（段2 = 错误边界 safe，见下文）；Phase 15
       模块化构建时，本区段将原样抽出为 src/core/runtime.js。 */
  // 运行探测（URL 带 zhx_probe 参数时启用）用：脚本注入时刻；未启用时零开销
  const __zhxBootAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  // Phase 19：测量用单调时钟（performance 缺失时回退 Date.now；供处理统计与时间线共用）
  function _perfNow() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
  /* @zhixia:core-runtime-end */

  /* ── 通用工具层（工程做法借鉴 maboloshi/github-chinese）───────────── */

  /* @zhixia:core-runtime-start */
  /* ── Core Runtime（段2/2）：错误边界——包住关键函数，单点出错不拖垮整批
       翻译；Phase 18 起统一经 _zhxErr 记录（降低静默失败；Probe 开启时同时
       保留到 __zhxErrs 供诊断）。Phase 15 随段1 一同抽出为 src/core/runtime.js。 */
  // 有界滚动日志保留最新 20 条错误，持续故障不会被早期信息淹没。
  // 镜像诊断数组同样限长，且沿用原数组引用供 Probe 界面查看。
  const ERR_LOG_CAP = 20;
  const _errLog = [];
  function _appendRecentError(list, message) {
    list.push(message);
    if (list.length > ERR_LOG_CAP) list.splice(0, list.length - ERR_LOG_CAP);
  }
  function _zhxErr(where, e) {
    try {
      const msg = String(where || 'safe') + '：' + String((e && (e.message || e)) || 'e').slice(0, 100);
      _appendRecentError(_errLog, msg);
      if (Array.isArray(window.__zhxErrs)) _appendRecentError(window.__zhxErrs, msg);
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
  
  // 数据加载器只调用轻量探测钩子，不需要导入完整诊断面板及 Wiki 逻辑。
  // Probe 模块求值时注册原有记录函数；未启用探测时记录器本身立即返回。
  let _probeMarkHandler = null;
  function registerProbeMark(handler) {
    _probeMarkHandler = typeof handler === 'function' ? handler : null;
  }
  function __zhxMark(name) {
    if (_probeMarkHandler) _probeMarkHandler(name);
  }
