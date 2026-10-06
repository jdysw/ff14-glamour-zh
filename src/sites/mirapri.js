/* @phase15-module-order:sites/mirapri */
/* @phase15-order-link:sites/mirapri<-core/dom */
import '../core/dom.js';
import { DICT } from '../core/dictionary.js';
import { _zhixiaTitleKeep } from '../core/dom.js';
import { observeLocal } from '../core/observer.js';
import { safe } from '../core/runtime.js';
export { PATTERNS, SKIP_TAGS, busy, startMirapri, tr, trEl, trNode, translatePage };


  // 部分匹配（长句、带变量文本、placeholder）
  const PATTERNS = [
    [/ユーザーの皆さまにMIRAPRI SNAPを快適にご利用いただくため、/g, '为了让各位用户更舒适地使用 MIRAPRI SNAP，'],
    [/」をご一読いただき、お守りいただきますよう、ご協力をお願いいたします。/g, '」，并请遵守其中的规定。'],
    [/装備品名等を入力/g, '输入装备名等'],
    [/少ない文字で検索するとちょっと時間がかかります/g, '输入较短时检索会稍慢'],
    [/記載されている会社名・製品名・システム名などは、各社の商標、または登録商標です。?/g,
      '文中记载的公司名、产品名、系统名等，均为各公司之商标或注册商标。'],
    [/全身を切り取る/g, '裁切全身'],
    [/Loading\.\.\./g, '加载中…'],
    [/^\s*＊\s*/, '＊'],
  ];

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);
  let busy = false;

  function tr(text) {
    if (!text) return text;
    const t = text.trim();
    if (!t) return text;
    if (DICT[t]) {
      const i = text.indexOf(t);
      return text.slice(0, i) + DICT[t] + text.slice(i + t.length);
    }
    let out = text;
    for (const [re, to] of PATTERNS) out = out.replace(re, to);
    return out;
  }

  function trNode(node) {
    const raw = node.nodeValue;
    if (!raw?.trim() || raw.trim().length > 200) return;
    const next = tr(raw);
    if (next !== raw) {
      const p = node.parentElement;
      if (p && !p.title) { p.title = raw.trim(); _zhixiaTitleKeep.add(p); }
      node.nodeValue = next;
    }
  }

  function trEl(el) {
    const ph = el.getAttribute('placeholder');
    if (ph) { const n = tr(ph); if (n !== ph) el.setAttribute('placeholder', n); }
    const val = el.getAttribute('value');
    if (val) { const n = tr(val); if (n !== val) el.setAttribute('value', n); }
  }

  function translatePage(rootArg) {
    if (busy) return;
    busy = true;
    const isFull = !rootArg;
    try {
      const root = rootArg || document.body || document.documentElement;
      if (!root) return;
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode: (n) => {
          if (n.nodeType === 1 && SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const batch = [];
      while (w.nextNode()) batch.push(w.currentNode);
      for (const n of batch) {
        if (n.nodeType === 3) trNode(n);
        else if (n.tagName === 'INPUT') trEl(n);
      }
      if (isFull && document.title) {
        document.title = document.title
          .replace('FF14ミラプリSS投稿・共有サイト', 'FF14 幻化截图投稿 · 分享站')
          .replace('ミラプリを投稿', '发布幻化')
          .replace('このサイトについて', '关于本站')
          .replace('ガイドライン', '指南')
          .replace('お問い合わせ', '联系我们');
      }
    } finally {
      busy = false;
    }
  }

  function startMirapri() {
    safe(translatePage, 'mirapri 全扫')();
    // 局部：只翻译新增子树（祖先去重后逐个处理）
    observeLocal((nodes) => {
      for (const n of nodes) safe(translatePage, 'mirapri 局部')(n);
    }, 300);
    document.addEventListener('turbo:load', safe(translatePage, 'turbo'), false);
    document.addEventListener('pjax:end', safe(translatePage, 'pjax'), false);
  }
