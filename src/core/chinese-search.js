/* @phase23-module-order:core/chinese-search */
/* @phase23-order-link:core/chinese-search<-core/data-manager */
import { onTablesReady, resolveByZh, resolvePartialByZh, suggestByZh } from './data-manager.js';
import { resolveECGearsetSearch, suggestECGearsetsByZh } from '../sites/eorzea-collection.js';

// 站点能力表：统一交互由 Core 调度；form 与 SPA 输入的提交路径各用原站行为。
const SEARCH_SITES = Object.freeze({
  mirapri: { vueSelect: false },
  fc: { vueSelect: false },
  ronka: { vueSelect: false },
  collection: { vueSelect: false },
  ec: { vueSelect: true },
  endcloset: { vueSelect: false },
});
let _activeSearchSiteId = null;

// BEGIN GENERATED EC SEARCH CATEGORIES — tools/update-ec-search-categories.py
// EC specialty candidates are game-data classifications, never fuzzy name guesses.
// Bird bardings: en/Item.csv -> ItemAction.csv Action=1013 (includes Shaffron/Harness).
// Facewear: en/Glasses.csv Style unique -> CN/Glasses.csv same record ID.
// Facewear is an independent game sheet, NOT a subset of helmet equipment.
const EC_BARDING_NATIVES = new Set(["Abigail Barding","Abyssal Barding","Ala Mhigan Barding","Allagan Barding","Angelic Barding","Authentic Egg Barding","Authentic Paramour Barding","Authentic Starlight Barding","Barding of Divine Light","Barding of Eternal Darkness","Barding of Light","Barding of Naught","Barding of the Dead","Behemoth Barding","Black Mage Barding","Blissful Barding","Bluefeather Barding","Bozjan Barding","Butlery Barding","Byakko Barding","Chocobo Raincoat","Cosmic Barding","Dancer Barding","Deepshadow Barding","Demonic Barding","Diamond Barding","Eerie Barding","Egg Harness","Egg Hunter Barding","Electrope Barding","Emerald Barding","Eternal Barding","Expanse Barding","Far Eastern Barding","Felicitous Barding","Flamecloaked Barding","Flyer Shaffron","Gambler Barding","Gridanian Barding","Gridanian Crested Barding","Gridanian Half Barding","Hades Barding","Highland Barding","Hingan Barding","Hive Barding","Horde Barding","Ice Barding","Innocence Barding","Ishgardian Barding","Ishgardian Half Barding","Isle Pioneer's Barding","Ixion Barding","Levin Barding","Lominsan Barding","Lominsan Crested Barding","Lominsan Half Barding","Lunar Barding","Machinist Barding","Mandervillian Barding","Nezha Barding","Noble Barding","Oriental Barding","Orthodox Barding","Paramour Barding","Picnicker's Barding","Pilgrim's Barding","Plumed Barding","Postmoogle Barding","Queen's Guard Barding","Queen's Knight Barding","Race Barding","Red Mage Barding","Reveler's Barding","Round Table Barding","Ruby Barding","Runaway Barding","Saintly Barding","Samurai Barding","Seiryu Barding","Sephirotic Barding","Shinryu Barding","Skyruin Barding","Sleipnir Barding","Sophic Barding","Sovereign Barding","Starlight Barding","Starlight Stalls Barding","Suzaku Barding","Thavnairian Barding","Tidal Barding","Titania Barding","True Barding of Light","Turali Barding","Ul'dahn Barding","Ul'dahn Crested Barding","Ul'dahn Half Barding","Voidcast Barding","Wayfarer's Barding","Wild Ride Barding","Wild Rose Barding","Windswept Barding","Wolf Barding","Yojimbo Barding","Zurvanite Barding"]);
const EC_FACEWEAR_ROWS = Object.freeze([{"native":"Antique Monocle","zh":"古董单眼镜"},{"native":"Blindfold Eyepatch (Left)","zh":"左侧折布眼罩"},{"native":"Blindfold Eyepatch (Right)","zh":"右侧折布眼罩"},{"native":"Blooming Eyeglasses","zh":"彩花装饰眼镜"},{"native":"Bold-rimmed Glasses","zh":"厚框眼镜"},{"native":"Brass Goggles","zh":"黄铜护目镜"},{"native":"Cat Eye Glasses","zh":"猫眼眼镜"},{"native":"Cat Eye Reading Glasses","zh":"猫眼读书眼镜"},{"native":"Chicken Eyeglasses","zh":"彩蛋小鸡眼镜"},{"native":"Classic Spectacles","zh":"经典眼镜"},{"native":"Coeurl Eyeglasses","zh":"豹目眼镜"},{"native":"Comfortable Eye Mask","zh":"纯色眼罩"},{"native":"Contemporary Pince-nez","zh":"现代鼻眼镜"},{"native":"Dark Glasses","zh":"黑色墨镜"},{"native":"Elegant Rimless Glasses","zh":"典雅无框眼镜"},{"native":"Eyepatch (Left)","zh":"左侧眼罩"},{"native":"Eyepatch (Right)","zh":"右侧眼罩"},{"native":"Groovy Glasses","zh":"时髦眼镜"},{"native":"Half-rim Spectacles","zh":"半框眼镜"},{"native":"Holospecs","zh":"全息眼镜"},{"native":"Holovisor","zh":"全息护目镜"},{"native":"Magnifiers","zh":"作业眼镜"},{"native":"Metallic Eyepatch (Left)","zh":"左侧金属眼罩"},{"native":"Metallic Eyepatch (Right)","zh":"右侧金属眼罩"},{"native":"Minstrel's Spectacles","zh":"艺术眼镜"},{"native":"Monocle","zh":"单眼镜"},{"native":"Mythril-edged Eyepatch (Left)","zh":"左侧秘银镶边眼罩"},{"native":"Mythril-edged Eyepatch (Right)","zh":"右侧秘银镶边眼罩"},{"native":"Ornamented Leather Eyepatch (Left)","zh":"左侧皮饰眼罩"},{"native":"Ornamented Leather Eyepatch (Right)","zh":"右侧皮饰眼罩"},{"native":"Oval Reading Glasses","zh":"椭圆读书眼镜"},{"native":"Oval Spectacles","zh":"椭圆眼镜"},{"native":"Painted Eggy Eyeglasses","zh":"装饰彩蛋眼镜"},{"native":"Party Eggy Eyeglasses","zh":"四颗彩蛋眼镜"},{"native":"Petite Pince-nez","zh":"小夹鼻眼镜"},{"native":"Pince-nez","zh":"鼻眼镜"},{"native":"Professorial Glasses","zh":"教授眼镜"},{"native":"Reading Glasses","zh":"阅读眼镜"},{"native":"Rectangular Glasses","zh":"渐变色镜框眼镜"},{"native":"Rimless Glasses","zh":"无框眼镜"},{"native":"Rose-colored Spectacles","zh":"玫瑰色眼镜"},{"native":"Sash Blinder (Left)","zh":"左侧皮带眼罩"},{"native":"Sash Blinder (Right)","zh":"右侧皮带眼罩"},{"native":"Scaevan Headgear","zh":"斯卡艾瓦头甲"},{"native":"Shaded Spectacles","zh":"金边墨镜"},{"native":"Shaded Visor","zh":"遮光面罩"},{"native":"Simple Oval Spectacles","zh":"基础款椭圆眼镜"},{"native":"Simple Spectacles","zh":"基础款眼镜"},{"native":"Slim Frame Eggy Eyeglasses","zh":"窄框彩蛋眼镜"},{"native":"Slim Frame Glasses","zh":"窄框眼镜"},{"native":"Spriggan Eyeglasses","zh":"魔石精眼镜"},{"native":"Studded Eyepatch (Left)","zh":"左侧钉扣眼罩"},{"native":"Studded Eyepatch (Right)","zh":"右侧钉扣眼罩"},{"native":"Tactical Goggles","zh":"战术护目镜"},{"native":"Teardrop Glasses","zh":"泪滴形眼镜"},{"native":"Thick-rimmed Glasses","zh":"粗框眼镜"},{"native":"Thick-rimmed Goggles","zh":"厚框护目镜"},{"native":"Tinted Goggles","zh":"彩色护目镜"},{"native":"Tinted Sunglasses","zh":"淡色眼镜"},{"native":"Under-rim Glasses","zh":"下框眼镜"},{"native":"Wrap-around Sunglasses","zh":"罩眼式墨镜"}]);
// END GENERATED EC SEARCH CATEGORIES


const SEARCH_EXCLUDE_RE = /author|player|title|comment|tag|username|email|password|作者|标题|标签|用户/i;
const SEARCH_INPUT_TYPES = new Set(['', 'text', 'search']);
const _searchInputCache = new WeakMap();

function normalizeSearchQuery(value) {
  return String(value ?? '').trim().replace(/[ \t\u00a0]+/g, ' ');
}

// 只有装备库列表页的查询可以按“套装系列 + 职能”映射。其它 EC 页面
// （如 /glamours、装备部位 vue-select）继续使用单件装备索引。
function isECGearsetsPage() {
  const loc = globalThis.location;
  // 除 /gearsets 外，职业子目录（如 /gearsets/casters）同样是可检索的套装列表。
  return /^\/gearsets(?:\/[a-z-]+)?\/?$/i.test(loc?.pathname || '')
    && /(^|\.)eorzeacollection\.com$/i.test(loc?.hostname || '');
}

// EC intelligent inputs are scoped by page purpose or explicit equipment slot.
// The specialty lists come from official ItemAction and Glasses game data.
function ecSearchContext(input) {
  const loc = globalThis.location;
  if (!/(^|\.)eorzeacollection\.com$/i.test(loc?.hostname || '')) return null;
  const path = loc?.pathname || '';
  if (/^\/companion-glamours(?:\/|$)/i.test(path)) return { kind: 'barding' };
  if (/^\/facewear(?:\/|$)/i.test(path)) return { kind: 'facewear' };
  // Slot-scoped Vue selects, not the free-text Gearsets search box.
  if (!/\bvs__search\b/.test(String(input?.className || ''))) return null;
  const hint = [
    input?.getAttribute?.('placeholder'),
    input?.getAttribute?.('aria-label'),
    input?.getAttribute?.('data-slot'),
    input?.getAttribute?.('name'),
    input?.closest?.('[data-slot]')?.getAttribute?.('data-slot'),
  ].filter(Boolean).join(' ');
  const slots = [
    /\b(?:head|headwear|headgear|helmet)\b/i,
    /\b(?:body|chest|chestpiece)\b/i,
    /\b(?:hands?|gloves?)\b/i,
    /\b(?:legs?|pants|trousers)\b/i,
    /\b(?:feet|foot|boots?|shoes?)\b/i,
  ];
  const slot = slots.findIndex(pattern => pattern.test(hint));
  return slot < 0 ? null : { kind: 'slot', slot };
}

function ecScopedSuggestions(query, input) {
  const context = ecSearchContext(input);
  if (context?.kind === 'facewear') return EC_FACEWEAR_ROWS.filter(row => row.zh.includes(query));
  if (context?.kind === 'barding') return suggestByZh(query, 0, EC_BARDING_NATIVES);
  if (context?.kind === 'slot') return suggestByZh(query, 0, context.slot);
  return isECGearsetsPage() && !/\bvs__search\b/.test(String(input?.className || ''))
    ? suggestECGearsetsByZh(query) : suggestByZh(query);
}

// Only an exact or a single unambiguous in-category name can be converted
// without choosing the explicit suggestion.
function ecScopedNative(query, input, allowPartial) {
  const rows = ecScopedSuggestions(query, input);
  const exact = rows.filter(row => row.zh === query);
  if (exact.length === 1) return exact[0].native;
  return allowPartial && rows.length === 1 ? rows[0].native : null;
}

function resolveSearchNative(query, gearsets = false) {
  if (gearsets) {
    const gearset = resolveECGearsetSearch(query);
    if (gearset) return gearset;
    // 多个套装命中却没有安全的英文公共词时，交给候选列表选择；
    // 不能回退到无关的单件物品索引，随意改写用户的套装查询。
    if (suggestECGearsetsByZh(query).length > 0) return null;
  }
  return resolveByZh(query) || resolvePartialByZh(query);
}

function isChineseSearchQuery(value) {
  const q = normalizeSearchQuery(value);
  return q.length > 0 && /[\u3400-\u9fff]/u.test(q);
}

// EC /gearsets 的检索由站点 GET 参数 search 驱动。Vue/动态过滤器不保证在
// input 事件时同步读取被临时改写的值；因此只在明确提交时用站点原生 URL 查询。
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

function ecGearsetsSearchUrl(native, href) {
  if (!native) return null;
  try {
    const url = new URL(href);
    url.searchParams.set('search', native);
    url.searchParams.delete('page'); // 换关键词后必须回到第一页，否则会误报无结果。
    return url.toString();
  } catch { return null; }
}

function submitECGearsetsSearch(input, selectedNative = null) {
  if (!isECGearsetsSearchInput(input)) return false;
  const query = normalizeSearchQuery(input.value);
  if (!isChineseSearchQuery(query)) return false;
  const native = selectedNative || resolveECGearsetSearch(query);
  if (!native) return false; // 多个不相关套装不猜测英文词，继续由候选明确选择。
  const url = ecGearsetsSearchUrl(native, globalThis.location?.href);
  if (!url || typeof globalThis.location?.assign !== 'function') return false;
  globalThis.location.assign(url);
  return true;
}

function searchInputScore(input) {
  if (!input) return -Infinity;
  const type = String(input.getAttribute?.('type') || '').toLowerCase();
  if (!SEARCH_INPUT_TYPES.has(type) || input.disabled || input.readOnly) return -Infinity;
  // 1.4.2 后续修复：vue-select 搜索框（EC 部位筛选器）不是表单搜索框——
  // 其值不参与表单序列化，输入即触发站点检索；完全排除，交给独立搜索框路径处理。
  if (/vs__search/.test(String(input.className || ''))) return -Infinity;
  const meta = [
    input.getAttribute?.('name'),
    input.getAttribute?.('id'),
    input.getAttribute?.('placeholder'),
    input.getAttribute?.('aria-label'),
    input.getAttribute?.('title'),
  ].filter(Boolean).join(' ');
  if (SEARCH_EXCLUDE_RE.test(meta)) return -1000;
  let score = 0;
  if (/装備名(?:の一部)?を入力して検索|装備名.*検索|検索.*装備名/u.test(meta)) score += 120;
  if (/keyword/i.test(meta)) score += 100;
  if (/search/i.test(meta)) score += 80;
  // EC 主搜索框在正式汉化后占位符变成「搜索」，name/id 均可能为空。
  // 提交表单时必须为该输入框赋予与英文 Search 相同的识别优先级。
  if (/搜索|搜尋|检索|檢索/u.test(meta)) score += 80;
  if (/query|(^|[-_])q([-_]|$)/i.test(meta)) score += 70;
  if (/关键词|关键字|キーワード|検索|装備品|装備|검색|장비|키워드/u.test(meta)) score += 70;
  if (input.getAttribute?.('placeholder')) score += 5;
  return score;
}

function findSearchInput(form) {
  if (!form?.querySelectorAll) return null;
  const cached = _searchInputCache.get(form);
  if (cached && cached.isConnected !== false
      && (!form.contains || form.contains(cached))) {
    return cached;
  }

  const candidates = [...form.querySelectorAll('input')];
  let best = null;
  let bestScore = -Infinity;
  for (const input of candidates) {
    const score = searchInputScore(input);
    if (score > bestScore) {
      best = input;
      bestScore = score;
    }
  }

  let result = null;
  if (bestScore >= 5) result = best;
  else {
    const usable = candidates.filter((input) => searchInputScore(input) > -Infinity);
    result = usable.length === 1 ? usable[0] : null;
  }
  if (result) _searchInputCache.set(form, result);
  return result;
}

function buildSearchUrl(action, entries, inputName, native, baseHref) {
  if (!inputName || !native) return null;
  let url;
  try {
    url = new URL(action || baseHref, baseHref);
  } catch {
    return null;
  }

  const grouped = new Map();
  for (const [key, value] of entries || []) {
    // 1.4.2 后续修复：空值参数不得进入搜索 URL —— mirapri 实测（2026-10-07）：
    // 空筛选参数（cl/j/r/t/c/fav 等）会被站方当作「生效的无效筛选」→ 搜索恒为 0 结果；
    // 剔除空值后 ?keyword=X 正常返回（25 条/页），有效筛选（如 j=15）保留后亦正常。
    if (!key || typeof value !== 'string' || value === '') continue;
    const values = grouped.get(key) || [];
    values.push(value);
    grouped.set(key, values);
  }

  for (const key of grouped.keys()) url.searchParams.delete(key);
  for (const [key, values] of grouped) {
    for (const value of values) url.searchParams.append(key, value);
  }
  url.searchParams.delete(inputName);
  url.searchParams.set(inputName, native);
  return url.toString();
}

function formEntries(form) {
  try {
    const fd = new FormData(form);
    return [...fd.entries()];
  } catch {
    return null;
  }
}

function rewriteInputTemporarily(input, native) {
  const previous = input.value;
  input.value = native;
  setTimeout(() => {
    if (!input.isConnected) return;
    if (input.value === native) input.value = previous;
  }, 0);
}


const SUGGEST_MIN_CHARS = 2;
// 候选列表可视行数：数据全量渲染（显示所有含输入字的装备），
// 列表高度限 8 行，超出的通过滚轮在列表内滑动翻看。
const SUGGEST_VISIBLE_ROWS = 8;
const SUGGEST_ROW_HEIGHT = 44;   // 触摸目标不少于 44px，与 CSS 对齐
const SUGGEST_RENDER_BATCH = 80;  // 首批至多 80 行，滚动接近底部时渐进追加
const SUGGEST_DEBOUNCE_MS = 70;
const SUGGEST_HIDE_DELAY_MS = 120;

let _suggestBox = null;
let _suggestInput = null;
let _suggestRows = [];
let _suggestRendered = 0;
let _suggestActive = -1;
let _suggestTimer = null;
let _suggestHideTimer = null;
let _suggestStyleReady = false;
let _suggestDataReady = false;
const _composingInputs = new WeakSet();
const _convertedInputs = new WeakMap();
const _programmaticInputs = new WeakSet();
const _selectedSearchRows = new WeakMap();

function isSearchInput(input) {
  const form = input?.form;
  if (!form) return false;
  const cached = _searchInputCache.get(form);
  if (cached && cached !== input) _searchInputCache.delete(form);
  return findSearchInput(form) === input;
}

// 1.4.2 后续修复（b 方案）：可挂候选面板的输入框 = 表单搜索框 + 独立搜索框
// （ronka / collection 无 form 站，以及 EC vue-select 部位筛选器）。
// 输入停顿一律不自动转换；仅候选面板点选（转换式搜索）与表单提交（临时替换）时转换。
function isSuggestibleInput(input) {
  if (isSearchInput(input)) return true;
  return isStandaloneSearchInput(input);
}

function isSuggestionQuery(value) {
  const query = normalizeSearchQuery(value);
  return query.length >= SUGGEST_MIN_CHARS && /[\u3400-\u9fff]/u.test(query);
}

function ensureSuggestionStyle() {
  if (_suggestStyleReady || typeof document === 'undefined') return;
  const host = document.head || document.documentElement;
  if (!host?.appendChild || !document.createElement) return;
  const style = document.createElement('style');
  style.textContent = [
    '[data-zhx-chinese-suggest]{position:fixed;display:block;box-sizing:border-box;overflow:auto;margin:0;padding:4px;background:#fff;border:1px solid rgba(0,0,0,.16);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.18);z-index:2147483647;font:14px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
    '[data-zhx-chinese-suggest][hidden]{display:none;}',
    '[data-zhx-chinese-suggest] button{display:flex;align-items:center;justify-content:space-between;box-sizing:border-box;width:100%;min-height:44px;margin:0;padding:10px 10px;border:0;border-radius:6px;background:transparent;color:#222;text-align:left;cursor:pointer;}',
    '[data-zhx-chinese-suggest] button:hover,[data-zhx-chinese-suggest] button[data-active="1"]{background:#f0f2f5;}',
    '[data-zhx-chinese-suggest] .zhx-suggest-zh{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '[data-zhx-chinese-suggest] .zhx-suggest-native{margin-left:12px;overflow:hidden;color:#777;font-size:12px;text-overflow:ellipsis;white-space:nowrap;}',
    '[data-zhx-chinese-suggest] .zhx-suggest-empty{box-sizing:border-box;min-height:40px;padding:10px;color:#777;text-align:center;}',
  ].join('');
  host.appendChild(style);
  _suggestStyleReady = true;
}

function positionSuggestionBox(input) {
  if (!_suggestBox || _suggestBox.hidden || !input?.getBoundingClientRect) return;
  const rect = input.getBoundingClientRect();
  const gap = 4;
  const margin = 8;
  // 手机软键盘会缩小 visualViewport，但不一定同步更新 innerHeight。
  const view = globalThis.visualViewport;
  const viewportWidth = Number(view?.width) || Number(globalThis.innerWidth) || document.documentElement?.clientWidth || 0;
  const viewportHeight = Number(view?.height) || Number(globalThis.innerHeight) || document.documentElement?.clientHeight || 0;
  const viewLeft = Number(view?.offsetLeft) || 0;
  const viewTop = Number(view?.offsetTop) || 0;
  const roomWidth = Math.max(0, viewportWidth - margin * 2);
  const width = Math.min(Math.max(rect.width, 180), roomWidth);
  const left = Math.min(Math.max(viewLeft + margin, rect.left), viewLeft + Math.max(margin, viewportWidth - width - margin));
  const belowSpace = Math.max(0, viewTop + viewportHeight - rect.bottom - gap - margin);
  const aboveSpace = Math.max(0, rect.top - viewTop - gap - margin);
  const openBelow = belowSpace >= SUGGEST_ROW_HEIGHT * 2 || belowSpace >= aboveSpace;
  const available = openBelow ? belowSpace : aboveSpace;
  const rowsHeight = SUGGEST_VISIBLE_ROWS * SUGGEST_ROW_HEIGHT + 8;
  const maxHeight = Math.max(0, Math.min(rowsHeight, available));
  const top = openBelow ? rect.bottom + gap : Math.max(viewTop + margin, rect.top - gap - maxHeight);
  _suggestBox.style.left = left + 'px';
  _suggestBox.style.top = top + 'px';
  _suggestBox.style.width = width + 'px';
  _suggestBox.style.maxHeight = maxHeight + 'px';
}

// 滚动/缩放时保持候选框（1.4.2 后续修复）：输入框仍在视口内 → 跟随重定位（保持打开）；
// 已滚出视口 → 关闭。滚动本身不再直接关闭候选框（无滚动条的候选框、滚到列表边界后
// 继续滚动会链式带动页面滚动——这些场景都不应让候选框消失）。
function syncSuggestionsOnScroll() {
  if (!_suggestBox || _suggestBox.hidden) return;
  const input = _suggestInput;
  if (!input || input.isConnected === false) {
    hideSuggestions(true);
    return;
  }
  const rect = input.getBoundingClientRect?.();
  if (!rect) {
    hideSuggestions(true);
    return;
  }
  const view = globalThis.visualViewport;
  const width = Number(view?.width) || Number(globalThis.innerWidth) || document.documentElement?.clientWidth || 0;
  const height = Number(view?.height) || Number(globalThis.innerHeight) || document.documentElement?.clientHeight || 0;
  const left = Number(view?.offsetLeft) || 0;
  const top = Number(view?.offsetTop) || 0;
  const onScreen = rect.bottom > top && rect.top < top + height && rect.right > left && rect.left < left + width;
  if (!onScreen) {
    hideSuggestions(true);
    return;
  }
  positionSuggestionBox(input);
}

function hideSuggestions(clearInputState = false) {
  if (_suggestTimer) {
    clearTimeout(_suggestTimer);
    _suggestTimer = null;
  }
  if (_suggestHideTimer) {
    clearTimeout(_suggestHideTimer);
    _suggestHideTimer = null;
  }
  if (_suggestBox) _suggestBox.hidden = true;
  if (_suggestInput) {
    _suggestInput.setAttribute('aria-expanded', 'false');
    if (clearInputState) _suggestInput.removeAttribute('aria-activedescendant');
  }
  _suggestRows = [];
  _suggestRendered = 0;
  _suggestActive = -1;
}

function scheduleSuggestions(input) {
  if (_suggestTimer) clearTimeout(_suggestTimer);
  _suggestTimer = setTimeout(() => {
    _suggestTimer = null;
    showSuggestions(input);
  }, SUGGEST_DEBOUNCE_MS);
}

function selectSuggestion(index) {
  const row = _suggestRows[index];
  if (!row || !_suggestInput) return;
  const input = _suggestInput;
  input.focus({ preventScroll: true });
  input.value = row.zh;
  _selectedSearchRows.set(input, row);
  hideSuggestions(true);
  try {
    input.setSelectionRange(input.value.length, input.value.length);
  } catch {
    /* 输入类型变化时忽略光标定位失败 */
  }
  // 独立搜索框（React 站点，b 方案）：选中候选后做「转换式搜索」——
  // 用原生名触发站内检索，随后输入框显示恢复为中文。
  // 两类控件遵循相同选择语义：选择候选就执行一次站内搜索。
  // EC Gearsets 候选点击必须使用原站 GET 检索，不能仅派发 input 事件；
  // 站点的动态组件可能在事件后重新写入中文，导致结果恒为空。
  if (submitECGearsetsSearch(input, row.native)) return;
  // 原站表单必须经过 requestSubmit（触发现有校验及捕获监听），不能调用 form.submit()。
  if (isStandaloneSearchInput(input)) convertStandaloneForSearch(input, false, row.native);
  else if (isSearchInput(input) && typeof input.form?.requestSubmit === 'function') {
    input.form.requestSubmit();
  }
}

// 保留完整候选数组，但只渲染小批量 DOM；触底和键盘导航时按需追加。
function appendSuggestionBatch() {
  if (!_suggestBox || !_suggestRows.length) return;
  const end = Math.min(_suggestRows.length, _suggestRendered + SUGGEST_RENDER_BATCH);
  for (let index = _suggestRendered; index < end; index++) {
    const row = _suggestRows[index];
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'zhx-chinese-suggest-' + index;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', 'false');
    button.dataset.zhxIndex = String(index);
    const zh = document.createElement('span');
    zh.className = 'zhx-suggest-zh';
    zh.textContent = row.zh;
    const native = document.createElement('span');
    native.className = 'zhx-suggest-native';
    native.textContent = row.native + (row.provisional ? ' · EC 结果待确认' : '');
    button.append(zh, native);
    _suggestBox.appendChild(button);
  }
  _suggestRendered = end;
}

function updateSuggestionActive(index) {
  if (!_suggestBox) return;
  _suggestActive = index;
  while (index >= _suggestRendered && _suggestRendered < _suggestRows.length) appendSuggestionBatch();
  const buttons = _suggestBox.querySelectorAll('button[data-zhx-index]');
  for (const button of buttons) {
    const active = Number(button.dataset.zhxIndex) === index;
    button.dataset.active = active ? '1' : '0';
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  const activeButton = buttons[index];
  if (activeButton) {
    activeButton.scrollIntoView({ block: 'nearest' });
    if (activeButton.id) _suggestInput?.setAttribute('aria-activedescendant', activeButton.id);
  } else {
    _suggestInput?.removeAttribute('aria-activedescendant');
  }
}

function showSuggestions(input) {
  if (!isSuggestibleInput(input) || !input.isConnected) {
    hideSuggestions(true);
    return;
  }
  const query = normalizeSearchQuery(input.value);
  // 在数据尚未就绪时也要记住当前输入框，数据 ready 回调才能补显示候选。
  _suggestInput = input;
  if (!isSuggestionQuery(query)) {
    hideSuggestions(true);
    return;
  }
  // Gearsets 候选只依赖已加载的本地套装目录/词典，不必等待 V3 物品表；
  // 否则 V3 网络超时会让整个套装检索也无法使用。
  if (!_suggestDataReady && !isECGearsetsPage()) {
    hideSuggestions(true);
    return;
  }

  const rows = ecScopedSuggestions(query, input);

  ensureSuggestionStyle();
  if (!_suggestBox) {
    _suggestBox = document.createElement('div');
    _suggestBox.id = 'zhx-chinese-suggest-list';
    _suggestBox.dataset.zhxChineseSuggest = '';
    _suggestBox.setAttribute('role', 'listbox');
    (document.body || document.documentElement)?.appendChild(_suggestBox);
  }
  if (!_suggestBox) return;

  _suggestInput = input;
  _suggestRows = rows;
  _suggestRendered = 0;
  _suggestActive = -1;
  _suggestBox.replaceChildren();

  if (!rows.length) {
    const message = document.createElement('div');
    message.className = 'zhx-suggest-empty';
    message.textContent = isECGearsetsPage() ? '未找到对应套装' : '未找到对应装备';
    message.setAttribute('role', 'status');
    _suggestBox.setAttribute('role', 'status');
    _suggestBox.appendChild(message);
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-controls', _suggestBox.id);
    _suggestBox.hidden = false;
    positionSuggestionBox(input);
    return;
  }

  _suggestBox.setAttribute('role', 'listbox');
  appendSuggestionBatch();

  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-haspopup', 'listbox');
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-controls', _suggestBox.id);
  _suggestBox.hidden = false;
  positionSuggestionBox(input);
}

function handleSearchInput(event) {
  const input = event.target;
  if (!_programmaticInputs.has(input)) {
    _convertedInputs.delete(input);
    _selectedSearchRows.delete(input);
  }
  if (isSearchInput(input)) {
    if (_composingInputs.has(input)) return;
    scheduleSuggestions(input);
    return;
  }
  // 独立搜索框（无 form）：由 handleStandaloneSearchInput 调度（候选 + 自动转换），此处不清候选。
  if (isStandaloneSearchInput(input)) return;
  if (_suggestInput === input) hideSuggestions(true);
}

function handleSearchFocus(event) {
  const input = event.target;
  if (!isSuggestibleInput(input) || _composingInputs.has(input)) return;
  scheduleSuggestions(input);
}

function handleSearchBlur(event) {
  if (_suggestInput !== event.target) return;
  if (_suggestHideTimer) clearTimeout(_suggestHideTimer);
  const blurred = event.target;
  _suggestHideTimer = setTimeout(() => {
    _suggestHideTimer = null;
    // 1.4.2 后续修复：延迟内焦点可能已移到另一个搜索框（表单框 ↔ 独立框切换），
    // 仅当 _suggestInput 仍是被失焦的框时才隐藏，避免误藏新框的候选面板。
    if (_suggestInput === blurred) hideSuggestions(true);
  }, SUGGEST_HIDE_DELAY_MS);
}

function handleSuggestionKeydown(event) {
  if (_suggestInput !== event.target || !_suggestBox || _suggestBox.hidden || !_suggestRows.length) return false;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    updateSuggestionActive((_suggestActive + 1) % _suggestRows.length);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    updateSuggestionActive((_suggestActive + _suggestRows.length - 1) % _suggestRows.length);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    hideSuggestions(true);
  } else if (event.key === 'Enter' && _suggestActive >= 0) {
    event.preventDefault();
    event.stopPropagation();
    selectSuggestion(_suggestActive);
  } else return false;
  return true;
}

function handleSearchKeydown(event) {
  const input = event.target;
  if (event.isComposing || _composingInputs.has(input) || event.keyCode === 229) return;
  if (handleSuggestionKeydown(event)) return;
  // Gearsets 的 search GET 参数是网站的查询入口；按回车时立即导航，
  // 而不是向可能有异步状态的前端组件派发临时原生名 input。
  if (event.key === 'Enter' && submitECGearsetsSearch(input)) {
    event.preventDefault();
    event.stopPropagation();
    hideSuggestions(true);
    return;
  }
  // 其他站点显式搜索保留原站回车事件。
  if (event.key === 'Enter' && isStandaloneSearchInput(input) && convertStandaloneForSearch(input, true)) hideSuggestions(true);
}

function handleSuggestionPointerDown(event) {
  const button = event.target?.closest?.('button[data-zhx-index]');
  if (!button || !_suggestBox?.contains(button)) return;
  event.preventDefault();
  selectSuggestion(Number(button.dataset.zhxIndex));
}

function handleCompositionStart(event) {
  const input = event.target;
  if (isSuggestibleInput(input)) {
    _composingInputs.add(input);
    if (_suggestInput === input) hideSuggestions(true);
  }
}

function handleCompositionEnd(event) {
  const input = event.target;
  if (!isSuggestibleInput(input)) return;
  _composingInputs.delete(input);
  scheduleSuggestions(input);
}

// ── 独立搜索框（1.4.2 后续修复；b 方案）──
// ronka 等站点的搜索框不属于任何 form（React 客户端过滤、无提交事件可拦）；
// b 方案：打字期间不做任何自动转换；候选面板点选后做「转换式搜索」
//（用原生名触发站内检索，随后输入框显示恢复为中文，见 convertStandaloneForSearch）。
const STANDALONE_SEARCH_HINT_RE = /검색어|키워드|キーワード|搜索|搜尋|検索|search|关键词|關鍵詞|keyword/i;
const STANDALONE_EXCLUDE_TYPES = new Set(['hidden', 'password', 'email', 'tel', 'url', 'number', 'date', 'datetime-local', 'month', 'week', 'time', 'color', 'range', 'file', 'checkbox', 'radio', 'button', 'submit', 'reset', 'image']);

function isStandaloneSearchInput(input) {
  if (!input) return false;
  if (String(input.tagName || '').toUpperCase() !== 'INPUT') return false;
  const type = String(input.getAttribute?.('type') || '').toLowerCase();
  if (STANDALONE_EXCLUDE_TYPES.has(type)) return false;
  if (input.disabled || input.readOnly) return false;
  // 1.4.2 后续修复：vue-select 搜索输入框（EC 部位筛选器，如 "Any head"）——
  // 不依赖 form 归属：输入即触发站点装备检索（EC 实测 POST /gear/<slot>/search）；
  // b 方案后与独立搜索框统一：打字不转换，候选面板点选时做「转换式搜索」。
  if (/vs__search/.test(String(input.className || ''))) {
    return SEARCH_SITES[_activeSearchSiteId]?.vueSelect === true;
  }
  if (input.form) return false;
  const meta = [
    input.getAttribute?.('placeholder'),
    input.getAttribute?.('aria-label'),
    input.getAttribute?.('name'),
    input.getAttribute?.('id'),
    input.getAttribute?.('title'),
  ].filter(Boolean).join(' ');
  const field = [input.getAttribute?.('name'), input.getAttribute?.('id')].filter(Boolean).join(' ');
  if (SEARCH_EXCLUDE_RE.test(field) || /search by title|作者|用户名|评论|タイトル|プレイヤー|작성자/i.test(meta)) return false;
  return STANDALONE_SEARCH_HINT_RE.test(meta);
}

function rewriteInputNatively(input, native) {
  let applied = false;
  try {
    const descriptor = typeof HTMLInputElement !== 'undefined' && HTMLInputElement.prototype
      ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
      : null;
    if (descriptor?.set) {
      descriptor.set.call(input, native);
      applied = input.value === native;
    }
  } catch { /* 回退：直接赋值 */ }
  if (!applied) {
    try {
      input.value = native;
      applied = input.value === native;
    } catch { /* 忽略 */ }
  }
  if (!applied) return false;
  _programmaticInputs.add(input);
  try {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } catch { /* 事件派发失败不影响替换结果 */ }
  finally { _programmaticInputs.delete(input); }
  return true;
}

// b 方案（2026-10-08）：点选候选后的「转换式搜索」——用原生名触发站点检索（派发 input），
// 随后把输入框显示恢复为中文（静默设值，不再派发事件；若站点已改写则不动）。
function convertStandaloneForSearch(input, allowPartial = false, selectedNative = null) {
  try {
    if (!input || input.isConnected === false || _composingInputs.has(input)) return false;
    const shown = input.value;
    const query = normalizeSearchQuery(shown);
    if (query.length < 2 || !isChineseSearchQuery(query)) return false;
    const context = ecSearchContext(input);
    const native = selectedNative
      || (context ? ecScopedNative(query, input, allowPartial) : null)
      || (!context && isECGearsetsPage() ? resolveECGearsetSearch(query) : null)
      || (!context ? resolveByZh(query) : null)
      || (!context && allowPartial ? resolvePartialByZh(query) : null);
    if (!native || native === query) return false;
    if (!rewriteInputNatively(input, native)) return false;
    restoreStandaloneDisplay(input, shown, native);
    return true;
  } catch { return false; /* 转换失败时保留站点原有搜索行为 */ }
}

function restoreStandaloneDisplay(input, shown, native) {
  const token = {};
  _convertedInputs.set(input, token);
  // React 结果加载期间可能再次回写受控值；有限次恢复显示，用户继续输入即取消。
  for (const delay of [0, 100, 500, 1500, 3000]) {
    setTimeout(() => {
      if (_convertedInputs.get(input) !== token || input.isConnected === false) return;
      if (input.value === native) setInputValueSilently(input, shown);
      if (delay === 3000) _convertedInputs.delete(input);
    }, delay);
  }
}

// 从搜索按钮所在的最小容器查找独立搜索框，避免影响其他字段或候选按钮。
function findStandaloneTriggerInput(button) {
  let root = button.parentElement || button.parentNode;
  for (let depth = 0; root && depth < 8; depth++, root = root.parentElement || root.parentNode) {
    if (root === document.body || root === document.documentElement) return null;
    const inputs = [...(root.querySelectorAll?.('input') || [])].filter(isStandaloneSearchInput);
    if (_suggestInput && inputs.includes(_suggestInput)) return _suggestInput;
    if (inputs.length === 1) return inputs[0];
    if (inputs.length > 1 || root === document.body) return null;
  }
  return null;
}

function handleStandaloneSearchClick(event) {
  const button = event.target?.closest?.('button, input[type="submit"], [role="button"]');
  if (!button || button.disabled || _suggestBox?.contains(button)) return;
  const label = [button.textContent, button.getAttribute?.('title'), button.getAttribute?.('aria-label'), button.value]
    .filter(Boolean).join(' ').trim();
  if (/clear|reset|取消|重置|清空|初期化|초기화|지우기/i.test(label)) return;
  if (!/搜索|搜尋|查询|查找|검색|検索|\bsearch\b|필터\s*적용|应用筛选|適用|\bapply\b/i.test(label)) return;
  const input = findStandaloneTriggerInput(button);
  if (input && submitECGearsetsSearch(input)) {
    event.preventDefault();
    event.stopPropagation();
    hideSuggestions(true);
    return;
  }
  if (input && convertStandaloneForSearch(input, true)) hideSuggestions(true);
}

// 静默设值：更新输入框显示，但不派发 input 事件（避免二次触发站点检索）。
function setInputValueSilently(input, value) {
  try {
    const descriptor = typeof HTMLInputElement !== 'undefined' && HTMLInputElement.prototype
      ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
      : null;
    if (descriptor?.set) {
      descriptor.set.call(input, value);
      if (input.value === value) return true;
    }
  } catch { /* 回退：直接赋值 */ }
  try {
    input.value = value;
    return input.value === value;
  } catch {
    return false;
  }
}

function handleStandaloneSearchInput(event) {
  const input = event.target;
  if (isSearchInput(input)) return;
  if (isStandaloneSearchInput(input)) {
    // b 方案（2026-10-08）：输入停顿不自动转换（禁止输入即搜索）；仅候选面板点选时转换。
    // 1.4.2 后续修复：独立搜索框也显示智能候选面板（ronka / collection / EC vue-select）。
    if (isSuggestibleInput(input)) scheduleSuggestions(input);
  }
}

function bindChineseSearchUi() {
  document.addEventListener('input', handleSearchInput, true);
  document.addEventListener('input', handleStandaloneSearchInput, true);
  document.addEventListener('focusin', handleSearchFocus, true);
  document.addEventListener('focusout', handleSearchBlur, true);
  document.addEventListener('keydown', handleSearchKeydown, true);
  document.addEventListener('compositionstart', handleCompositionStart, true);
  document.addEventListener('compositionend', handleCompositionEnd, true);
  document.addEventListener('pointerdown', handleSuggestionPointerDown, true);
  document.addEventListener('click', handleStandaloneSearchClick, true);
  document.addEventListener('scroll', (event) => {
    // 列表自身滚动（滚轮翻看全部装备）无需处理；页面滚动只做同步——
    // 输入框仍在视口内则保持打开并跟随重定位，已滚出视口才关闭。
    if (_suggestBox && event.target && _suggestBox.contains(event.target)) {
      if (event.target === _suggestBox && !_suggestBox.hidden
          && _suggestBox.scrollTop + _suggestBox.clientHeight >= _suggestBox.scrollHeight - SUGGEST_ROW_HEIGHT * 2) {
        appendSuggestionBatch();
      }
      return;
    }
    syncSuggestionsOnScroll();
  }, true);
  globalThis.addEventListener?.('resize', () => syncSuggestionsOnScroll());
  globalThis.visualViewport?.addEventListener?.('resize', () => syncSuggestionsOnScroll());
  globalThis.visualViewport?.addEventListener?.('scroll', () => syncSuggestionsOnScroll());
}

// EC Gearsets 原生路由提交单独处理，避免与其它站点的 GET/POST 表单分支
// 交叉嵌套；成功时消费事件，失败时由既有站点提交链处理。
function handleECGearsetsFormSubmit(event, siteId, input, query, selected) {
  if (siteId !== 'ec') return false;
  const native = selected?.zh === query ? selected.native : null;
  if (!submitECGearsetsSearch(input, native)) return false;
  _selectedSearchRows.delete(input);
  event.preventDefault();
  event.stopPropagation();
  hideSuggestions(true);
  return true;
}

function handleChineseSearchSubmit(event, siteId) {
  if (!SEARCH_SITES[siteId]) return;
  const form = event.target;
  _searchInputCache.delete(form);
  const input = findSearchInput(form);
  if (!input) return;

  const query = normalizeSearchQuery(input.value);
  if (!isChineseSearchQuery(query)) return;

  const selected = _selectedSearchRows.get(input);
  if (handleECGearsetsFormSubmit(event, siteId, input, query, selected)) return;
  const context = siteId === 'ec' ? ecSearchContext(input) : null;
  const native = selected?.zh === query && selected.native
    ? selected.native
    : context ? ecScopedNative(query, input, true)
      : resolveSearchNative(query, siteId === 'ec' && isECGearsetsPage());
  _selectedSearchRows.delete(input);
  // 套装页优先系列/职能片段映射；其余站点仍以物品总表 + 公共子串兜底。
  if (!native || native === query) return;

  const method = String(form.getAttribute?.('method') || 'get').toLowerCase();
  if (method === 'get' && input.name) {
    const entries = formEntries(form);
    const action = form.getAttribute?.('action') || globalThis.location?.href || '';
    const baseHref = globalThis.location?.href || action;
    const url = entries ? buildSearchUrl(action, entries, input.name, native, baseHref) : null;
    if (url) {
      event.preventDefault();
      event.stopPropagation();
      globalThis.location.assign(url);
      return;
    }
  }

  // 非 GET / 无 name 的搜索表单：只临时替换提交值，不改页面显示，不派发 input 事件。
  rewriteInputTemporarily(input, native);
}

function startChineseSearch(siteId) {
  if (!SEARCH_SITES[siteId]) return;
  _activeSearchSiteId = siteId;
  if (typeof document === 'undefined' || !document.addEventListener) return;
  if (globalThis.__zhxChineseSearchBound) return;
  globalThis.__zhxChineseSearchBound = true;
  bindChineseSearchUi();
  onTablesReady(() => {
    _suggestDataReady = true;
    if (_suggestInput?.isConnected && isSuggestionQuery(_suggestInput.value)) showSuggestions(_suggestInput);
  });
  document.addEventListener('submit', (event) => {
    try {
      handleChineseSearchSubmit(event, siteId);
    } catch (error) {
      console.warn('[zhx] 中文装备搜索失败', error);
    }
  }, true);
}

export {
  SEARCH_SITES,
  buildSearchUrl,
  findSearchInput,
  handleChineseSearchSubmit,
  isChineseSearchQuery,
  normalizeSearchQuery,
  isECGearsetsPage,
  resolveSearchNative,
  positionSuggestionBox,
  searchInputScore,
  startChineseSearch,
};
