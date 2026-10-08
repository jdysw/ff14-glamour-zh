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
import { COLLECTOR_JS } from './coverage-collector.mjs';
import { classifyChangedText, coverageStats, latestResults } from './coverage-core.mjs';
export { COLLECTOR_JS };
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
    hosts: ['www.ffxivcollection.com', 'weapon.ffxivcollection.com'],
    pages: [
      { id: 'home', url: 'https://www.ffxivcollection.com/', type: 'home' },
      { id: 'weapon', url: 'https://weapon.ffxivcollection.com/', type: 'list' },
    ],
  },
  endcloset: {
    name: 'endcloset',
    label: 'EndCloset（韩服幻化站）',
    host: 'end-closet.com',
    channel: 'local',
    pages: [
      { id: 'home', url: 'https://end-closet.com/', type: 'home' },
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

// Known Japanese UI text can consist entirely of Han ideographs (e.g. 検索 or 検索).
// Source dictionaries disambiguate them without misclassifying arbitrary Chinese words.
const KNOWN_KANJI_UI = new Set();
for (const name of ['dict-common', 'dict-main', 'dict-fc', 'dict-acl']) {
  try {
    const dict = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'dict', name + '.json'), 'utf8'));
    for (const [foreign, zh] of Object.entries(dict.entries || {})) {
      if (/^[\\u3400-\\u9fff]{2,30}$/.test(foreign) && foreign !== zh && /^[\\u3400-\\u9fff]/.test(zh)) KNOWN_KANJI_UI.add(foreign);
    }
  } catch (e) { throw new Error('无法读取汉化权威词典 ' + name + ': ' + e.message); }
}

// ---------- 残留检测 ----------
// 日文假名（平/片）
const JA_RE = /[\u3040-\u30ff]/;
// 韩文音节/谚文字母
const KO_RE = /[\uac00-\ud7af\u1100-\u11ff]/;
// 全角片假名/平假名以外的日文符号（长音符等）
const JA_KANA_ONLY_RE = /[\u3040-\u30ff]/;

/**
 * Non-Latin script residuals are always candidates. English must also be
 * classified at the UI target level (otherwise posts, player names and gear
 * names flood the report). This is intentionally recall-first for UI controls.
 */
export function isResidual(text, ctx = {}) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (JA_RE.test(t) || KO_RE.test(t)) return true;
  if (ctx.ui && KNOWN_KANJI_UI.has(t) && (!ctx.site || ['mirapri', 'fc', 'collection'].includes(ctx.site))) return true;
  if (!/[A-Za-z]{2}/.test(t) || !ctx.ui || t.length > 100) return false;
  if (ctx.kind === 'document:title' || ctx.kind === 'attr:alt') return false;
  // Latin letters used in Chinese UI are generally identifiers/abbreviations,
  // but an untranslated English phrase beside Chinese remains a candidate.
  const hanCount = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinCount = (t.match(/[A-Za-z]/g) || []).length;
  return !hanCount || latinCount >= 6;
}

export function classify(text, ctx = {}) {
  const t = String(text || '').trim();
  if (!t || !isResidual(t, ctx)) return CATEGORY.OK;
  if (isAdContext(ctx)) return CATEGORY.AD;
  if (isUserContent(t, ctx)) return CATEGORY.USER;
  if (isExempt(t, ctx)) return CATEGORY.EXEMPT;
  if (isKnownLimit(t, ctx)) return CATEGORY.KNOWN;
  // Only label partially translated text when we have source and output
  // evidence; Japanese kanji must never be interpreted as Chinese by itself.
  if (classifyChangedText(t, ctx.before) === 'partial' ||
      classifystatechange(t, ctx.before)) return CATEGORY.WRONG;
  return CATEGORY.REAL;
}
function classifystatechange(t, before) {
  return before != null && before !== t && /[A-Za-z]{2}/.test(t) && /[\u4e00-\u9fff]/.test(t);
}
function isUserContent(t, ctx) {
  if (ctx.user) return true;
  const cls = [ctx.cls, ctx.id, ctx.ancestors].join(' ');
  if (/(glamour.*(author|title|description)|post[-_](title|author|content)|comment[-_](text|body)|nickname|username|player-name|user-content)/i.test(cls)) return true;
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(t)) return true;
  return !ctx.ui && t.length > 160;
}
function isAdContext(ctx) {
  if (ctx.ad) return true;
  const cls = [ctx.cls, ctx.id, ctx.ancestors].join(' ');
  return /(adsbygoogle|google-anno|aswift|google-ads|ad-slot|adunit|ad-container|ad-banner|affiliate|sponsor)/i.test(cls);
}
function isExempt(t, ctx) {
  if (SERVER_NAMES.has(t)) return true;
  if (/^[A-Z][A-Za-z ]{1,40}$/.test(t) && /(server|world)/i.test(ctx.cls || '')) return true;
  for (const re of EXEMPT_PATTERNS) if (re.test(t)) return true;
  return false;
}
function isKnownLimit(t, ctx) {
  // Long descriptive image captions are not authored UI strings. Do NOT
  // silently waive FC partial strings; those are exactly what we want to fix.
  return ctx.kind === 'attr:alt' && t.length > 100;
}

// ---------- 收集器：可见文本 + 属性 ----------
/**
 * 生成在页面上下文执行的收集器 JS（返回残留候选数组）。
 * 会被注入到真实页面（本地 CDP / 云浏览器 / 用户浏览器）。
 */
// ---------- 报告 ----------
export function classifyResiduals(items) {
  return items.map((it) => {
    const text = it.text;
    const cat = classify(text, { ...it.ctx, site: it.site, kind: it.kind, before: it.before });
    return { ...it, category: cat, categoryLabel: CATEGORY_LABEL[cat] };
  });
}

export function buildReport(results, { output } = {}) {
  // Reduce cached history to the newest result per page; never double count.
  results = latestResults(results);
  const stats = coverageStats(results);
  const lines = [];
  lines.push('# 汉化覆盖审计报告');
  lines.push('');
  lines.push(`- 生成时间：${new Date().toISOString()}`);
  lines.push(`- 覆盖站点：${[...new Set(results.map((r) => r.site))].join(', ')}`);
  lines.push('');
  lines.push('## 扫描质量与覆盖');
  lines.push('');
  lines.push('- 已扫描页面：' + stats.pages + '；成功：' + stats.completed + '；失败：' + stats.failed);
  lines.push('- 已涉及页面模板：' + stats.templateCount + '；外文 UI 真漏译候选：' + stats.untranslated + '（其中纯英文：' + stats.english + '）；部分翻译候选：' + stats.wrong);
  lines.push('- 注意：这是已扫描样本覆盖，不代表整站覆盖率；失败页不计作零漏译。');
  lines.push('');
  if (stats.failed) {
    lines.push('### 扫描失败页面');
    lines.push('');
    for (const r of results.filter((r) => r.error || r.status === 'failed')) lines.push('- ' + r.site + ' / ' + (r.pageId || 'page') + ': ' + (r.error || '扫描失败'));
    lines.push('');
  }
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
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
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
// @match        https://end-closet.com/*
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