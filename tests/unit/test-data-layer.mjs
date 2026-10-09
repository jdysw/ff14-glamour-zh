// Lookup layer goldens with indexes prebuilt from Runtime Data v3 files.
import { readDist } from '../helpers/paths.mjs';
import { readRuntimeV3 } from '../helpers/v3-cache.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); } };
const eq = (name, actual, expected) => ok(name, actual === expected, '实际=' + JSON.stringify(actual) + ' 期望=' + JSON.stringify(expected));
const DIST = readDist();
function extractFn(name) {
  const start = DIST.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('function not found: ' + name);
  let depth = 0;
  for (let i = start; i < DIST.length; i++) {
    if (DIST[i] === '{') depth++;
    else if (DIST[i] === '}' && --depth === 0) return DIST.slice(start, i + 1);
  }
  throw new Error('unclosed function: ' + name);
}
const all = readRuntimeV3('mirapri');
const wiki = readRuntimeV3('wiki');
const single = (text) => {
  const out = Object.create(null);
  for (const line of String(text || '').split(/\r?\n/)) {
    const p = line.split('\t');
    if (p[0] && p[1] !== undefined && out[p[0]] === undefined) out[p[0]] = p[1];
  }
  return out;
};
const nameMap = single(all.siteFiles.names.text);
const itemHash = single(all.siteFiles.hash.text);
const ecidMap = single(wiki.siteFiles.ecid.text);
const koByZh = single(wiki.siteFiles.ko.text);
Object.assign(nameMap, {
  'Fire Shard': '火之碎晶', Gil: '金币', 'ギル': '金币', '길': '金币',
  'Test Armor A': '测试甲', 'No hash gear': '测试乙',
});
Object.assign(itemHash, { aaa111aaa11: '测试甲', ddd111ddd11: '同名甲' });
Object.assign(ecidMap, { 测试甲: '9001', 测试乙: '9002' });
Object.assign(koByZh, { 测试乙: '테스트B' });

const DATA_TEXT = { series: '', acl: '' };
let _seriesMap;
const _getSeriesMap = () => {
  if (_seriesMap) return _seriesMap;
  _seriesMap = new Map();
  for (const line of DATA_TEXT.series.split('\n')) {
    const i = line.indexOf('|');
    if (i > 0) _seriesMap.set(line.slice(0, i), line.slice(i + 1));
  }
  return _seriesMap;
};
const cacheGuard = (cache, limit) => {
  const count = cache instanceof Map ? cache.size : Object.keys(cache).length;
  if (count < limit) return false;
  if (cache instanceof Map) cache.clear();
  else for (const k of Object.keys(cache)) delete cache[k];
  return true;
};
const CACHE_CAP_LOOKUP = 5000;
const _en2zhCache = new Map(), _jp2zhCache = new Map();
const RONKA_ITEM_CACHE = Object.create(null);
let _ronkaCacheN = 0;
const _irStats = { hit: 0, miss: 0 };
const tryEnToZh = extractFn('tryEnToZh');
const lookupJp2Zh = extractFn('lookupJp2Zh');
const _stripSeriesHit = extractFn('_stripSeriesHit');
const _mutualPrefix = extractFn('_mutualPrefix');
const _prefixBest = extractFn('_prefixBest');
const lookupSeries = extractFn('lookupSeries');
const ronkaItemLookup = extractFn('ronkaItemLookup');
const resolveByHash = extractFn('resolveByHash');
const resolveByName = extractFn('resolveByName');
const resolveEcId = extractFn('resolveEcId');
const resolveKo = extractFn('resolveKo');
const resolve = extractFn('resolve');
const lookupZh = extractFn('lookupZh');
const lookupAclCfc = extractFn('lookupAclCfc');
const _irAliasMap = null;
const resolveAlias = () => [];
const hrefStub = (href) => ({ getAttribute: (name) => name === 'href' ? href : null });
const f = new Function(
  'nameMap','itemHash','ecidMap','koByZh','DATA_TEXT','_getSeriesMap','cacheGuard','CACHE_CAP_LOOKUP',
  '_en2zhCache','_jp2zhCache','RONKA_ITEM_CACHE','_ronkaCacheN','_irStats','_irAliasMap','resolveAlias',
  [
    tryEnToZh, lookupJp2Zh, _stripSeriesHit, _mutualPrefix, _prefixBest, lookupSeries, ronkaItemLookup,
    resolveByHash, resolveByName, resolveEcId, resolveKo, resolve, lookupZh, lookupAclCfc,
    'return { tryEnToZh, lookupJp2Zh, lookupSeries, ronkaItemLookup, resolveByHash, resolveByName, resolveEcId, resolveKo, lookupZh, lookupAclCfc, caches: () => ({en:_en2zhCache.size,jp:_jp2zhCache.size,ronka:Object.keys(RONKA_ITEM_CACHE).length}) };',
  ].join('\n'),
);
const api = f(nameMap,itemHash,ecidMap,koByZh,DATA_TEXT,_getSeriesMap,cacheGuard,CACHE_CAP_LOOKUP,_en2zhCache,_jp2zhCache,RONKA_ITEM_CACHE,_ronkaCacheN,_irStats,_irAliasMap,resolveAlias);

console.log('\n── V3 lookup layer: name/hash/wiki/ronka ──');
eq('tryEnToZh V3 name hit', api.tryEnToZh('Fire Shard'), '火之碎晶');
eq('tryEnToZh missing → null', api.tryEnToZh('__必然缺失__'), null);
eq('tryEnToZh null input → null', api.tryEnToZh(null), null);
{
  const n=api.caches().en;
  api.tryEnToZh('__negative-cache__'); api.tryEnToZh('__negative-cache__');
  eq('tryEnToZh negative cache stores one miss', api.caches().en, n+1);
}
{
  api.tryEnToZh('Fire Shard'); api.tryEnToZh('Gil');
  const n=api.caches().en;
  api.tryEnToZh('Fire Shard'); api.tryEnToZh('Gil');
  eq('tryEnToZh cache hits do not grow cache', api.caches().en, n);
}
eq('lookupJp2Zh V3 name hit', api.lookupJp2Zh('ギル'), '金币');
eq('lookupJp2Zh >80 chars → null', api.lookupJp2Zh('x'.repeat(81)), null);
{
 const n=api.caches().jp; api.lookupJp2Zh('y'.repeat(81));
 eq('lookupJp2Zh long input is not cached', api.caches().jp, n);
}
eq('resolveEcId hit (string)', api.resolveEcId('测试甲'), '9001');
eq('resolveKo hit', api.resolveKo('测试乙'), '테스트B');
eq('resolveKo missing → null', api.resolveKo('__missing__'), null);

console.log('\n── V3 hash priority and URL parsing ──');
eq('matching lodestone hash beats conflicting name', api.lookupZh(hrefStub('https://x/lodestone/playguide/db/item/aaa111aaa11'), 'Gil'), '测试甲');
eq('nonhex hash segment falls back to name', api.lookupZh(hrefStub('https://x/lodestone/playguide/db/item/hashAAA'), 'Gil'), '金币');
eq('unrelated URL falls back to name', api.lookupZh(hrefStub('https://x/other'), 'ギル'), '金币');
eq('null element still resolves by name', api.lookupZh(null, 'Test Armor A'), '测试甲');
eq('all inputs missing → null', api.lookupZh(null, '__名無し__'), null);

console.log('\n── Ronka negative lookup cache ──');
eq('Korean name lookup uses V3 index', api.ronkaItemLookup('길'), '金币');
{
 const n=api.caches().ronka;
 api.ronkaItemLookup('__rk_miss__'); api.ronkaItemLookup('__rk_miss__');
 eq('Ronka miss is cached once', api.caches().ronka, n+1);
}

console.log('\n── V3 series and ACL side files ──');
DATA_TEXT.series = '\n' + [
  'ファントムヴィジョン・ディフェンダー|幻境意象御敌',
  'プレフィックステスト|前缀测试',
  'スカイスチール・ディフェンダー|天钢御敌',
].join('\n');
eq('series exact lookup', api.lookupSeries('ファントムヴィジョン・ディフェンダー'), '幻境意象御敌');
eq('series part removal lookup', api.lookupSeries('ファントムヴィジョン・ディフェンダー・改'), '幻境意象御敌');
eq('series prefix lookup', api.lookupSeries('プレフィックステ'), '前缀测试');
eq('series one-char query → null', api.lookupSeries('プ'), null);
eq('series >60 chars → null', api.lookupSeries('あ'.repeat(61)), null);
DATA_TEXT.acl = '\nアク・モーン|阿卡蒙\nテストダンジョン|测试副本\nトリム枠|  留白名  ';
eq('ACL exact hit', api.lookupAclCfc('テストダンジョン'), '测试副本');
eq('ACL trims value', api.lookupAclCfc('トリム枠'), '留白名');
eq('ACL partial key miss', api.lookupAclCfc('テス'), null);
DATA_TEXT.acl = 'アク・モーン|阿卡蒙\nテストダンジョン|测试副本';
eq('ACL first line requires leading newline', api.lookupAclCfc('アク・モーン'), null);
eq('ACL later line remains available', api.lookupAclCfc('テストダンジョン'), '测试副本');

console.log('\n── Generator-owned V3 dye expansion ──');
{
 const en = readRuntimeV3('ec');
 const names=single(en.siteFiles.names.text);
 const dye=names['Snow White Dye'], base=names['Snow White'];
 ok('V3 EC fixture includes English dye and its base mapping', !!dye && base===dye, 'dye='+dye+' base='+base);
}

console.log('\n── Canonical V3 data sample ──');
{
 const entries=Object.entries(nameMap).filter(([native,zh])=>native && zh);
 ok('real V3 name index has large canonical set', entries.length > 45000, 'count='+entries.length);
 const [native,zh]=entries[0];
 eq('real V3 first name mapping is queryable', api.resolveByName(native), zh);
}
console.log('通过 '+pass+' / 失败 '+fail);
if(fail)process.exit(1);
console.log('✅ test-data-layer通过');
