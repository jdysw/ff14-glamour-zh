// test-fc-pages.mjs — fc 站子页测试（v1.1.3）
// 页1 equipment_series_search：系列名完整汉化（7/7「幻境意象」、无「ファントム」残留）
// 页2 equipment/phantom_vision_of_casting：装备名汉化 + 「远程ャー」截断回归 + 灰机链接正确性
import fs from 'node:fs';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist } from '../helpers/paths.mjs';

const PORT = Number(process.env.ZHX_CDP_PORT || 9223);
const GF = readDist();

const gmStub = `(() => {
  if (window.__gmStub) return;
  window.__gmStub = true;
  const P = 'gm:';
  window.GM_getValue = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? d : v; } catch (e) { return d; } };
  window.GM_setValue = (k, v) => { try { localStorage.setItem(P + k, String(v)); } catch (e) {} };
  window.GM_xmlhttpRequest = (opt) => {
    fetch(opt.url).then((r) => r.text().then((t) => { try { opt.onload && opt.onload({ status: r.status, responseText: t }); } catch (e) {} }))
      .catch((e) => { try { opt.onerror && opt.onerror(e); } catch (e2) {} });
  };
})();`;

const wrap = (src) => `(function(){ try { ${src} } catch (e) { console.error('[TEST-INJECT]', e && e.message); } })();`;

async function bootPage(url) {
  const t = await newPage(PORT, 'about:blank');
  const c = t.cdp;
  await c.send('Network.enable');
  await c.send('Network.setBlockedURLs', {
    urls: ['*googleapis.com*', '*gstatic.com*', '*typesquare.com*', '*cdnjs.cloudflare.com*',
           '*twitter.com*', '*valuecommerce.com*', '*doubleclick.net*', '*google-analytics*',
           '*googletagmanager*', '*google.com*', '*facebook.net*', '*facebook.com*'],
  });
  await c.send('Page.navigate', { url });
  let bodyOk = false;
  for (let i = 0; i < 25; i++) {
    await sleep(3000);
    const st = await c.eval(`(() => ({ len: document.body ? document.body.innerText.length : 0 }))()`).catch(() => ({}));
    if (st && st.len > 50) { bodyOk = true; break; }
  }
  if (!bodyOk) console.log('  ⚠️ body 等待超时');
  await c.eval(`(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('gm:')) localStorage.removeItem(k); return 1; })()`);
  await c.eval(gmStub);
  await c.eval(wrap(GF));
  for (let i = 0; i < 50; i++) {
    await sleep(1500);
    const st = await c.eval(`({ jp: !!localStorage.getItem('gm:zhx.dt.items'), se: !!localStorage.getItem('gm:zhx.dt.series') })`).catch(() => ({}));
    if (st && st.jp && st.se) return { t, c };
  }
  return { t, c };
}

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); } };

// ═══ 页1：系列搜索页 ═══
console.log('╔══ 页1: equipment_series_search ══╗');
{
  const { t, c } = await bootPage('https://ff14-fc.com/equipment_series_search/');
  console.log('  数据就绪 ✓，等补扫 ...');
  await sleep(8000);
  const r = await c.eval(`(() => {
    const h4s = [...document.querySelectorAll('h4')].map((x) => (x.textContent || '').trim());
    const phantom = h4s.filter((s) => s.indexOf('ファントム') >= 0);
    const imag = h4s.filter((s) => s.indexOf('幻境意象') >= 0);
    const kanaH4 = h4s.filter((s) => /[\u30A1-\u30FA\u30FD\u30FE]/.test(s));
    return { total: h4s.length, phantom, imagCount: imag.length, imagList: imag.slice(0, 8), kanaH4: kanaH4.slice(0, 10) };
  })()`);
  console.log('  H4 总数:', r.total, '｜「幻境意象」:', r.imagCount, '｜「ファントム」残留:', JSON.stringify(r.phantom));
  ok('系列名 7/7 完整汉化（幻境意象××）', r.imagCount === 7, `实际 ${r.imagCount}: ${JSON.stringify(r.imagList)}`);
  ok('无「ファントム」残留系列名', r.phantom.length === 0, JSON.stringify(r.phantom));
  // v1.1.6：全量 H4 扫描——不应有残留假名系列名（物品表前缀推导的回归锚）
  ok('全部 H4 无残留假名系列名（v1.1.6 前缀推导）', r.kanaH4.length === 0, JSON.stringify(r.kanaH4));
  await closePage(PORT, t.target.id);
}

// ═══ 页2：装备详情页 ═══
console.log('╔══ 页2: equipment/phantom_vision_of_casting ══╗');
{
  const { t, c } = await bootPage('https://ff14-fc.com/equipment/phantom_vision_of_casting/');
  console.log('  数据就绪 ✓，等补扫 ...');
  await sleep(8000);
  const r = await c.eval(`(() => {
    const T = document.body ? document.body.innerText : '';
    // 截断残留检测（U+30FB 或 U+00B7 后接「ャー」「ジ」等残片）
    const trunc = (T.match(/远程ャー|远程ャ|レジャ/g) || []).length;
    // 「幻境意象」出现次数（全文）
    const imagCount = (T.match(/幻境意象/g) || []).length;
    // 灰机链接（指向 物品:幻境意象…）
    const wikiLinks = [...document.querySelectorAll('a[href*="huijiwiki.com"]')]
      .filter((a) => /物品:(%E7%89%A9%E5%93%81:)?/.test(a.getAttribute('href') || ''))
      .map((a) => (a.textContent || '').trim());
    const phLeft = (T.match(/ファントムヴィジョン/g) || []).length;
    return { trunc, imagCount, wikiCount: wikiLinks.length, wikiSample: wikiLinks.slice(0, 6), phLeft };
  })()`);
  console.log('  「幻境意象」出现:', r.imagCount, '次｜灰机链接:', r.wikiCount, '个');
  console.log('  灰机链接样本:', JSON.stringify(r.wikiSample));
  console.log('  「ファントムヴィジョン」残留:', r.phLeft, '处（长标题中）');
  ok('「ファントムヴィジョン」残留 = 0（系列前缀推导）', r.phLeft === 0, `实际 ${r.phLeft}`);
  ok('「远程ャー」截断残留 = 0', r.trunc === 0, `实际 ${r.trunc}`);
  ok('装备名「幻境意象」≥ 40 处', r.imagCount >= 40, `实际 ${r.imagCount}`);
  ok('灰机物品链接 ≥ 5 个', r.wikiCount >= 5, `实际 ${r.wikiCount}`);
  // 精确校验第一个链接的中文名完整性（含对应装备名，非残缺）
  const first = r.wikiSample[0] || '';
  ok('首个灰机链接为完整中文装备名', /^幻境意象[^\u3040-\u30ff]+$/.test(first), JSON.stringify(first));
  await closePage(PORT, t.target.id);
}

console.log(`\n═══ 结果: ${pass} 通过 / ${fail} 失败 ═══`);
process.exit(fail ? 1 : 0);
