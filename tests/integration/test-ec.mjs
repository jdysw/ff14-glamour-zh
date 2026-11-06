// EC 夹具测试：物品翻译链 5 条通道（链接/纯文本/卡片/染剂/占位符）
// 预置 items 缓存 → 快速路径（零网络）→ 数据就绪 → applyItemZh 全链路
import fs from 'node:fs';
import http from 'node:http';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { seedV3Browser, v3CacheEntries } from '../helpers/v3-cache.mjs';
import { readDist, itemsTsvPath, fixtureUrl, cachePath } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const FIXTURE = fixtureUrl('ec-page.html');

const s = readDist();
fs.writeFileSync(cachePath('gf-ec-test.user.js'), s);
const GF = s;
console.log('测试副本已生成（hook 已内建于 src）');

const gmStub = `(() => {
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

const wrap = (src) => `(function(){ try { ${src} } catch (e) { console.error('[TEST-INJECT]', e && e.message); } })();`;

const ZH = '特罗亚精准缠头巾';
const WIKI = 'https://ff14.huijiwiki.com/wiki/物品:' + encodeURIComponent(ZH);

const dump = `(() => {
  const a = document.querySelector('a.eorzeadb_link');
  const pal = document.querySelector('a.has-text-rarity-4') || document.querySelector('span.has-text-rarity-4');
  const card = document.querySelector('p.title.has-text-text.is-5');
  const dye = document.querySelector('div.tag');
  const ph = document.querySelector('input[placeholder]');
  return {
    link: a ? { text: (a.textContent || '').trim(), href: a.getAttribute('href') } : null,
    plain: pal ? { tag: pal.tagName, text: (pal.textContent || '').trim(), href: pal.getAttribute('href') } : null,
    card: card ? { text: (card.textContent || '').trim(), flag: card.dataset.zhixiaCard || '' } : null,
    barding: document.querySelector('.list-item-title')?.textContent.trim(),
    shop: (() => {
      const label = document.querySelector('.has-text-currency-name');
      return { label: label?.textContent.trim(), href: label?.closest('a')?.href };
    })(),
    dyes: [...document.querySelectorAll('div.tag, span.tag')].map((d) => (d.textContent || '').trim()),
    ph: ph ? ph.getAttribute('placeholder') : null,
    attrs: (() => { const n = document.querySelector('img.nav-ic'); return n ? { alt: n.getAttribute('alt'), aria: n.getAttribute('aria-label'), title: n.getAttribute('title') } : null; })(),
    reqUrls: (window.__reqLog || []),
  };
})()`;

const itemsTsv = fs.readFileSync(itemsTsvPath, 'utf8');
const FP = 'testfp000001';
const setCache = (k, v) => c.callFn('function (key, value) { localStorage.setItem(key, value); return 1; }', [k, v]);

const t = await newPage(PORT, FIXTURE);
const c = t.cdp;
await sleep(800);
await c.eval(`(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); return 1; })()`);
// v3 探测节流（v1.4 Phase 12）：预置 v3 manifest 缓存（本站不在其中 → v3 静默跳过；24h 内不再探测）→ 零网络成立
await c.eval("window.__zhxTestSite = 'ec';");
await seedV3Browser(c, 'ec');
await c.eval("window.__zhxTestTables = ['items'];" );
await c.eval(gmStub);
await c.eval(`(() => {
  const extra = document.createElement('p');
  extra.id = 'ec-rescan-order';
  extra.textContent = 'Troian Field Dressing of Aiming';
  document.querySelector('main').appendChild(extra);
  const gear = document.querySelector('a.eorzeadb_link');
  const observer = new MutationObserver(() => {
    if (gear.textContent.trim() !== '特罗亚精准缠头巾') return;
    window.__zhxEquipmentBeforeRescan = extra.textContent === 'Troian Field Dressing of Aiming';
    observer.disconnect();
  });
  observer.observe(gear, { childList: true, characterData: true, subtree: true });
})()`);
await c.eval(wrap(GF));
await sleep(9000);
const r = await c.eval(dump);
console.log('\n--- 结果 ---');
console.log(JSON.stringify(r, null, 1));

// 验证卡片及鸟甲名称点击，以及独立的 EC 站内反查按钮。
const nativeFilterAllowed = await c.eval(`(() => {
  window.__opened = [];
  window.open = (u) => { window.__opened.push(String(u)); return null; };
  const card = document.querySelector('p.title.has-text-text.is-5');
  if (card) card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  document.querySelector('.list-item-title').click();
  const filter = document.querySelector('.list-item-controls a');
  let allowed = false;
  filter.addEventListener('click', (event) => {
    allowed = !event.defaultPrevented;
    event.preventDefault();
  }, { once: true });
  filter.click();
  return allowed && filter.getAttribute('href') === '/companion-glamours?headPiece=88';
})()`);
await sleep(600);
const opened = await c.eval(`window.__opened || []`);
const rescanOrder = await c.eval(`({
  equipmentFirst: window.__zhxEquipmentBeforeRescan,
  bulkText: document.querySelector('#ec-rescan-order').textContent,
})`);

console.log('\n--- 断言 ---');
const checks = [
  ['① 链接文本 → 中文', r.link && r.link.text === ZH, r.link && r.link.text],
  ['① 链接 href → wiki', r.link && r.link.href === WIKI, r.link && r.link.href],
  ['② 纯文本风 span → a 标签', r.plain && r.plain.tag === 'A', r.plain && r.plain.tag],
  ['② 纯文本 → 中文', r.plain && r.plain.text === ZH, r.plain && r.plain.text],
  ['② href → wiki', r.plain && r.plain.href === WIKI, r.plain && r.plain.href],
  ['③ 卡片标题 → 中文', r.card && r.card.text === ZH, r.card && r.card.text],
  ['③ 卡片标记', r.card && r.card.flag === '1', r.card && r.card.flag],
  ['④ 染剂全名 → 中文', r.dyes && r.dyes[0] === '⬤ 深渊蓝染剂', r.dyes && r.dyes[0]],
  ['④b 色名回退 → 中文', r.dyes && r.dyes[1] === '⬤ 油墨蓝染剂', r.dyes && r.dyes[1]],
  ['⑤ 占位符 → 中文', r.ph === '按标题搜索', r.ph],
  ['⑥ 零网络（缓存路径）', r.reqUrls.length === 0, JSON.stringify(r.reqUrls)],
  ['⑦ 卡片点击 → 灰机 wiki', opened.length >= 1 && opened[0] === WIKI, JSON.stringify(opened)],
  ['⑧ alt 属性 → 加载中…', r.attrs && r.attrs.alt === '加载中…', JSON.stringify(r.attrs)],
  ['⑨ aria-label 属性 → 第 2 页', r.attrs && r.attrs.aria === '第 2 页', JSON.stringify(r.attrs)],
  ['⑩ title 属性 → 5 点赞', r.attrs && r.attrs.title === '5 点赞', JSON.stringify(r.attrs)],
  ['鸟甲名称 → 中文', r.barding === '海岛开拓者装甲', r.barding],
  ['鸟甲名称点击 → 灰机 wiki', opened.length === 2 &&
    opened[1] === 'https://ff14.huijiwiki.com/wiki/物品:' + encodeURIComponent('海岛开拓者装甲'), opened],
  ['鸟甲站内反查按钮保留原行为', nativeFilterAllowed, nativeFilterAllowed],
  ['货币名称汉化并保留商店链接', r.shop?.label === '天穹街振兴票' &&
    r.shop?.href === 'https://na.finalfantasyxiv.com/lodestone/playguide/db/shop/1bb8b3193e9', r.shop],
  ['装备链接先翻译，随后完成全页补扫', rescanOrder.equipmentFirst === true &&
    rescanOrder.bulkText === ZH, rescanOrder],
];
let pass = 0;
for (const [name, ok, got] of checks) {
  console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : '  实际: ' + JSON.stringify(got)));
  if (ok) pass++;
}
console.log(`\n${pass}/${checks.length} 通过`);
console.log('\nconsole:', c.consoleLines.filter((l) => (l.includes('汉化') || l.includes('幻化') || l.includes('TEST'))).join(' | ').slice(0, 900));
await closePage(PORT, t.target.id);

// 真实新文档注入：词库请求挂起时，首轮界面翻译仍应在 DOMContentLoaded 完成。
const early = await newPage(PORT);
let earlyPassed = false;
try {
  await early.cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__zhxTestSite = 'ec';
    window.GM_getValue = () => {
      window.__zhxPrefetchState ??= document.readyState;
      return null;
    };
    window.GM_xmlhttpRequest = (request) => {
      window.__zhxFailData = () => request.onerror();
    };
    ${wrap(GF)}
    document.addEventListener('DOMContentLoaded', () => {
      window.__zhxEarlySnapshot = {
        placeholder: document.querySelector('input').placeholder,
        prefetchState: window.__zhxPrefetchState,
        waitingForData: typeof window.__zhxFailData === 'function',
        visible: getComputedStyle(document.body).visibility === 'visible'
          && getComputedStyle(document.body).display !== 'none',
      };
    }, { once: true });
  ` });
  const loaded = new Promise(resolve => early.cdp.on('Page.loadEventFired', resolve));
  await early.cdp.send('Page.navigate', { url: FIXTURE });
  await loaded;
  const snapshot = await early.cdp.eval('window.__zhxEarlySnapshot');
  const afterFailure = await early.cdp.eval(`(async () => {
    window.__zhxFailData?.();
    await new Promise(resolve => setTimeout(resolve, 0));
    return document.querySelector('input').placeholder;
  })()`);
  earlyPassed = GF.includes('@run-at       document-start')
    && snapshot?.prefetchState === 'loading' && snapshot.waitingForData
    && snapshot.placeholder === '按标题搜索' && snapshot.visible
    && afterFailure === '按标题搜索';
  console.log(earlyPassed ? '✅ 文档开始预取，DOM 就绪即汉化；词库失败时保留界面翻译'
    : '❌ 早期启动或词库失败回退异常', snapshot, afterFailure);
} finally {
  await closePage(PORT, early.target.id);
}

// 保持 defer 脚本挂起，使用各站真实样式的节点验证共享提前观察器。
async function withParsingSite(site, markup, verify) {
  let unblock;
  const gate = new Promise(resolve => { unblock = resolve; });
  const server = http.createServer(async (req, res) => {
    if (req.url === '/gate.js') {
      await gate;
      res.writeHead(200, { 'Content-Type': 'application/javascript' }).end('');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      .end('<!doctype html><script defer src="/gate.js"></script>' + markup);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let streaming;
  try {
    streaming = await newPage(PORT);
    const { cdp } = streaming;
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.__zhxTestSite = ${JSON.stringify(site)};
      window.__zhxDiagOn = true;
      const local = new Map(Object.entries(${JSON.stringify(v3CacheEntries(site))}));
      window.GM_getValue = (key, fallback) => local.get(key) ?? fallback;
      window.addEventListener('DOMContentLoaded', () => { window.__fixtureDomReady = true; });
      ${wrap(GF)}
    ` });
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port + '/glamour/339340' });
    const waitForTranslation = (selector, name = ZH) => cdp.callFn(`async function (selector, name) {
    for (let i = 0; i < 80; i++) {
      if (document.querySelector(selector)?.textContent === name) return true;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    return false;
    }`, [selector, name]);
    return await verify(cdp, waitForTranslation, unblock);
  } finally {
    unblock();
    if (streaming) await closePage(PORT, streaming.target.id);
    await new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
}

const streamingPassed = await withParsingSite('ec', `
  <a id="first" class="eorzeadb_link">Troian Field Dressing of Aiming</a>
  <a id="split" class="eorzeadb_link" href="https://eu.finalfantasyxiv.com/lodestone/playguide/db/item/0000c0de7ff/">Troian Field</a>
  <div class="v-select"><a id="option" class="eorzeadb_link">Troian Field Dressing of Aiming</a></div>
`, async (cdp, waitForTranslation, unblock) => {
  const first = await waitForTranslation('#first');
  const partial = await cdp.eval(`(() => {
    const split = document.querySelector('#split');
    const before = split.textContent;
    split.firstChild.appendData(' Dressing of Aiming');
    return before;
  })()`);
  const completed = await waitForTranslation('#split');
  const state = await cdp.eval(`({
    ready: Boolean(window.__fixtureDomReady),
    option: document.querySelector('#option').textContent,
    href: document.querySelector('#split').getAttribute('href'),
  })`);
  unblock();
  const loaded = await cdp.eval(`(async () => {
    for (let i = 0; i < 80 && !window.__fixtureDomReady; i++) {
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    const link = document.createElement('a');
    link.id = 'after-ready';
    link.className = 'eorzeadb_link';
    link.textContent = 'Troian Field Dressing of Aiming';
    document.body.appendChild(link);
    return Boolean(window.__fixtureDomReady);
  })()`);
  const afterReady = await waitForTranslation('#after-ready');
  const ok = first && partial === 'Troian Field' && completed && !state.ready
    && state.option === 'Troian Field Dressing of Aiming' && state.href === WIKI && loaded && afterReady;
  console.log(ok ? '✅ 装备完整出现即翻译，筛选项安全，DOM 就绪后常规翻译接续'
    : '❌ 早期装备翻译失败', { first, partial, completed, ...state, loaded, afterReady });
  return ok;
});

const japanese = 'トロイアン・レンジャーバンデージ';
let sharedPassed = true;
for (const [site, markup] of [
  ['mirapri', `<a id="first" class="eorzeadb_link">${japanese}</a>`],
  ['fc', `<a id="first" href="/equipment/38171/">${japanese}</a>`],
  ['collection', `<div class="item-name"><p id="first">${japanese}</p></div>`],
]) {
  const ok = await withParsingSite(site, markup, async (cdp, waitForTranslation) => {
    return await waitForTranslation('#first') && await cdp.eval('!window.__fixtureDomReady');
  });
  console.log(`${ok ? '✅' : '❌'} ${site} 装备名在 DOMContentLoaded 前翻译`);
  sharedPassed &&= ok;
}

const spaPassed = await withParsingSite('miramiru', '<div id="first">Kupo Jacket</div>',
  async (cdp, waitForTranslation, unblock) => {
    const before = await cdp.eval(`(async () => {
      for (let i = 0; i < 80; i++) {
        if (window.__zhxDiagRecord?.().marks.ready && document.querySelector('#first')) break;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      return {
        dataReady: Boolean(window.__zhxDiagRecord?.().marks.ready),
        domReady: Boolean(window.__fixtureDomReady),
        name: document.querySelector('#first')?.textContent,
      };
    })()`);
    unblock();
    const after = await waitForTranslation('#first', '库啵外套');
    const ok = before.dataReady && !before.domReady && before.name === 'Kupo Jacket' && after;
    console.log(ok ? '✅ Miramiru 等正常启动后再翻译服务器节点'
      : '❌ Miramiru 启动边界不符', { before, after });
    return ok;
  });
process.exitCode = pass === checks.length && earlyPassed && streamingPassed && sharedPassed && spaPassed ? 0 : 1;
