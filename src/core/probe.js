/* @phase15-module-order:core/probe */
/* @phase15-order-link:core/probe<-core/targets */
import './targets.js';
import { ACL_CFC_TEXT, DATA_VER, ITEM_DB_TEXT, SERIES_TEXT, _irStats, ecidMap, itemHash, koByZh, nameMap, resolveKo } from './data-manager.js';
import { _obsStats } from './observer.js';
import { __zhxBootAt, _errLog } from './runtime.js';
import { blockByTitle, getItemId, getItemZhName, getJapaneseName, getSlot, wikiReverseItems } from '../sites/huiji-wiki.js';
export { __zhxMark, __zhxProbeBtnCss, __zhxProbeCopy, __zhxProbeData, __zhxProbeEnv, __zhxProbeFallbackCopy, __zhxProbeFlag, __zhxProbeOn, __zhxProbePanel, __zhxProbeSetup, __zhxProbeText, __zhxProbeToast, __zhxProbeWiki };


  /* @zhixia:core-probe-start */
  /* ── Core Probe（v1.4 Phase 10 独立化）：运行与性能探测——默认关闭、近零
     开销、不写存储、不发网络请求、不影响正常执行路径。读取面：runtime
     timeline（__zhxMarks）/ data stats / observer stats（_obsStats）/
     resolver hit-miss（_irStats）/ Wiki stats。Phase 15 模块化构建时，本区段
     将原样抽出为 src/core/probe.js（或 src/dev/probe.js，由构建系统决定是否
     保留生产能力）。 */
  /* =====================================================================
   * 运行与性能探测（v1.3.1）：URL 附带 zhx_probe 参数（?zhx_probe=1 或
   * #zhx_probe）时启用——页面右下角显示「可复制的诊断报告」（环境 / 时间线 /
   * 数据规模 / wiki 专项），供手机端实测反馈。默认关闭、近零开销；报告仅本地
   * 显示，不写入存储、不发送任何网络请求。
   * ===================================================================== */
  let __zhxProbeFlag = null;   // null=尚未初始化；true/false=探测开关
  const __zhxProbeBtnCss = 'padding:6px 10px;font-size:12px;border:1px solid #8ab4d8;border-radius:8px;background:#eaf4fe;color:#1d5c96;cursor:pointer;';

  function __zhxMark(name) {
    try {
      if (!__zhxProbeFlag) return;
      const m = (window.__zhxMarks = window.__zhxMarks || {});
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      m[name] = Math.round(now - (__zhxBootAt || 0));
    } catch (e) { /* 忽略：探测永不阻断主流程 */ }
  }

  function __zhxProbeOn() {
    try { return /zhx_probe/.test((location.search || '') + (location.hash || '')); } catch (e) { /* 忽略：地址不可读时视为未启用 */ return false; }
  }

  function __zhxProbeEnv(L) {
    L.push('ZHX-PROBE: v1');
    const gi = (typeof GM_info !== 'undefined' && GM_info?.script) || null;
    L.push(
      'ver: ' + ((gi?.version) || 'n/a'),
      'site: ' + location.hostname,
      'url: ' + String(location.href).slice(0, 220),
      'ua: ' + String(navigator.userAgent || '').slice(0, 200),
      'view: ' + window.innerWidth + 'x' + window.innerHeight + ' dpr=' + (window.devicePixelRatio || 1),
      'ts: ' + new Date().toISOString(),
      'ready: ' + document.readyState,
      'gm: get=' + typeof GM_getValue + ' set=' + typeof GM_setValue + ' xhr=' + typeof GM_xmlhttpRequest);
  }

  function __zhxProbeData(L) {
    L.push('marks: ' + JSON.stringify(window.__zhxMarks || {}), 'boot0: ' + Math.round(__zhxBootAt || 0));
    try { L.push('obs: ' + JSON.stringify(_obsStats) + ' resolver: ' + JSON.stringify(_irStats)); } catch (e) { /* 忽略：统计读取失败（可能尚未初始化） */ }
    try {
      L.push('data: items=' + (ITEM_DB_TEXT ? ITEM_DB_TEXT.length : 0)
        + ' series=' + (SERIES_TEXT ? SERIES_TEXT.length : 0)
        + ' acl=' + (ACL_CFC_TEXT ? ACL_CFC_TEXT.length : 0)
        + ' ver=' + (DATA_VER || 'n/a'));
    } catch (e) { /* 忽略：数据规模读取失败（可能尚未就绪） */ }
    try {
      L.push('idx: nameMap=' + (nameMap ? Object.keys(nameMap).length : 0)
        + ' itemHash=' + (itemHash ? Object.keys(itemHash).length : 0)
        + ' ecidMap=' + (ecidMap ? Object.keys(ecidMap).length : 0)
        + ' koByZh=' + (koByZh ? Object.keys(koByZh).length : 0));
    } catch (e) { /* 忽略：索引规模读取失败 */ }
  }

  function __zhxProbeWiki(L) {
    if (location.protocol !== 'file:' && !/huijiwiki\.com/.test(location.hostname)) return;   // file: 供本地夹具测试
    const T = (f) => { try { return f(); } catch (e) { return 'ERR'; /* 忽略：子项读取失败 */ } };
    try {
      const W = {};
      W.done = T(() => document.documentElement.dataset.zhixiaWikiDone || '0');
      W.tries = T(() => window.__zhxWikiTries || 0);
      W.slot = T(() => { const s = getSlot(); return s ? (s.label + '/' + s.key) : 'null'; });
      W.zh = T(() => getItemZhName() || 'null');
      W.jp = T(() => getJapaneseName() || 'null');
      W.id = T(() => getItemId() || 'null');
      W.ko = T(() => { const z = getItemZhName(); const k = z ? resolveKo(z) : null; return k || 'null'; });
      W.blocks = T(() => document.querySelectorAll('.ff14-content-box-block').length);
      W.src = T(() => !!blockByTitle('其他站点链接'));
      W.lang = T(() => !!blockByTitle('各语言名称'));
      W.infobox = T(() => document.querySelectorAll('.infobox, [class*="infobox"]').length);
      W.h1 = T(() => { const h = document.querySelector('#firstHeading'); return h ? String(h.innerText || '').split('\n')[0].slice(0, 40) : 'no-h1'; });
      W.items = T(() => wikiReverseItems().length);
      W.inj = T(() => !!document.querySelector('.zhixia-reverse-block'));
      L.push('wiki: ' + JSON.stringify(W));
    } catch (e) { /* 忽略：wiki 专项收集失败不影响其它诊断 */ }
  }

  function __zhxProbeText() {
    const L = [];
    __zhxProbeEnv(L);
    __zhxProbeData(L);
    __zhxProbeWiki(L);
    try { L.push('errs: ' + JSON.stringify(window.__zhxErrs || [])); } catch (e) { /* 忽略：错误列表读取失败 */ }
    return L.join('\n');
  }

  function __zhxProbePanel(text) {
    let box = document.getElementById('zhx-probe-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'zhx-probe-box';
      box.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:2147483000;width:min(92vw,460px);max-height:74vh;overflow:auto;background:#fff;color:#222;border:1px solid #8ab4d8;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.28);font:12px/1.5 ui-monospace,Consolas,monospace;padding:10px;';
      const head = document.createElement('div');
      head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;';
      const h = document.createElement('b');
      h.textContent = '栀夏 · 运行探测（仅本地显示）';
      head.appendChild(h);
      const bClose = document.createElement('button');
      bClose.textContent = '关闭';
      bClose.style.cssText = __zhxProbeBtnCss;
      bClose.onclick = () => { try { box.remove(); } catch (e) { /* 忽略：面板已移除 */ } };
      head.appendChild(bClose);
      box.appendChild(head);
      const ta = document.createElement('textarea');
      ta.id = 'zhx-probe-text';
      ta.readOnly = true;
      ta.style.cssText = 'width:100%;height:38vh;min-height:180px;box-sizing:border-box;font:11px/1.45 ui-monospace,Consolas,monospace;white-space:pre;color:#222;background:#f7fbff;border:1px solid #cfe2f3;border-radius:8px;padding:8px;';
      box.appendChild(ta);
      const bar = document.createElement('div');
      bar.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
      const bCopy = document.createElement('button');
      bCopy.textContent = '复制报告';
      bCopy.style.cssText = __zhxProbeBtnCss;
      bCopy.onclick = () => { __zhxProbeCopy(ta); };
      const bRef = document.createElement('button');
      bRef.textContent = '刷新报告';
      bRef.style.cssText = __zhxProbeBtnCss;
      bRef.onclick = () => { try { ta.value = __zhxProbeText(); } catch (e) { /* 忽略：刷新失败保留旧报告 */ } };
      bar.appendChild(bCopy);
      bar.appendChild(bRef);
      box.appendChild(bar);
      (document.body || document.documentElement).appendChild(box);
    }
    const ta2 = box.querySelector('#zhx-probe-text');
    if (ta2) ta2.value = text;
  }

  function __zhxProbeCopy(ta) {
    const text = ta.value || '';
    const cb = navigator.clipboard;
    if (typeof cb?.writeText === 'function') {
      cb.writeText(text).then(
        () => __zhxProbeToast('已复制，发送给栀夏即可'),
        () => __zhxProbeFallbackCopy(ta));
      return;
    }
    __zhxProbeFallbackCopy(ta);
  }

  function __zhxProbeFallbackCopy(ta) {
    let ok = false;
    try {
      ta.focus();
      ta.select();
      ok = !!document.execCommand?.('copy');   // NOSONAR —— 老浏览器兜底路径（clipboard 不可用时的最后手段）
    } catch (e) {
      // 忽略：无法自动复制（环境限制）——下方统一提示手动长按
    }
    __zhxProbeToast(ok ? '已复制，发送给栀夏即可' : '请长按选择文本后复制');
  }

  function __zhxProbeToast(msg) {
    try {
      let t = document.getElementById('zhx-probe-toast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'zhx-probe-toast';
        t.style.cssText = 'position:fixed;right:12px;top:12px;z-index:2147483001;background:#1d5c96;color:#fff;font-size:12px;padding:6px 10px;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.3);';
        (document.body || document.documentElement).appendChild(t);
      }
      t.textContent = msg;
      clearTimeout(t.__zhxH || 0);
      t.__zhxH = setTimeout(() => { try { t.remove(); } catch (e) { /* 忽略：已移除 */ } }, 2600);
    } catch (e) { /* 忽略：提示条失败不影响复制 */ }
  }

  function __zhxProbeSetup() {
    __zhxProbeFlag = true;
    try { window.__zhxProbeDump = __zhxProbeText; } catch (e) { /* 忽略：控制台辅助入口注册失败 */ }
    try {
      window.__zhxErrs = window.__zhxErrs || [];
      // Phase 18：把启用前已记录的边界错误转移进诊断列表（保留启动早期失败信息）
      try { for (const m of _errLog) { if (window.__zhxErrs.length < 20) { window.__zhxErrs.push(m); } else { break; } } } catch (e) { /* 忽略：既有日志转移失败 */ }
      window.addEventListener('error', (ev) => {
        try {
          if (window.__zhxErrs.length < 20) {
            window.__zhxErrs.push(String(ev?.message || 'e').slice(0, 120) + ' @L' + (ev?.lineno || 0));
          }
        } catch (e) { /* 忽略：错误采集失败 */ }
      });
    } catch (e) { /* 忽略：错误采集注册失败 */ }
    const show = () => { try { __zhxProbePanel(__zhxProbeText()); } catch (e) { /* 忽略：面板生成失败 */ } };
    if (document.readyState === 'complete') setTimeout(show, 2500);
    else window.addEventListener('load', () => setTimeout(show, 2500), { once: true });
    setTimeout(show, 22000);   // 晚到数据/慢注入的第二轮快照
  }

  // 探测启用判断（必须在任何异步回调前定值；未启用时各 mark 直接短路）
  __zhxProbeFlag = __zhxProbeOn();
  if (__zhxProbeFlag) {
    try { __zhxProbeSetup(); } catch (e) { /* 忽略：探测初始化失败不影响脚本主功能 */ }
  }
  /* @zhixia:core-probe-end */
