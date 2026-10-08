#!/usr/bin/env node
/**
 * coverage-audit.mjs — 六站汉化覆盖审计 CLI
 *
 * 用法：
 *   node tools/coverage-audit/audit.mjs scan --site ec --pages home,glamours
 *   node tools/coverage-audit/audit.mjs scan --site mirapri --channel cloud
 *   node tools/coverage-audit/audit.mjs scan --all --channel auto
 *   node tools/coverage-audit/audit.mjs report --out docs/audit-20261008.md
 *
 * 通道：
 *   local — 本机 headless Chrome CDP（9223，复用 tests/helpers）
 *   cloud — 云浏览器（BROWSER_USE_API_KEY，可过 CF，mirapri/EC）
 *   user  — 用户浏览器收集器（生成一个可注入的收集脚本，用户在自己浏览器跑）
 *
 * 输出：
 *   JSON 明细（tests/.cache/coverage-audit/）+ Markdown 报告
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TOOL_ROOT = __dirname;
export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const CACHE_DIR = path.join(REPO_ROOT, 'tests', '.cache', 'coverage-audit');
export const DIST_FILE = path.join(REPO_ROOT, 'dist', 'ff14-glamour-zh.greasyfork.user.js');

// ---------- 站点配置 ----------
export const SITES = {
  mirapri: {
    name: 'mirapri',
    label: 'mirapri（日服幻化站）',
    host: 'mirapri.com',
    channel: 'cloud', // 本机 403，需云
    pages: [
      { id: 'home', url: 'https://mirapri.com/', type: 'home' },
      { id: 'search', url: 'https://mirapri.com/?keyword=メイドリストドレス', type: 'search' },
      { id: 'posts', url: 'https://mirapri.com/posts', type: 'list' },
    ],
  },
  ec: {
    name: 'ec',
    label: 'Eorzea Collection（国际服幻化站）',
    host: 'ffxiv.eorzeacollection.com',
    channel: 'cloud', // 本机被 CF 拦，云 sg/us 可过
    pages: [
      { id: 'home', url: 'https://ffxiv.eorzeacollection.com/', type: 'home' },
      { id: 'glamours', url: 'https://ffxiv.eorzeacollection.com/glamours', type: 'list' },
      { id: 'gearsets', url: 'https://ffxiv.eorzeacollection.com/gearsets', type: 'list' },
      { id: 'about', url: 'https://ffxiv.eorzeacollection.com/about', type: 'misc' },
    ],
  },
  fc: {
    name: 'fc',
    label: 'fc（ミラプリライフ）',
    host: 'ff14-fc.com',
    channel: 'local', // 本机可达（需屏蔽外链）
    pages: [
      { id: 'home', url: 'https://ff14-fc.com/', type: 'home' },
      { id: 'equip', url: 'https://ff14-fc.com/equip', type: 'list' },
    ],
  },
  ronka: {
    name: 'ronka',
    label: 'ronka（韩服幻化站）',
    host: 'lookbook.ronkacloset.com',
    channel: 'local', // 本机可达
    pages: [
      { id: 'home', url: 'https://lookbook.ronkacloset.com/', type: 'home' },
      { id: 'list', url: 'https://lookbook.ronkacloset.com/lookbook', type: 'list' },
    ],
  },
  collection: {
    name: 'collection',
    label: 'collection（FFXIV ARMOURY COLLECTION）',
    host: 'www.ffxivcollection.com',
    channel: 'local', // 本机可达
    pages: [
      { id: 'home', url: 'https://www.ffxivcollection.com/', type: 'home' },
      { id: 'weapon', url: 'https://weapon.ffxivcollection.com/', type: 'list' },
    ],
  },
  wiki: {
    name: 'wiki',
    label: '灰机 wiki（中文站，只审计反查块）',
    host: 'ff14.huijiwiki.com',
    channel: 'fixture', // WAF 拦 headless，用夹具
    pages: [
      { id: 'item', url: 'fixture:wiki-item.html', type: 'item' },
    ],
  },
};

// ---------- 残留分类 ----------
export const CATEGORY = {
  REAL: 'real',           // 真漏译，需修
  WRONG: 'wrong',         // 错译候选（译文残留源语言/不一致）
  USER: 'user',           // 用户内容，不译
  AD: 'ad',               // 广告，不译
  EXEMPT: 'exempt',       // 豁免（服务器名/品牌/未收录装备名）
  KNOWN: 'known',         // 已知引擎限制
  OK: 'ok',               // 已正确汉化（不应出现在残留里，用于校验）
};

export const CATEGORY_LABEL = {
  [CATEGORY.REAL]: '真漏译',
  [CATEGORY.WRONG]: '错译候选',
  [CATEGORY.USER]: '用户内容',
  [CATEGORY.AD]: '广告',
  [CATEGORY.EXEMPT]: '豁免',
  [CATEGORY.KNOWN]: '已知限制',
  [CATEGORY.OK]: '已汉化',
};

// ---------- 豁免规则 ----------
// 服务器名（国际服，不译）
const SERVER_NAMES = new Set([
  'Aegis','Atomos','Balmung','Behemoth','Belias','Brynhildr','Cerberus','Chocobo',
  'Cuchulainn','Diabolos','Durandal','Excalibur','Famfrit','Fenrir','Garuda','Goblin',
  'Gungnir','Hades','Ifrit','Jenova','Kujata','Lich','Mandragora','Masamune','Mateus',
  'Midgardsormr','Moogle','Odin','Omega','Pandaemonium','Phoenix','Ragnarok','Ramuh',
  'Ridill','Sargatanas','Shinryu','Siren','Sophia','Spriggan','Titan','Tonberry','Typhon',
  'Ultima','Valefor','Valentine','Zalera','Zeromus','Adamantoise','Cactuar','Coeurl',
  'Faerie','Gilgamesh','Golem','Hali','Hyperion','Lamia','Leviathan','Malboro','Marilith',
  'Sahuagin','Ultros','Unicorn','Zodiark','Alexander','Anima','Asura','Bahamut','Bismarck',
  'Carbuncle','Dionysos','Fairy','Geirskogul','Ixion','Kraken','Lich','Louisoix','Materia',
  'Ravana','Sephirot','Sophia','Susano','Tsukuyomi','Zurvan',
]);

// 品牌名 / 站点名 / 明确不译
const EXEMPT_PATTERNS = [
  /^Eorzea Collection$/i,
  /^FFXIV ARMOURY COLLECTION$/i,
  /^MIRAPRI$/i,
  /^ミラプリライフ$/,
  /^ファイナルファンタジーXIV$/,
  /^FF14$/i,
  /^Final Fantasy XIV$/i,
  /^Lodestone$/i,
  /^ERIONES$/i,
  /^Garland Data$/i,
  /^Gamer Escape$/i,
  /^光之收藏家$/,
  /^灰机wiki$/,
  /^ロドスト$/,
  /^アマコレ$/,         // collection 站名缩写（已知保留）
  /^とろさんぽ in FINAL FANTASY XIV$/,  // collection 友链站名（已知保留）
  /^FF14 ERIONES – エリオネス$/,        // 友链站名（ERIONES 保留 + 日文副标题）
];

// ---------- 残留检测 ----------
// 日文假名（平/片）
const JA_RE = /[\u3040-\u30ff]/;
// 韩文音节/谚文字母
const KO_RE = /[\uac00-\ud7af\u1100-\u11ff]/;
// 全角片假名/平假名以外的日文符号（长音符等）
const JA_KANA_ONLY_RE = /[\u3040-\u30ff]/;

/**
 * 判断一段文本是否为「残留外文」（需进一步分类）。
 * 英文不算残留（脚本不翻译英文站 UI 词以外的内容？——EC 是英文站，但界面词已汉化；
 * 英文残留需结合词典判断。这里只标记日/韩文残留 + 特定英文 UI 残留候选）。
 */
export function isResidual(text) {
  const t = text.trim();
  if (!t) return false;
  // 纯数字/标点/符号不算
  if (!/[A-Za-z\u3040-\u30ff\uac00-\ud7af]/.test(t)) return false;
  // 日文假名残留
  if (JA_KANA_ONLY_RE.test(t)) return true;
  // 韩文残留
  if (KO_RE.test(t)) return true;
  return false;
}

/**
 * 分类一条残留文本。
 * @param {string} text 原文（trim 后）
 * @param {object} ctx { tag, cls, id, name, placeholder, ariaLabel, href, parentText }
 * @returns {string} CATEGORY 之一
 */
export function classify(text, ctx = {}) {
  const t = text.trim();
  if (!t) return CATEGORY.OK;

  // 已汉化（含中文，无外文残留）→ OK（不算残留）
  if (!isResidual(t)) return CATEGORY.OK;

  // 用户内容：投稿标题/用户名/留言/日期
  // 启发式：文本较长、含自由文本特征；或上下文是用户内容容器
  if (isUserContent(t, ctx)) return CATEGORY.USER;

  // 广告位
  if (isAdContext(ctx)) return CATEGORY.AD;

  // 豁免：服务器名/品牌/站点名/未收录装备名
  if (isExempt(t, ctx)) return CATEGORY.EXEMPT;

  // 已知引擎限制 / 内容文案（fc 长句混合态、alt 博主文案等）
  if (isKnownLimit(t, ctx)) return CATEGORY.KNOWN;

  // 错译候选：文本已部分中文化但仍残留假名（半译态，且非已知限制）
  if (hasChinese(t) && isResidual(t)) return CATEGORY.WRONG;

  // 其余 = 真漏译
  return CATEGORY.REAL;
}

function hasChinese(t) {
  return /[\u4e00-\u9fff]/.test(t);
}

function isUserContent(t, ctx) {
  // 投稿标题/用户名/留言：通常较长、含自由文本；容器类名含 post/comment/user/author/date 等
  const cls = (ctx.cls || '') + ' ' + (ctx.id || '') + ' ' + (ctx.name || '');
  if (/(post|comment|user|author|message|date|time|created|submitted|nick|name)/i.test(cls)) return true;
  // 日期格式（如 2026-10-08、10/08）
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(t) || /^\d{1,2}\/\d{1,2}/.test(t)) return true;
  // 长度 > 60 的自由文本（非 UI 词）
  if (t.length > 60) return true;
  return false;
}

function isAdContext(ctx) {
  // 收集器已标记广告容器祖先
  if (ctx.ad) return true;
  const cls = (ctx.cls || '') + ' ' + (ctx.id || '') + ' ' + (ctx.name || '') + ' ' + (ctx.parentText || '');
  // AdSense / 广告网络特征（ins.adsbygoogle、google-anno、aswift 等）
  if (/(adsbygoogle|google-anno|aswift|google-ads|ad-slot|adunit|ad-container)/i.test(cls)) return true;
  return /(ad-|ads|advert|sponsor|banner-|pr-|affiliate|amazon|rakuten)/i.test(cls);
}

function isExempt(t, ctx) {
  if (SERVER_NAMES.has(t)) return true;
  if (/^[A-Z][A-Za-z ]{1,40}$/.test(t) && /(server|world)/i.test(ctx.cls || '')) return true;
  for (const re of EXEMPT_PATTERNS) if (re.test(t)) return true;
  return false;
}

function isKnownLimit(t, ctx) {
  // alt 属性中的长文案（博主撰写的图片说明/文章摘要）→ 内容，非 UI 漏译
  if (ctx.kind === 'attr:alt') {
    // 含中文 + 假名混合的长句，或纯日文长句（>15 字）→ 内容文案
    if (t.length > 15) return true;
  }
  // fc 长句混合态：含假名 + 中文 + 长于 20 → 引擎限制/内容文案
  // （fc 的 trFC ③ 部分命中即 return，导致长句半译，属已知限制）
  if (ctx.site === 'fc' && hasChinese(t) && JA_RE.test(t) && t.length > 20) {
    return true;
  }
  // fc 纯日文长句（>20）→ 博主文案/内容
  if (ctx.site === 'fc' && JA_RE.test(t) && !hasChinese(t) && t.length > 20) {
    return true;
  }
  // fc 半译态短名（含中文 + 假名，≤20）→ 系列名/短名部分命中，已知限制
  // 例如「クリプトラーカー·成神之御敌」：职能词已译、系列名未推导出
  if (ctx.site === 'fc' && hasChinese(t) && JA_RE.test(t) && t.length <= 20) {
    return true;
  }
  return false;
}

// ---------- 收集器：可见文本 + 属性 ----------
/**
 * 生成在页面上下文执行的收集器 JS（返回残留候选数组）。
 * 会被注入到真实页面（本地 CDP / 云浏览器 / 用户浏览器）。
 */
export const COLLECTOR_JS = `(() => {
  const out = [];
  const seen = new Set();
  const isVisible = (el) => {
    if (!el || !el.isConnected) return false;
    if (el.nodeType !== 1) return false;
    const cs = window.getComputedStyle(el);
    if (!cs) return false;
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    // offsetParent 为 null 通常不可见，但 position:fixed 特例
    if (el.offsetParent === null && cs.position !== 'fixed') return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    return true;
  };
  const skipTag = (el) => {
    const tag = el.tagName;
    return tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'IFRAME' || tag === 'TEMPLATE';
  };
  const skipZhx = (el) => {
    const cls = String(el.className || '');
    const id = String(el.id || '');
    return cls.includes('zhx-') || id.includes('zhx-') || el.hasAttribute('data-zhx-item') || el.hasAttribute('data-zhx-card') || el.hasAttribute('data-zhx-done') || el.hasAttribute('data-zhxWikiDone');
  };
  const ctxOf = (el) => {
    let p = el.parentElement;
    let cls = '', id = '', name = '', href = '', parentText = '', ad = false;
    if (p) { cls = String(p.className || ''); id = String(p.id || ''); }
    const inp = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
    if (inp) {
      name = String(el.getAttribute('name') || '');
      const f = el.form;
      if (f) { cls = String(f.className || '') + ' ' + cls; id = String(f.id || '') + ' ' + id; }
    }
    if (el.tagName === 'A') href = String(el.getAttribute('href') || '');
    if (p) parentText = (p.textContent || '').trim().slice(0, 120);
    // 广告容器检测：沿祖先链找 AdSense / 广告网络特征
    let anc = el;
    for (let i = 0; anc && i < 8; i++) {
      const acls = String(anc.className || '') + ' ' + String(anc.id || '');
      if (anc.tagName === 'INS' && /adsbygoogle/i.test(acls)) { ad = true; break; }
      if (/(adsbygoogle|google-anno|aswift|ad-slot|adunit|ad-container|advert|sponsor)/i.test(acls)) { ad = true; break; }
      anc = anc.parentElement;
    }
    return { tag: el.tagName.toLowerCase(), cls, id, name, href, parentText, ad };
  };
  const push = (el, text, kind) => {
    const t = (text || '').trim();
    if (!t) return;
    if (seen.has(el + '|' + t + '|' + kind)) return;
    seen.add(el + '|' + t + '|' + kind);
    out.push({ kind, text: t, ctx: ctxOf(el), path: zhxPath(el) });
  };
  const zhxPath = (el) => {
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement && parts.length < 12) {
      let sel = cur.tagName.toLowerCase();
      if (cur.id) sel += '#' + cur.id;
      else if (cur.className && typeof cur.className === 'string') sel += '.' + cur.className.trim().split(/\\s+/).slice(0, 2).join('.');
      const parent = cur.parentElement;
      if (parent) {
        const sib = Array.from(parent.children).filter((c) => c.tagName === cur.tagName && !(c.id) && String(c.className || '') === String(cur.className || ''));
        const idx = Array.from(parent.children).indexOf(cur) + 1;
        if (sib.length > 1) sel += ':nth-child(' + idx + ')';
      }
      parts.unshift(sel);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  };
  // 1) 文本节点
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const p = node.parentElement;
      if (!p || skipTag(p) || skipZhx(p)) return NodeFilter.FILTER_REJECT;
      if (!isVisible(p)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n;
  while ((n = walker.nextNode())) {
    const t = (n.nodeValue || '').trim();
    if (!t) continue;
    push(n.parentElement, t, 'text');
  }
  // 2) 属性：placeholder / title / aria-label / alt / value(option)
  const attrSel = 'input[placeholder],textarea[placeholder],input[title],a[title],button[title],[aria-label],[alt]';
  for (const el of document.querySelectorAll(attrSel)) {
    if (!isVisible(el) || skipZhx(el)) continue;
    for (const attr of ['placeholder','title','aria-label','alt']) {
      const v = el.getAttribute(attr);
      if (v && v.trim()) push(el, v, 'attr:' + attr);
    }
  }
  // 3) option 文本
  for (const opt of document.querySelectorAll('option')) {
    if (!isVisible(opt) || skipZhx(opt)) continue;
    push(opt, opt.textContent || '', 'option');
  }
  // 4) 可见文本节点中的「已汉化但仍有外文」候选（半译态）也收集
  return out;
})()`;

// ---------- 报告 ----------
export function classifyResiduals(items) {
  return items.map((it) => {
    const text = it.text;
    const cat = classify(text, { ...it.ctx, site: it.site, kind: it.kind });
    return { ...it, category: cat, categoryLabel: CATEGORY_LABEL[cat] };
  });
}

export function buildReport(results, { output } = {}) {
  // results: { site, pages: [{ id, url, items: [...] }] } 或 { site, pageId, url, items: [...] }
  const lines = [];
  lines.push('# 汉化覆盖审计报告');
  lines.push('');
  lines.push(`- 生成时间：${new Date().toISOString()}`);
  lines.push(`- 覆盖站点：${[...new Set(results.map((r) => r.site))].join(', ')}`);
  lines.push('');
  const bySite = {};
  const sitePages = {};   // site -> [{id, url, items}]
  for (const r of results) {
    if (!bySite[r.site]) bySite[r.site] = { real: 0, wrong: 0, user: 0, ad: 0, exempt: 0, known: 0, ok: 0, total: 0 };
    if (!sitePages[r.site]) sitePages[r.site] = [];
    const pages = r.pages || (r.items ? [{ id: r.pageId || 'page', url: r.url, items: r.items }] : []);
    for (const p of pages) {
      sitePages[r.site].push({ id: p.id, url: p.url, items: p.items || [] });
      for (const it of p.items || []) {
        const c = it.category;
        if (bySite[r.site][c] !== undefined) bySite[r.site][c]++;
        bySite[r.site].total++;
      }
    }
  }
  lines.push('## 各站残留汇总');
  lines.push('');
  lines.push('| 站点 | 真漏译 | 错译候选 | 用户内容 | 广告 | 豁免 | 已知限制 | 总计 |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const [site, s] of Object.entries(bySite)) {
    lines.push(`| ${site} | ${s.real} | ${s.wrong} | ${s.user} | ${s.ad} | ${s.exempt} | ${s.known} | ${s.total} |`);
  }
  lines.push('');
  lines.push('## 真漏译明细');
  lines.push('');
  for (const [site, pages] of Object.entries(sitePages)) {
    for (const p of pages) {
      const reals = (p.items || []).filter((it) => it.category === 'real');
      if (reals.length === 0) continue;
      lines.push(`### ${site} / ${p.id}`);
      lines.push('');
      lines.push('| 原文 | 位置 | 上下文 |');
      lines.push('|---|---|---|');
      for (const it of reals) {
        lines.push(`| ${escapeMd(it.text)} | \`${it.path || ''}\` | ${escapeMd((it.ctx.parentText || '').slice(0, 80))} |`);
      }
      lines.push('');
    }
  }
  lines.push('## 错译候选明细');
  lines.push('');
  for (const [site, pages] of Object.entries(sitePages)) {
    for (const p of pages) {
      const wrongs = (p.items || []).filter((it) => it.category === 'wrong');
      if (wrongs.length === 0) continue;
      lines.push(`### ${site} / ${p.id}`);
      lines.push('');
      lines.push('| 原文 | 位置 | 上下文 |');
      lines.push('|---|---|---|');
      for (const it of wrongs) {
        lines.push(`| ${escapeMd(it.text)} | \`${it.path || ''}\` | ${escapeMd((it.ctx.parentText || '').slice(0, 80))} |`);
      }
      lines.push('');
    }
  }
  const md = lines.join('\n');
  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, md, 'utf8');
  }
  return md;
}

function escapeMd(s) {
  return String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

// ---------- CLI ----------
function usage() {
  console.log(`用法:
  node tools/coverage-audit/audit.mjs scan --site <site> [--channel local|cloud|user] [--pages p1,p2] [--out dir]
  node tools/coverage-audit/audit.mjs scan --all [--channel auto|local|cloud|user]
  node tools/coverage-audit/audit.mjs report --out <file.md>
  node tools/coverage-audit/audit.mjs collect-script --out <file.user.js>
站点: ${Object.keys(SITES).join(', ')}`);
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  if (!cmd || cmd === '--help' || cmd === '-h') { usage(); process.exit(cmd ? 0 : 2); }

  if (cmd === 'collect-script') {
    const oi = args.indexOf('--out');
    const out = oi >= 0 ? args[oi + 1] : path.join(CACHE_DIR, 'coverage-collector.user.js');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    // 生成一个用户可注入的收集器脚本（含 @match 全部六站 + GM 桩可选）
    const script = `// ==UserScript==
// @name         FF14 幻化站汉化覆盖收集器
// @namespace    zhixia
// @version      0.1.0
// @description  收集当前页残留外文，输出到控制台（zhxAudit 对象）供复制回传。配合 coverage-audit 工具使用。
// @match        https://mirapri.com/*
// @match        https://ffxiv.eorzeacollection.com/*
// @match        https://ff14-fc.com/*
// @match        https://lookbook.ronkacloset.com/*
// @match        https://www.ffxivcollection.com/*
// @match        https://weapon.ffxivcollection.com/*
// @match        https://ff14.huijiwiki.com/wiki/*
// @grant        none
// ==/UserScript==
(function() {
  'use strict';
  const COLLECTOR = ${JSON.stringify(COLLECTOR_JS)};
  function run() {
    try {
      const items = eval(COLLECTOR);
      const classified = items.map((it) => {
        const t = it.text;
        let cat = 'unknown';
        // 客户端粗分类（详细分类在服务端做）
        if (!/[\\u3040-\\u30ff\\uac00-\\ud7af]/.test(t)) cat = 'non-residual';
        else if (/(post|comment|user|author|date|time|created)/i.test(it.ctx.cls + ' ' + it.ctx.id)) cat = 'user';
        else cat = 'residual';
        return { ...it, cat };
      });
      window.__zhxAudit = classified;
      console.log('[zhx-audit] 收集到 ' + classified.length + ' 条残留候选');
      console.log('[zhx-audit] 数据已存到 window.__zhxAudit，在控制台执行 copy(JSON.stringify(window.__zhxAudit, null, 1)) 复制');
    } catch (e) {
      console.error('[zhx-audit] 收集失败', e);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
`;
    fs.writeFileSync(out, script, 'utf8');
    console.log('收集器脚本已生成: ' + out);
    process.exit(0);
  }

  // scan 与 report 由 run-scan.mjs / run-report.mjs 实现（本文件保持纯逻辑可测）
  console.error('子命令 ' + cmd + ' 由 run-scan.mjs 实现（当前骨架）。');
  process.exit(2);
}

// 仅当直接执行本文件时才运行 CLI（被 import 时不执行）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}