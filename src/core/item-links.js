/* @phase15-module-order:core/item-links */
import { WIKI_ITEM } from './constants.js';
export { bindZhxItemClick, ensureZhxItemStyle };

  function ensureZhxItemStyle(id) {
    if (document.getElementById(id)) return;
    const st = document.createElement('style');
    st.id = id;
    st.textContent = '[data-zhx-item]{cursor:pointer;transition:text-decoration-color .15s}[data-zhx-item]:hover{text-decoration:underline;text-underline-offset:3px}';
    (document.head || document.documentElement).appendChild(st);
  }

  function bindZhxItemClick(flag) {
    if (window[flag]) return;
    window[flag] = true;
    document.addEventListener('click', (e) => {
      const el = e.target?.closest?.('[data-zhx-item]') ?? null;
      if (!el) return;
      // Item names can be nested inside interactive controls, but a filter
      // button nested inside an item-marked card is NOT an item-name click.
      // Never steal reset/apply/clear or other native React control actions.
      const control = e.target?.closest?.(
        'button, input, select, textarea, a[href], [role="button"], ' +
        '[role="checkbox"], [role="switch"], [role="combobox"]'
      );
      if (control && control !== el && !control.contains(el)) return;
      const zh = el.dataset.zhxItem;
      if (!zh) return;
      e.preventDefault();
      e.stopPropagation();
      window.open(WIKI_ITEM + encodeURIComponent(zh), '_blank', 'noopener');
    }, true);
  }
