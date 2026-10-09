// e2e-real-dict.mjs — 本地 FC 夹具从真实数据站读取 V3 manifest、站点文件与共享词典。
import fs from 'node:fs';
import http from 'node:http';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist, fixturePath } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const PROD_BASE = 'https://zhixia-data.pages.dev/ff14/v3/';
// 请求仅选择固定的数据文件；上游地址不使用请求中的路径或查询参数。
const dataFiles = ['manifest.json', 'dict.json', 'fc/names.tsv', 'fc/hash.tsv', 'fc/alias.tsv', 'fc/dup.tsv', 'fc/series.txt'];
const upstreams = new Map(dataFiles.map((file) => ['/ff14/v3/' + file, PROD_BASE + file]));
let proxied = 0;
const fixture = fs.readFileSync(fixturePath('fc-search.html'));

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/fc-search.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fixture);
    return;
  }
  const upstreamUrl = upstreams.get(url.pathname);
  if (!upstreamUrl) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  try {
    proxied++;
    const upstream = await fetch(upstreamUrl + '?e2e_refresh=' + Date.now(), { signal: AbortSignal.timeout(25000), headers: { 'Cache-Control': 'no-cache' } });
    const body = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'text/plain; charset=utf-8',
      'Cache-Control': upstream.headers.get('cache-control') || 'no-store',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Upstream request failed: ' + e.message);
  }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const serverPort = server.address().port;
const BASE = 'http://127.0.0.1:' + serverPort + '/ff14/v3/';
const GF_REAL = readDist();
const GF = GF_REAL.replace(PROD_BASE, BASE);
if (GF === GF_REAL) throw new Error('V3 DATA_BASE 替换失败');

const gmStub = [
  '(() => {',
  '  const P = "gm:";',
  '  window.__net = [];',
  '  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? d : v; } catch (e) { return d; } };',
  '  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) {} };',
  '  window.GM_xmlhttpRequest = (opt) => {',
  '    fetch(opt.url).then((r) => r.text().then((t) => {',
  '      try { window.__net.push({ url: opt.url, status: r.status, len: t.length }); } catch (e) {}',
  '      try { opt.onload && opt.onload({ status: r.status, responseText: t }); } catch (e) {}',
  '    })).catch((e) => { try { window.__net.push({ url: opt.url, status: "ERR" }); } catch (e2) {} try { opt.onerror && opt.onerror(e); } catch (e2) {} });',
  '  };',
  '})();',
].join('\n');

const wrap = (src) => '(function(){ try { ' + src + ' } catch (e) { console.error("[TEST-INJECT]", e && e.message); } })();';
let tab;
try {
  tab = await newPage(PORT, 'http://127.0.0.1:' + serverPort + '/fc-search.html');
  const c = tab.cdp;
  await c.eval("window.__zhxTestSite = 'fc'; window.__zhxTestTables = ['items','dict']; window.__zhxTestIndexes = ['nameMap','itemHash']; window.__zhxDiagOn = true;");
  await c.eval("(() => { const p=document.createElement('p'); p.textContent='装備シリーズ'; document.body.appendChild(p); return 1; })()");
  await c.eval("(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); return 1; })()");
  await c.eval(gmStub);
  await c.eval(wrap(GF));

  let ready = false;
  for (let i = 0; i < 120; i++) {
    await sleep(1000);
    const st = await c.eval("Object.keys(localStorage).some((k) => k.startsWith('gm:zhx.v3.f.fc.dict.'))").catch(() => false);
    if (st) { ready = true; break; }
  }
  await sleep(2500);

  const probe = [
    "(() => {",
    "  const raw=localStorage.getItem('gm:zhx.v3.manifest') || '';",
    "  let manifest=null; try { manifest=JSON.parse(raw.slice(raw.indexOf(String.fromCharCode(10))+1)); } catch(e) {}",
    "  const dictMeta=manifest && manifest.shared && manifest.shared.dict;",
    "  const dictKey=dictMeta ? 'gm:zhx.v3.f.fc.dict.' + dictMeta.sha256 : '';",
    "  const dictRaw=dictKey ? localStorage.getItem(dictKey) || '' : '';",
    "  const siteFiles=manifest && manifest.sites && manifest.sites.fc && manifest.sites.fc.files || {};",
    "  const fileKeys=Object.entries(siteFiles).filter(([name,meta]) => localStorage.getItem('gm:zhx.v3.f.fc.'+name+'.'+meta.sha256));",
    "  let dictInfo={}; try { const d=JSON.parse(dictRaw.slice(dictRaw.indexOf(String.fromCharCode(10))+1)); dictInfo={ layers:Object.keys(d), fcLen:d.fc ? Object.keys(d.fc).length : 0 }; } catch(e) { dictInfo={ err:String(e) }; }",
    "  const text=document.body ? document.body.innerText : '';",
    "  return { manifest, manifestCached:!!raw, dictMeta, dictCached:!!dictRaw, dictShaMatches:!!dictMeta && dictRaw.slice(0,dictRaw.indexOf(String.fromCharCode(10)))===dictMeta.sha256, dictInfo, expectedFiles:Object.keys(siteFiles).length, cachedFiles:fileKeys.length, pageTranslated:text.includes('装备系列'), net:window.__net || [] };",
    "})()",
  ].join(String.fromCharCode(10));
  const r = await c.eval(probe);
  console.log('真实数据请求数:', proxied);
  console.log('缓存 manifest:', JSON.stringify(r.manifest && { schema:r.manifest.schema, candidatePolicy:r.manifest.candidatePolicy, version:r.manifest.version, fcFiles:Object.keys(r.manifest.sites.fc.files), dictSha:r.dictMeta && r.dictMeta.sha256 }));
  console.log('缓存字典:', r.dictCached, '| SHA matches:', r.dictShaMatches, '| layers:', JSON.stringify(r.dictInfo));
  console.log('站点文件缓存:', r.cachedFiles, '/', r.expectedFiles, '| 页面译文:', r.pageTranslated);

  let pass = 0, fail = 0;
  const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); } };
  ok('R1 真 manifest 与共享 dict 元数据可读', !!r.manifest && r.manifest.schema === 3 && !!r.dictMeta && /^[a-f0-9]{64}$/i.test(r.dictMeta.sha256));
  ok('R2 V3 字典按 manifest SHA 写入缓存', r.dictCached && r.dictShaMatches);
  ok('R3 V3 站点文件均按 manifest SHA 缓存', r.expectedFiles > 0 && r.cachedFiles === r.expectedFiles, r.cachedFiles + '/' + r.expectedFiles);
  ok('R4 词典结构含 FC 词层', r.dictInfo && r.dictInfo.layers && r.dictInfo.layers.includes('fc') && r.dictInfo.fcLen > 0, JSON.stringify(r.dictInfo));
  ok('R5 页面文本已使用站点词典翻译', r.pageTranslated);
  console.log('总计: ' + pass + ' 通过 / ' + fail + ' 失败');
  process.exitCode = fail ? 1 : 0;
} finally {
  if (tab) await closePage(PORT, tab.target.id).catch(() => {});
  await new Promise((resolve) => server.close(resolve));
}
