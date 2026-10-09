// Browser-executed read-only collector. Shared by CDP, Playwright cloud and userscript.
// No telemetry, storage, network calls, or mutation.
export const COLLECTOR_JS = String.raw`(() => {
  const out = [];
  const seen = new Set();
  const BAD = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'SVG']);
  function pathFor(el) {
    const parts = [];
    for (let p = el; p && p.nodeType === 1 && p !== document.documentElement && parts.length < 10; p = p.parentElement) {
      let part = p.tagName.toLowerCase();
      if (p.id && !p.id.startsWith('zhx-')) { part += '#' + p.id; parts.unshift(part); break; }
      let nth = 1;
      for (let sib = p.previousElementSibling; sib; sib = sib.previousElementSibling)
        if (sib.tagName === p.tagName) nth++;
      part += ':nth-of-type(' + nth + ')';
      parts.unshift(part);
    }
    return parts.join(' > ');
  }
  function visible(el) {
    if (!el || !el.isConnected || el.closest('[hidden],[aria-hidden="true"]')) return false;
    let p = el;
    while (p && p.nodeType === 1) {
      const c = getComputedStyle(p);
      if (c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) === 0) return false;
      p = p.parentElement;
    }
    return el.getClientRects().length > 0 || el.tagName === 'OPTION';
  }
  function skipped(el) {
    if (!el || el.closest('script,style,noscript,template,iframe,svg,[contenteditable="true"]')) return true;
    for (let p = el; p && p !== document.documentElement; p = p.parentElement)
      if (p.id?.startsWith('zhx-') || /(^|\s)zhx-/.test(String(p.className || '')) || p.hasAttribute('data-zhx-done')) return true;
    return false;
  }
  function context(el, kind) {
    const cls = String(el.className || '') + ' ' + String(el.parentElement?.className || '');
    const id = String(el.id || '');
    let ancestors = '';
    for (let p = el.parentElement, n = 0; p && n < 4; p = p.parentElement, n++)
      ancestors += ' ' + String(p.className || '') + ' ' + String(p.id || '');
    const full = cls + ' ' + id + ' ' + ancestors;
    const ad = /(adsbygoogle|ad-slot|adunit|ad-container|sponsor|aswift|amazon|rakuten|affiliate)/i.test(full);
    const authoredContext = /(glamour.*(author|title|description)|post[-_](title|author|content)|comment[-_](text|body)|nickname|username|player-name|user-content|(?:^|[\s_-])(?:created[-_]at|posted[-_]at|relative[-_]time|timestamp)(?=$|[\s_-]))/i.test(full);
    const link = el.closest('a[href]');
    const linkCls = String(link?.className || '');
    const actionLink = !!link && (
      /(?:^|[\s_-])(?:button|btn|load-more|show-more|read-more|page-numbers|next|prev)(?:$|[\s_-])/i.test(linkCls)
      || !!link.closest('.pagination,.pager,[class*="pagination"],[class*="pager"]')
      || /^(?:show results|load more|show more|see more|read more|view more|search|filter|next|previous|reset|apply)$/i.test((link.textContent || '').trim())
    );
    const control = actionLink || /^(BUTTON|INPUT|SELECT|TEXTAREA|OPTION|SUMMARY)$/.test(el.tagName)
      || !!el.closest('button,[role="button"],[role="tab"],[role="switch"],[role="checkbox"]');
    const user = authoredContext && !control;
    const ui = control || /^(LABEL|H1|H2|H3|H4|TH|NAV)$/.test(el.tagName)
      || !!el.closest('nav,header,footer,form,[role="navigation"],[role="menu"],[role="tablist"],[role="dialog"]')
      || kind.startsWith('attr:') || kind === 'option';
    return {
      tag: el.tagName.toLowerCase(), cls, id, ancestors, ad, user, ui, control,
      role: el.getAttribute('role') || '',
      name: el.getAttribute('name') || '',
      href: el.getAttribute('href') || '',
      parentText: (el.parentElement?.textContent || '').trim().slice(0, 140),
    };
  }
  function push(el, value, kind) {
    if (!visible(el) || skipped(el)) return;
    const t = String(value || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 500) return;
    const path = pathFor(el);
    const key = path + '\u0000' + kind + '\u0000' + t;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, text: t, path, ctx: context(el, kind) });
  }
  if (!document.body) return [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p || BAD.has(p.tagName) || skipped(p) || !visible(p)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n; (n = walker.nextNode());) push(n.parentElement, n.nodeValue, 'text');
  for (const el of document.querySelectorAll('[placeholder],[title],[aria-label],[alt],[value],option')) {
    if (el.tagName === 'OPTION') push(el, el.textContent, 'option');
    for (const a of ['placeholder','title','aria-label','alt']) if (el.hasAttribute(a)) push(el, el.getAttribute(a), 'attr:' + a);
    if (/^(INPUT|BUTTON)$/.test(el.tagName) && /^(button|submit|reset)$/i.test(el.getAttribute('type') || '')) push(el, el.value, 'attr:value');
  }
  if (document.title) out.push({ kind: 'document:title', text: document.title, path: 'head > title', ctx: { tag: 'title', cls: '', id: '', ui: false, user: false, ad: false } });
  return out;
})()`;

export const LINKS_JS = String.raw`(() => Array.from(document.querySelectorAll('a[href]'), a => a.href).filter(Boolean).slice(0, 5000))()`;

// The data-manager calls __zhxMark('ready') only after table building and
// onTablesReady callbacks finish. The audit enables the existing diagnostic
// marker before injection; it never changes normal userscript behavior.
export const AUDIT_READY_JS = String.raw`(() => Object.prototype.hasOwnProperty.call(window.__zhxMarks || {}, 'ready'))()`;
