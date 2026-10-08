#!/usr/bin/env node
/**
 * run-scan.mjs — coverage-audit 扫描执行器（本地 CDP + 云浏览器 + 报告）
 *
 * 用法：
 *   node tools/coverage-audit/run-scan.mjs --site fc --pages home,equip
 *   node tools/coverage-audit/run-scan.mjs --all --channel auto
 *   node tools/coverage-audit/run-scan.mjs --report --out docs/audit-xxx.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

import { SITES, COLLECTOR_JS, classifyResiduals, buildReport, CACHE_DIR, REPO_ROOT, DIST_FILE } from './audit.mjs';
import { LINKS_JS } from './coverage-collector.mjs';
import { discoverSitemapUrls } from './sitemap.mjs';
import { normalizeSiteUrl, templateKey, pairSnapshots, unmatchedHosts } from './coverage-core.mjs';
import { newPage, closePage } from '../../tests/helpers/cdp.mjs';
import { ensureChrome } from '../../tests/helpers/chrome.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- 本地 CDP 扫描 ----------
const BLOCKED_URLS = [
  '*googleapis.com*', '*gstatic.com*', '*typesquare.com*', '*cdnjs.cloudflare.com*',
  '*twitter.com*', '*valuecommerce.com*', '*doubleclick.net*', '*google-analytics*',
  '*googletagmanager.com*', '*google.com*', '*facebook.net*', '*facebook.com*',
];

const GM_STUB = `(() => {
  if (window.__gmStub) return;
  window.__gmStub = true;
  const P = 'gm:';
  window.__reqLog = [];
  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? d : v; } catch (e) { return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) { window.__setFail = (window.__setFail || 0) + 1; } };
  window.GM_xmlhttpRequest = (opt) => {
    window.__reqLog.push(opt.url);
    fetch(opt.url).then((r) => r.text().then((t) => { try { opt.onload && opt.onload({ status: r.status, responseText: t }); } catch (e) {} }))
      .catch((e) => { try { opt.onerror && opt.onerror(e); } catch (e2) {} });
  };
})();`;

const WRAP = (src) => `(function(){ try { ${src} } catch (e) { console.error('[AUDIT-INJECT]', e && e.message); } })();`;

// 数据预置：全部本地页面都需要 items 表（用仓库 data/ff14-items.tsv）
function presetDataJs(itemsTsv) {
  const FP = 'testfp000001';
  return `(() => {
    for (const k of Object.keys(localStorage)) if (k.indexOf('gm:') === 0) localStorage.removeItem(k);
    localStorage.setItem('gm:zhx.dt.items', ${JSON.stringify(FP + '\n' + itemsTsv)});
    localStorage.setItem('gm:zhx.meta', JSON.stringify({ v: 'test', t: Date.now() }));
    localStorage.setItem('gm:zhx.v3.manifest', ${JSON.stringify(String(Date.now()) + '\n' + JSON.stringify({ schema: 3, sites: {} }))});
    return 1;
  })()`;
}

/**
 * 扫描单个 URL（本地 CDP）。
 * @returns {Promise<object>} { site, pageId, url, items, error? }
 */
export async function scanUrlLocal({ site, pageId, url, itemsTsv, port = 9223, waitMs = 8000 }) {
  const t = await newPage(port, 'about:blank');
  const c = t.cdp;
  try {
    await c.send('Network.enable');
    await c.send('Network.setBlockedURLs', { urls: BLOCKED_URLS });
    // 先导航到目标站（about:blank 的 localStorage 不可用）
    await c.send('Page.navigate', { url });
    // 等待页面完全加载 + 确认在目标域上（避免重定向过渡态/错误页）
    const cfg = SITES[site];
    const expectedHosts = cfg.hosts || [cfg.host];
    let pageOk = false;
    for (let i = 0; i < 40; i++) {
      await sleep(1000);
      const st = await c.eval(`(() => {
        let lsOk = false;
        try { localStorage.getItem('probe'); lsOk = true; } catch (e) {}
        return {
          ready: document.readyState,
          len: document.body ? document.body.innerText.length : 0,
          host: location.host,
          url: location.href.slice(0, 120),
          lsOk,
        };
      })()`).catch(() => ({}));
      if (st && st.lsOk && st.ready === 'complete' && st.len > 50 && expectedHosts.includes(st.host)) {
        pageOk = true;
        break;
      }
    }
    if (!pageOk) throw new Error('页面未就绪，可能被重定向、反爬拦截或加载失败：' + url);
    // Before snapshot includes *English* UI, enabling differential auditing.
    const before = await c.eval(COLLECTOR_JS);
    const links = await c.eval(LINKS_JS).catch(() => []);
    // 现在清 localStorage + 预置数据 + 注入脚本（页面已就绪）
    await c.eval(presetDataJs(itemsTsv));
    await c.eval(GM_STUB);
    const dist = fs.readFileSync(DIST_FILE, 'utf8');
    await c.eval(WRAP(dist));
    // Data managers may not expose a public ready flag; bound the completion
    // delay and preserve the before snapshot instead of assuming no misses.
    await sleep(waitMs);
    const raw = await c.eval(COLLECTOR_JS);
    if (!Array.isArray(raw)) throw new Error('collector 未返回数组');
    return { site, pageId, url, beforeCount: before.length, items: pairSnapshots(before, raw), links, error: null, status: 'ok' };
  } finally {
    await closePage(port, t.target.id);
  }
}

// ---------- 云浏览器通道 ----------
// 云浏览器扫描通过调用既有的 Python 探针（bu-*.py）实现，此处提供调度器。
// 由于云浏览器需要 BROWSER_USE_API_KEY 且耗时较长，设计为：
//   1. 生成一个独立的云扫描脚本（python）到缓存目录
//   2. 通过 child_process 调用，收集 JSON 产物
// 简化版：先输出「需云扫描」清单，由外部脚本处理。
export function cloudScanPlan(site, opts = {}) {
  const cfg = SITES[site];
  if (!cfg) throw new Error('未知站点: ' + site);
  return {
    site,
    channel: 'cloud',
    hosts: cfg.hosts || [cfg.host],
    discover: !!opts.discover,
    maxPages: opts.maxPages || 60,
    maxDepth: opts.maxDepth ?? 2,
    perTemplate: opts.perTemplate || 3,
    pages: cfg.pages.map((p) => ({ id: p.id, url: p.url, type: p.type })),
  };
}

// ---------- 报告合并 ----------
export function loadResults(dir = CACHE_DIR) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => /^(mirapri|ec|fc|ronka|collection|wiki|endcloset)-.*\.json$/.test(f) && !f.startsWith('cloud-plan-'));
  const results = [];
  for (const f of files) {
    try { const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); if (d.site && (d.items || d.pages)) results.push(d); } catch (e) { console.error('[audit] 跳过损坏缓存:', f, e.message); }
  }
  return results;
}

export function saveResult(result, dir = CACHE_DIR) {
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${result.site}-${result.pageId || 'all'}-${Date.now()}.json`);
  fs.writeFileSync(f, JSON.stringify(result, null, 2), 'utf8');
  return f;
}

// ---------- 主流程 ----------
function usage() {
  console.log(`用法:
  node tools/coverage-audit/run-scan.mjs --site <site> [--pages p1,p2] [--port 9223] [--discover --max-pages 60 --max-depth 2 --per-template 3 --wait 8000]
  node tools/coverage-audit/run-scan.mjs --all [--channel local|cloud|auto]
  node tools/coverage-audit/run-scan.mjs --report [--out <file.md>]`);
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const i = args.indexOf(name);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
  };
  const hasFlag = (name) => args.includes(name);

  if (hasFlag('--help') || args.length === 0) { usage(); process.exit(args.length ? 0 : 2); }

  if (hasFlag('--report')) {
    const out = getArg('--out') || path.join(REPO_ROOT, 'docs', 'coverage-audit-report.md');
    const results = loadResults();
    if (results.length === 0) {
      console.error('没有可合并的扫描结果，请先运行 scan。缓存目录: ' + CACHE_DIR);
      process.exit(1);
    }
    // 分类（如果扫描时未分类）
    for (const r of results) {
      for (const p of r.pages || []) {
        if (p.items && p.items[0] && p.items[0].category === undefined) {
          p.items = classifyResiduals(p.items.map((it) => ({ ...it, site: r.site })));
        }
      }
    }
    const md = buildReport(results, { output: out });
    console.log('报告已生成: ' + out);
    console.log(md.slice(0, 2000));
    process.exit(0);
  }

  // scan 模式
  const siteArg = getArg('--site') || (hasFlag('--all') ? 'all' : null);
  const pagesArg = getArg('--pages');
  const port = Number(getArg('--port') || 9223);
  const channel = getArg('--channel') || 'auto';
  const discover = hasFlag('--discover');
  const maxPages = Math.max(1, Math.min(500, Number(getArg('--max-pages') || 60)));
  const maxDepth = Math.max(0, Math.min(5, Number(getArg('--max-depth') || 2)));
  const perTemplate = Math.max(1, Math.min(15, Number(getArg('--per-template') || 3)));
  const waitMs = Math.max(1000, Math.min(60000, Number(getArg('--wait') || 8000)));

  if (!siteArg) { usage(); process.exit(2); }

  const sites = siteArg === 'all' ? Object.keys(SITES) : [siteArg];
  const itemsTsv = fs.readFileSync(path.join(REPO_ROOT, 'data', 'ff14-items.tsv'), 'utf8');
  const header = fs.readFileSync(path.join(REPO_ROOT, 'build/userscript-header.txt'), 'utf8');
  // Never claim host coverage on a host where the released userscript cannot run.
  for (const site of sites) {
    const cfg = SITES[site];
    if (!cfg) throw new Error('未知站点：' + site);
    if (cfg.channel === 'fixture') continue;
    const missing = unmatchedHosts(cfg.hosts || [cfg.host], header);
    if (missing.length) console.warn('[audit] 缺失 @match: ' + site + ' ' + missing.join(', '));
  }

  // 确保 Chrome 可用（本地通道）
  const needLocal = sites.some((s) => {
    const ch = channel === 'auto' ? SITES[s].channel : channel;
    return ch === 'local' || ch === 'auto' && SITES[s].channel === 'local';
  });
  let chrome = null;
  if (needLocal) {
    chrome = await ensureChrome({ port });
    console.log(`Chrome 就绪（port=${port}, spawned=${chrome.spawned}）`);
  }

  const results = [];
  for (const site of sites) {
    const cfg = SITES[site];
    const ch = channel === 'auto' ? cfg.channel : channel;
    const pages = pagesArg ? cfg.pages.filter((p) => pagesArg.split(',').includes(p.id)) : cfg.pages;

    console.log(`\n===== 扫描 ${site}（通道: ${ch}）=====`);
    if (ch === 'local') {
      const hosts = cfg.hosts || [cfg.host];
      const queue = pages.filter((p) => !p.url.startsWith('fixture:')).map((p) => ({ ...p, depth: 0 }));
      if (discover && !hasFlag('--no-sitemap')) {
        const sitemapUrls = await discoverSitemapUrls({ hosts, maxUrls: Math.min(250, maxPages * 8) });
        const sampledTemplates = new Set();
        for (const url of sitemapUrls) {
          const key = templateKey(url);
          if (sampledTemplates.has(key)) continue;
          sampledTemplates.add(key);
          queue.push({ url, type: 'sitemap', depth: 1 });
          if (sampledTemplates.size >= Math.min(20, Math.floor(maxPages / 3))) break;
        }
        console.log('  Sitemap 补充页面模板：' + sampledTemplates.size);
      }
      const visited = new Set();
      const templateCounts = new Map();
      for (let n = 0; n < queue.length && visited.size < (discover ? maxPages : pages.length); n++) {
        const p = queue[n];
        const norm = normalizeSiteUrl(p.url, p.url, hosts);
        if (!norm || visited.has(norm)) continue;
        const template = templateKey(norm);
        if (discover && (templateCounts.get(template) || 0) >= perTemplate) continue;
        visited.add(norm);
        templateCounts.set(template, (templateCounts.get(template) || 0) + 1);
        console.log('  扫描 ' + (p.id || template) + ': ' + norm);
        try {
          const r = await scanUrlLocal({ site, pageId: p.id || 'discovered-' + n, url: norm, port, waitMs });
          const classified = classifyResiduals(r.items.map((it) => ({ ...it, site })));
          const result = { site, pageId: r.pageId, url: norm, template, depth: p.depth,
            items: classified, status: 'ok', beforeCount: r.beforeCount, scannedAt: new Date().toISOString() };
          const real = classified.filter((it) => it.category === 'real').length;
          const wrong = classified.filter((it) => it.category === 'wrong').length;
          console.log('    候选 ' + classified.length + '（真漏译 ' + real + '、部分翻译 ' + wrong + '）');
          saveResult(result);
          results.push(result);
          if (discover && p.depth < maxDepth) {
            for (const href of r.links || []) {
              const next = normalizeSiteUrl(href, norm, hosts);
              if (next && !visited.has(next)) queue.push({ url: next, depth: p.depth + 1 });
            }
          }
        } catch (e) {
          console.error('  扫描失败 [' + site + '/' + (p.id || norm) + ']:', e.message);
          const failed = { site, pageId: p.id || 'discovered-' + n, url: norm, template, items: [],
            status: 'failed', error: String(e.message || e), scannedAt: new Date().toISOString() };
          saveResult(failed);
          results.push(failed);
        }
      }
      console.log('  有效扫描样本 ' + results.filter((r) => r.site === site && !r.error).length +
        '，独立 URL ' + visited.size + (discover ? '；动态发现已开启' : '；仅扫描种子页'));
    } else if (ch === 'cloud') {
      console.log('  云浏览器通道：生成云扫描计划（由 bu-*.py 执行，需 BROWSER_USE_API_KEY）');
      const plan = cloudScanPlan(site, { discover, maxPages, maxDepth, perTemplate });
      console.log('  计划: ' + JSON.stringify(plan.pages.map((p) => p.id)));
      // 保存计划供云脚本读取
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(path.join(CACHE_DIR, `cloud-plan-${site}.json`), JSON.stringify(plan, null, 2), 'utf8');
      console.log(`  计划已存: ${path.join(CACHE_DIR, `cloud-plan-${site}.json`)}`);
      console.log('  ⚠️ 云扫描尚未自动执行——请运行配套 Python 脚本（后续提供）或手动用云浏览器打开页面运行收集器。');
    } else if (ch === 'fixture') {
      console.log('  Wiki: 站点中文、反查功能由离线 integration 测试覆盖，真实站点扫描需浏览器授权');
    } else {
      console.error('未知通道: ' + ch);
      process.exit(2);
    }
  }

  if (chrome && chrome.spawned && chrome.stop) {
    try { chrome.stop(); } catch (e) {}
  }

  console.log('\n扫描完成。可运行: node tools/coverage-audit/run-scan.mjs --report --out docs/coverage-audit-report.md');
}

main().catch((e) => { console.error(e); process.exit(1); });