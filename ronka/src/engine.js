// Ronka Lookbook 汉化引擎（核心翻译逻辑）
// 由 build.py 注入：__UI__ __ITEMS__ __STAINS__ __UI_LONG__
/* global __UI__, __ITEMS__, __STAINS__, __UI_LONG__ */

(function () {
  'use strict';

  var MARK = '__zhx_done__';
  var KR = /[\uac00-\ud7a3]/;
  var count = 0;

  // ============ 纯翻译函数 ============
  function translate(t) {
    if (!t) return null;
    var hasKR = KR.test(t);
    // 英文短语（导航等）：仅查 UI 表
    if (!hasKR) {
      if (__UI__[t]) return __UI__[t];
      return null;
    }
    // 1) UI 精确
    if (__UI__[t]) return __UI__[t];
    // 2) 长文精确
    if (__UI_LONG__ && __UI_LONG__[t]) return __UI_LONG__[t];
    // 3) 染剂格式： "1-하얀눈색"
    var m = t.match(/^([1-9])-(.+)$/);
    if (m) {
      var s = __STAINS__[m[2].trim()];
      if (s) return m[1] + '-' + s;
    }
    // 4) 装备名精确
    if (__ITEMS__[t]) return __ITEMS__[t];
    // 4.6) 纯染剂名兜底（React 拆分布局："1-" 与 "하얀눈색" 为两个节点）
    if (__STAINS__[t]) return __STAINS__[t];
    // 3.5) "X아이콘" 组合（alt 属性常见）
    if (t.length > 3 && t.slice(-3) === '아이콘') {
      var base = translate(t.slice(0, -3).trim());
      if (base) return base + '图标';
    }
    // 3.6) 补丁版本前缀
    if (t.indexOf('현재 적용된 패치 데이터 버전') === 0) {
      return t.replace('현재 적용된 패치 데이터 버전(KOR): ', '当前应用的补丁数据版本(KOR): ');
    }
    // 4.5) 空白归一化后重试（防 DOM 断行/多空格差异）
    var norm = t.replace(/\s+/g, ' ');
    if (norm !== t) {
      if (__UI__[norm]) return __UI__[norm];
      if (__UI_LONG__ && __UI_LONG__[norm]) return __UI_LONG__[norm];
      if (__ITEMS__[norm]) return __ITEMS__[norm];
    }
    return null;
  }

  // ============ DOM 应用 ============
  function tx(node) {
    if (node[MARK]) return;
    var raw = node.nodeValue;
    if (!raw) return;
    var t = raw.trim();
    if (!t) { node[MARK] = 1; return; }
    var tr = translate(t);
    if (tr !== null) {
      node.nodeValue = raw.replace(t, tr);
      count++;
    }
    node[MARK] = 1;
  }

  function txAttr(el, attr) {
    var v = el.getAttribute && el.getAttribute(attr);
    if (!v || !KR.test(v)) return;
    var tr = translate(v.trim());
    if (tr !== null) {
      el.setAttribute(attr, v.replace(v.trim(), tr));
      count++;
    }
  }

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };

  function scan(root) {
    if (!root) return;
    // 文本节点
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        if (!p || SKIP_TAGS[p.tagName]) return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest('.zhx-skip')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    for (var i = 0; i < nodes.length; i++) tx(nodes[i]);

    // 属性
    var els = root.querySelectorAll ? root.querySelectorAll('input[placeholder], textarea[placeholder], img[alt], [title], [aria-label]') : [];
    for (var j = 0; j < els.length; j++) {
      txAttr(els[j], 'placeholder');
      txAttr(els[j], 'title');
      txAttr(els[j], 'aria-label');
    }

    // 页面标题
    var tt = document.title;
    if (tt && KR.test(tt)) {
      var tz = translate(tt.trim());
      if (tz) { document.title = tz; count++; }
    }
  }

  // ============ 观察动态内容 ============
  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      scan(document.body);
    }, 120);
  }

  function boot() {
    scan(document.body);
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'childList' && m.addedNodes.length) return schedule();
        if (m.type === 'characterData') {
          // 被 React 覆盖回韩文时才重译（translate 内含韩文检测，天然收敛）
          var v = m.target.nodeValue;
          if (v && KR.test(v)) { m.target[MARK] = 0; return schedule(); }
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

    // 定时兜底（应对某些缓存渲染路径）
    setInterval(function () {
      if (count === 0) return;
      scan(document.body);
    }, 5000);
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);

  // 暴露调试
  window.__ZHX_RONKA__ = { translate: translate, scan: scan, count: function () { return count; } };
})();
