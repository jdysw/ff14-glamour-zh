import { EC_FACEWEAR_ROWS, getBardingNatives, getAccessoryNatives, getAllAccessoryNatives } from '../core/search-equipment-categories.js';
import { normalizeSearchQuery, isChineseSearchQuery } from '../core/chinese-search-submit.js';

// 只有装备库列表页的查询可以按“套装系列 + 职能”映射。其它 EC 页面
// （如 /glamours、装备部位 vue-select）继续使用单件装备索引。
function isECGearsetsPage() {
  const loc = globalThis.location;
  // 除 /gearsets 外，职业子目录（如 /gearsets/casters）同样是可检索的套装列表。
  return /^\/gearsets(?:\/[a-z-]+)?\/?$/i.test(loc?.pathname || '')
    && /(^|\.)eorzeacollection\.com$/i.test(loc?.hostname || '');
}

const ownsKeyboard = input => /\bvs__search\b/.test(String(input?.className || ''));

function ecSlotFromHint(hint) {
  const patterns = [
    /\b(?:head|headpiece|headwear|headgear|helmet)\b|头部|头饰|头盔/iu,
    /\b(?:body|bodypiece|chest|chestpiece)\b|身体|躯干|上衣/iu,
    /\b(?:hands?|handpiece|gloves?)\b|手部|手套/iu,
    /\b(?:legs?|legpiece|pants|trousers)\b|腿部|裤子/iu,
    /\b(?:feet|foot|footpiece|boots?|shoes?)\b|脚部|足部|靴子/iu,
  ];
  const matches = patterns.flatMap((pattern, index) => pattern.test(hint) ? [index] : []);
  return matches.length === 1 ? matches[0] : null;
}

// Accessory selectors share the same EC Vue input component but use four
// distinct official EquipSlotCategory IDs, not the five armor slot groups.
function ecAccessorySlotFromHint(hint) {
  const patterns = [
    ['ears', /\b(?:ears?|earrings?|earpieces?)\b|耳饰|耳环|耳部/iu],
    ['neck', /\b(?:necks?|necklaces?|neckpieces?|chokers?)\b|项链|项圈|颈部/iu],
    ['wrists', /\b(?:wrists?|bracelets?|bangles?|wristpieces?)\b|腕部|手镯|腕饰/iu],
    ['rings', /\b(?:rings?|fingers?|fingerpieces?)\b|戒指|指环|手指/iu],
  ];
  const matches = patterns.filter(([, pattern]) => pattern.test(hint));
  return matches.length === 1 ? matches[0][0] : null;
}

function ecSlotFromInput(input, resolveHint = ecSlotFromHint) {
  const hint = [
    input?.getAttribute?.('placeholder'),
    input?.getAttribute?.('aria-label'),
    input?.getAttribute?.('data-slot'),
    input?.getAttribute?.('name'),
    input?.closest?.('[data-slot]')?.getAttribute?.('data-slot'),
  ].filter(Boolean).join(' ');
  const explicit = resolveHint(hint);
  if (explicit !== null) return explicit;
  // EC occasionally supplies only a generic placeholder. Read the nearest
  // compact field label, never a full form containing multiple slot names.
  let node = input?.parentElement;
  for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
    const label = String(node.textContent || '').trim();
    if (label.length > 0 && label.length < 50) {
      const slot = resolveHint(label);
      if (slot !== null) return slot;
    }
  }
  return null;
}

// EC intelligent inputs are scoped by page purpose or explicit equipment slot.
// The specialty lists come from official ItemAction and Glasses game data.
function ecSearchContext(input) {
  const loc = globalThis.location;
  if (!/(^|\.)eorzeacollection\.com$/i.test(loc?.hostname || '')) return null;
  const path = loc?.pathname || '';
  if (/^\/companion-glamours(?:\/|$)/i.test(path)) return { kind: 'barding' };
  if (/^\/facewear(?:\/|$)/i.test(path)) return { kind: 'facewear' };
  // Gearsets free-text search is intentionally separate from equipment filtering.
  // The /accessories catalogue also has free-text inputs without a slot label:
  // those must use the union of official jewelry slots, never all gear.
  const accessoryPage = /^\/accessories(?:\/|$)/i.test(path);
  if (!/\bvs__search\b/.test(String(input?.className || ''))) {
    return accessoryPage ? { kind: 'accessories' } : null;
  }
  const slot = ecSlotFromInput(input);
  if (slot !== null) return { kind: 'slot', slot };
  const accessory = ecSlotFromInput(input, ecAccessorySlotFromHint);
  if (accessory !== null) return { kind: 'accessory-slot', slot: accessory };
  return accessoryPage ? { kind: 'accessories' } : null;
}

function ecGearsetsSearchUrl(native, href) {
  if (!native) return null;
  try {
    const url = new URL(href);
    url.searchParams.set('search', native);
    url.searchParams.delete('page'); // 换关键词后必须回到第一页，否则会误报无结果。
    return url.toString();
  } catch { return null; }
}

export function createECSearchStrategy(resolveCatalog, suggestCatalog) {
  // Vue 的动态表单不会保证在 input 事件时同步读取被临时改写的值；因此只在明确提交时用站点原生 URL 查询。
  // 仅识别 Gearsets 主搜索框，不接管筛选部位、职业或其他页面的输入框。
  function isECGearsetsSearchInput(input) {
    if (!isECGearsetsPage() || String(input?.tagName || '').toUpperCase() !== 'INPUT'
        || input.disabled || input.readOnly) return false;
    if (/vs__search/.test(String(input.className || ''))) return false;
    const meta = [input.getAttribute?.('name'), input.getAttribute?.('id'),
      input.getAttribute?.('placeholder'), input.getAttribute?.('aria-label')]
      .filter(Boolean).join(' ');
    if (/search by (title|player)|author|username|creator|filter by|作者|玩家|标题|標題/i.test(meta)) return false;
    // translateECAttrs 会将 "Search..." 翻译为 "搜索…"，识别不能只依赖英文占位符。
    return /\b(search|keyword)\b/i.test(meta) || /搜索|搜尋|检索|檢索/.test(meta);
  }

  function submitECGearsetsSearch(input, selectedNative = null) {
    if (!isECGearsetsSearchInput(input)) return false;
    const query = normalizeSearchQuery(input.value);
    if (!isChineseSearchQuery(query)) return false;
    const native = selectedNative || resolveCatalog(query);
    if (!native) return false; // 多个不相关套装不猜测英文词，继续由候选明确选择。
    const url = ecGearsetsSearchUrl(native, globalThis.location?.href);
    if (!url || typeof globalThis.location?.assign !== 'function') return false;
    globalThis.location.assign(url);
    return true;
  }
  function suggestScoped(query, input, language, suggestByZh) {
    const context = ecSearchContext(input);
    if (context?.kind === 'facewear') {
      const terms = query.split(/\s+/u);
      const direct = EC_FACEWEAR_ROWS.filter(row => row.zh.includes(query));
      return terms.length < 2 ? direct : direct.concat(EC_FACEWEAR_ROWS.filter(row =>
        !row.zh.includes(query) && terms.every(term => row.zh.includes(term))));
    }
    if (context?.kind === 'barding') return suggestByZh(query, 0, getBardingNatives());
    if (context?.kind === 'slot') return suggestByZh(query, 0, context.slot, language);
    if (context?.kind === 'accessory-slot') {
      return suggestByZh(query, 0, getAccessoryNatives(context.slot));
    }
    if (context?.kind === 'accessories') return suggestByZh(query, 0, getAllAccessoryNatives());
    return isECGearsetsPage() && !ownsKeyboard(input)
      ? suggestCatalog(query) : undefined;
  }

  return {
    ownsKeyboard,
    context: ecSearchContext,
    suggestScoped,
    isCatalogPage: isECGearsetsPage,
    isCatalogInput: isECGearsetsSearchInput,
    resolveCatalog,
    suggestCatalog,
    submit: submitECGearsetsSearch,
    nativeOptions: {
      rootFor: input => input.closest?.('.v-select'),
      selector: '.vs__dropdown-option',
      controlFor: option => option,
    },
  };
}
