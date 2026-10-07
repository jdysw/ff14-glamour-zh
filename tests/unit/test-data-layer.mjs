// tests/unit/test-data-layer.mjs — Phase 2：冻结数据层行为（golden tests）
//
// 目的：把「物品总表解析 + 各查询路径」的当前行为用「现有输入 → 现有输出」的断言钉死。
//       后续 ItemResolver 重构（Phase 6）必须保持这些行为不变，除非有明确的独立业务变更。
//
// 机制：从构建产物（dist）中按锚点"提取"数据层代码段，在 Node 里装配成可调用装置
//       （数据层函数不依赖 DOM）。因此本文件不依赖 Chrome / 外网，秒级运行。
//
// 注意：
//   - 提取锚（ANCHORS）随 src 结构变化会失配并明确报错——届时按新结构更新锚点即可（这是有意的哨兵）。
//   - buildTables 依赖 MessageChannel，其端口不会关闭，会持有事件循环 → 本文件结尾必须 process.exit。
//   - 数据输入：手写 fixture（机制级用例）+ data/ff14-items.tsv 与 data/ff14-series.txt（真实数据现取，不手抄）。
//
// 运行：node tests/unit/test-data-layer.mjs   （或 npm run test:unit）
import fs from 'node:fs';
import path from 'node:path';
import { readDist, itemsTsvPath, dataDirPath } from '../helpers/paths.mjs';

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};
const eq = (name, actual, expected) => ok(name, actual === expected,
  `实际=${JSON.stringify(actual)} 期望=${JSON.stringify(expected)}`);

// ─────────────────────────────────────────────────────────────
// 提取装置：从 dist 按锚点切出数据层代码段并装配
// ─────────────────────────────────────────────────────────────
const DIST_TEXT = readDist();

const ANCHORS = {
  regionStart: '/* @zhixia:data-layer-start */',
  regionEnd: '/* @zhixia:data-layer-end */',
  en2zhStart: 'const _en2zhCache = new Map();',
  en2zhEnd: 'function trEC(text) {',
  jp2zhStart: 'const _jp2zhCache = new Map();',
  jp2zhEnd: '// ── 系列名前缀查找（v1.12.0）',
  seriesStart: '// ── 系列名前缀查找（v1.12.0）',
  seriesEnd: 'const FC_ROLE_ZH = {',
  ronkaCacheStart: 'const RONKA_ITEM_CACHE = Object.create(null);',
  ronkaCacheEnd: '// 逐条翻译：',
  lookupZhStart: 'function lookupZh(a, name) {',
  lookupZhEnd: '/* ── 通用工具层',
  aclStart: 'function lookupAclCfc(ja) {',
  aclEnd: 'const ACL_SKIP_SEL',
};

function sliceBetween(s, a, b) {
  const i = s.indexOf(a);
  if (i < 0) throw new Error(`锚缺失：${a.slice(0, 44)}（src 结构可能已变化，请更新 ANCHORS）`);
  if (s.indexOf(a, i + 1) >= 0) throw new Error(`锚不唯一：${a.slice(0, 44)}`);
  const j = s.indexOf(b, i + a.length);
  if (j < 0) throw new Error(`尾锚缺失：${b.slice(0, 44)}（src 结构可能已变化，请更新 ANCHORS）`);
  return s.slice(i, j);
}

function buildLayer() {
  const A = ANCHORS;
  const body = [
    sliceBetween(DIST_TEXT, A.regionStart, A.regionEnd),
    sliceBetween(DIST_TEXT, A.en2zhStart, A.en2zhEnd),
    sliceBetween(DIST_TEXT, A.jp2zhStart, A.jp2zhEnd),
    sliceBetween(DIST_TEXT, A.seriesStart, A.seriesEnd),
    sliceBetween(DIST_TEXT, A.ronkaCacheStart, A.ronkaCacheEnd),
    sliceBetween(DIST_TEXT, A.lookupZhStart, A.lookupZhEnd),
    sliceBetween(DIST_TEXT, A.aclStart, A.aclEnd),
    // 数据层测试不触发 resolver 的 itemDbReady 注册链（会级联 ensureTables → _ensureFinalize，
    // 而装配体未含探测区函数）；注册行为由 test-item-resolver.mjs 专测。
    'itemDbReady = undefined;',
    'function _zhxErr(where, e) { /* Phase 18 桩：数据层装配不触发错误记录 */ }',
    sliceBetween(DIST_TEXT, '/* @zhixia:core-item-resolver-start */', '/* @zhixia:core-item-resolver-end */'),
    `return {
      setDb: (t) => { ITEM_DB_TEXT = t; },
      setSeriesText: (t) => { SERIES_TEXT = t; _seriesMap = null; },
      setAcl: (t) => { ACL_CFC_TEXT = t; },
      buildTables, resolveEcId, lookupZh, tryEnToZh, lookupJp2Zh, lookupSeries, resolveKo, ronkaItemLookup, lookupAclCfc,
      snap: () => ({ itemHash, ecidMap, nameMap, koByZh }),
      peek: () => ({ en: _en2zhCache.size, jp: _jp2zhCache.size, ronka: Object.keys(RONKA_ITEM_CACHE).length }),
      internals: { _btRow, _btHashRow, _btNameRow, _btNamePut, _btTargets, _btApplyTargets },
    };`,
  ].join('\n');
  try {
    return new Function(body)();
  } catch (e) {
    throw new Error('数据层装配失败：' + e.message);
  }
}

/** 触发一次构建并等待完成（带超时守卫；超时定时器 unref 防挂住事件循环） */
function build(api, scope, label) {
  return Promise.race([
    new Promise((res) => api.buildTables(scope, res)),
    new Promise((_, rej) => {
      const t = setTimeout(() => rej(new Error(`buildTables 超时（${label || '无标签'}）`)), 20000);
      if (typeof t.unref === 'function') t.unref();
    }),
  ]);
}

const hrefStub = (h) => ({ getAttribute: () => h });
const section = (t) => console.log(`\n── ${t} ──`);

// ─────────────────────────────────────────────────────────────
// 手写 fixture（机制级用例；全字段受控）
// ─────────────────────────────────────────────────────────────
const FIXTURE = [
  'key\tzh\ten\tja\tko\thash\tecid\talias',
  '1\t金币\tGil\tギル\t길\t\t101\t',
  '2\t火之碎晶\tFire Shard\tファイアシャード\t불 샤드\t27623d06a42\t202\t',
  '100\t测试甲\tTest Armor A\tテストA\t테스트A\taaa111aaa11\t9001\t别名甲',
  '101\t测试乙\tTest Armor A\tテストB\t테스트B\tbbb222bbb22\t9002\t别名乙',
  '102\t同名甲\tDup En\tダップA\tkoA\tddd111ddd11\t77\t别名丙',
  '103\t同名甲\tDup En2\tダップB\tkoB\tddd222ddd22\t88\t',
  '104\t染剂甲\tAlpha Dye\tカララント:アルファ\t염료: 알파\td1d1d1d1d11\t\t',
  '105\t基底甲\tAlpha\tカララント:ベース\t염료: 베이스\td2d2d2d2d22\t\t',
  '106\t染剂乙\tSolo Dye\tカララント:ソロ\t염료: 솔로\td3d3d3d3d33\t\t',
  '200\t\tNoZhName\tなし中\t코중\te1e1e1e1e11\t99\t',
  '300\t三列行\tonly',
  '301\t五列\tFive\tごれつ\tko5',
].join('\n');

async function main() {
  // ═══════════ B：手写 fixture（机制级） ═══════════
  section('B1：装配 + 构建 + 解析层（_bt* 系列）');
  const a = buildLayer();
  ok('装配：各查询函数可用',
    ['buildTables', 'resolveEcId', 'lookupZh', 'tryEnToZh', 'lookupJp2Zh', 'lookupSeries', 'resolveKo', 'ronkaItemLookup', 'lookupAclCfc']
      .every((k) => typeof a[k] === 'function'));
  a.setDb(FIXTURE);
  await build(a, null, 'fixture');
  const s = a.snap();

  eq('名称索引：en → zh', s.nameMap['Gil'], '金币');
  eq('名称索引：ja → zh', s.nameMap['ギル'], '金币');
  eq('名称索引：ko → zh', s.nameMap['길'], '金币');
  eq('重名（同 en）：首行胜', s.nameMap['Test Armor A'], '测试甲');
  eq('异 en 同 zh：各自独立写入', s.nameMap['Dup En'], '同名甲');
  eq('异 en 同 zh：另一键', s.nameMap['Dup En2'], '同名甲');
  eq('同 zh 同键冲突：ecid 首行胜', s.ecidMap['同名甲'], '77');
  eq('同 zh 同键冲突：ko 首行胜', s.koByZh['同名甲'], 'koA');
  eq('hash → zh', s.itemHash['aaa111aaa11'], '测试甲');
  eq('hash 重复：首行胜', s.itemHash['ddd111ddd11'], '同名甲');
  eq('zh → ecid', s.ecidMap['测试甲'], '9001');
  eq('zh → ecid（第二行）', s.ecidMap['测试乙'], '9002');
  ok('空 zh 行：键已写入且值为空串', 'NoZhName' in s.nameMap && s.nameMap['NoZhName'] === '');
  ok('空 zh 行：ja 键同样为空串', s.nameMap['なし中'] === '');
  ok('alias 列（p[7]）不参与索引（现状）', !('别名甲' in s.nameMap) && !('别名丙' in s.nameMap));
  ok('表头行被跳过', !('key' in s.nameMap) && !('zh' in s.nameMap));
  ok('3 列行被跳过', !('only' in s.nameMap) && !('三列行' in s.nameMap));
  eq('5 列行：名称仍写入', s.nameMap['Five'], '五列');

  section('B2：_btRow / _btHashRow 白盒边界');
  {
    const t = a.internals._btTargets(null);
    a.internals._btRow('', t);
    a.internals._btRow('999\tx', t);
    a.internals._btRow('header\tzh\ten\tja\tko', t);
    ok('空行 / 非法列 / 表头行不产生任何条目',
      Object.keys(t.nameMap).length === 0 && Object.keys(t.itemHash).length === 0 && Object.keys(t.ecidMap).length === 0);
    a.internals._btHashRow(['-', 'zh', '', 'ja', '', 'AB12CD34EF56', 'EC1'], 'zh', t);
    ok('“-” 行：hash / ecid 跳过', Object.keys(t.itemHash).length === 0 && Object.keys(t.ecidMap).length === 0);
    a.internals._btRow('7\t七号\tSeven\tセブン\t칠\t777aaaa777a\t707\t', t);
    a.internals._btRow('8\t八号\tEight\tエイト\t팔\t777aaaa777a\t708\t', t);
    eq('白盒：hash 重复首值 wins', t.itemHash['777aaaa777a'], '七号');
    eq('白盒：ecid 重复首值 wins', t.ecidMap['七号'], '707');
  }

  section('B3：查询层（lookupZh / tryEnToZh / lookupJp2Zh / resolveEcId）');
  eq('tryEnToZh：命中', a.tryEnToZh('Fire Shard'), '火之碎晶');
  eq('tryEnToZh：缺失 → null', a.tryEnToZh('__必然缺失__'), null);
  ok('tryEnToZh：null 入参 → null', a.tryEnToZh(null) === null);
  {
    const p0 = a.peek().en;
    a.tryEnToZh('__负缓存探针__');
    a.tryEnToZh('__负缓存探针__');
    ok('tryEnToZh：缺失值负缓存只记一条', a.peek().en === p0 + 1);
  }
  {
    a.tryEnToZh('Fire Shard');
    a.tryEnToZh('Gil'); // 先预热两个键（确保已入缓存）
    const p0 = a.peek().en;
    a.tryEnToZh('Fire Shard');
    a.tryEnToZh('Gil');
    ok('tryEnToZh：重复查询不新增缓存', a.peek().en === p0);
  }
  eq('lookupJp2Zh：命中', a.lookupJp2Zh('ギル'), '金币');
  ok('lookupJp2Zh：>80 字符 → null', a.lookupJp2Zh('x'.repeat(81)) === null);
  {
    const p0 = a.peek().jp;
    a.lookupJp2Zh('y'.repeat(81));
    ok('lookupJp2Zh：超长输入不写缓存', a.peek().jp === p0);
  }
  eq('resolveEcId：命中', a.resolveEcId('测试甲'), '9001');
  ok('resolveEcId：返回类型为 string', typeof a.resolveEcId('测试甲') === 'string');
  ok('resolveEcId：空/缺失 → null', a.resolveEcId('') === null && a.resolveEcId(null) === null);

  section('B4：lookupZh 组合优先级');
  eq('hash 优先于名称',
    a.lookupZh(hrefStub('https://x/lodestone/playguide/db/item/aaa111aaa11'), 'Gil'), '测试甲');
  eq('非十六进制段不参与匹配 → 回退名称（现状）',
    a.lookupZh(hrefStub('https://x/lodestone/playguide/db/item/hashAAA'), 'Gil'), '金币');
  eq('无 hash 匹配时按名称回退',
    a.lookupZh(hrefStub('https://x/other'), 'ギル'), '金币');
  eq('无元素（a=null）时按名称', a.lookupZh(null, 'Test Armor A'), '测试甲');
  eq('全部未命中 → null', a.lookupZh(null, '__名無し__'), null);

  section('B5：Ronka 两条查询（resolveKo / ronkaItemLookup）');
  eq('zh → ko 反查', a.resolveKo('测试乙'), '테스트B');
  ok('zh → ko 缺失 → null', a.resolveKo('__缺失__') === null);
  eq('ko → zh 查询', a.ronkaItemLookup('길'), '金币');
  {
    const p0 = a.peek().ronka;
    a.ronkaItemLookup('__rk_miss__');
    a.ronkaItemLookup('__rk_miss__');
    ok('ronkaItemLookup：负缓存只记一条', a.peek().ronka === p0 + 1);
  }

  section('B6：染剂回退（Dye → 基名补开）');
  eq('Dye 原键保留', s.nameMap['Alpha Dye'], '染剂甲');
  eq('基名已有值 → 不覆盖', s.nameMap['Alpha'], '基底甲');
  eq('基名缺失 → 补开', s.nameMap['Solo'], '染剂乙');

  section('B7：系列查找（lookupSeries：精确 → ・剥离 → 前缀）');
  // 运行时等价：applyTable 会给 series 文本加前导 '\n'（src 4248-4249）
  a.setSeriesText('\n' + [
    'ファントムヴィジョン・ディフェンダー|幻境意象御敌',
    'プレフィックステスト|前缀测试',
    'スカイスチール・ディフェンダー|天钢御敌',
  ].join('\n'));
  eq('① 精确命中', a.lookupSeries('ファントムヴィジョン・ディフェンダー'), '幻境意象御敌');
  eq('② ・剥离命中', a.lookupSeries('ファントムヴィジョン・ディフェンダー・改'), '幻境意象御敌');
  eq('③ 前缀匹配（互为前缀取最长）', a.lookupSeries('プレフィックステ'), '前缀测试');
  ok('长度 <2 → null', a.lookupSeries('プ') === null);
  ok('长度 >60 → null', a.lookupSeries('あ'.repeat(61)) === null);
  ok('未命中 → null', a.lookupSeries('__未知系列__') === null);

  section('B8：构建 scope 裁剪（现状记录）');
  {
    const b = buildLayer();
    b.setDb(FIXTURE);
    await build(b, ['nameMap'], 'scope');
    const sb = b.snap();
    ok('scope=[nameMap]：该索引建立', sb.nameMap !== null && Object.keys(sb.nameMap).length > 0);
    // 容器语义（v1.4）：置空 = 空容器或 null 均视为已清空
    ok('scope=[nameMap]：其余索引置空（重建语义）',
      (sb.itemHash === null || Object.keys(sb.itemHash).length === 0)
      && (sb.ecidMap === null || Object.keys(sb.ecidMap).length === 0)
      && (sb.koByZh === null || Object.keys(sb.koByZh).length === 0));
    eq('scope=[nameMap]：EC_ID 查询 → null', b.resolveEcId('测试甲'), null);
  }

  section('B9：ACL 副本表查询（lookupAclCfc）');
  // 运行时等价：applyTable 会给 acl 文本加前导 '\n'（src 4248-4249）
  a.setAcl('\n' + [
    'アク・モーン|阿卡蒙',
    'テストダンジョン|测试副本',
    'トリム枠|  留白名  ',
  ].join('\n'));
  eq('ACL：命中', a.lookupAclCfc('テストダンジョン'), '测试副本');
  eq('ACL：值首尾空白被 trim', a.lookupAclCfc('トリム枠'), '留白名');
  ok('ACL：未命中 → null', a.lookupAclCfc('__没有__') === null);
  ok('ACL：空/null → null', a.lookupAclCfc('') === null && a.lookupAclCfc(null) === null);
  ok('ACL：前缀不命中（\\n 锚定精确段）', a.lookupAclCfc('テス') === null);
  // 边界记录：无前导 '\n' 时首行不可命中（这正是加载层补 '\n' 的原因）
  a.setAcl('アク・モーン|阿卡蒙\nテストダンジョン|测试副本');
  ok('ACL：首行无前导 \\n 时不可命中（边界记录）', a.lookupAclCfc('アク・モーン') === null);
  eq('ACL：有 \\n 边界的行可命中', a.lookupAclCfc('テストダンジョン'), '测试副本');

  // ═══════════ C：真实数据行（运行时从 data/ 现取，不手抄） ═══════════
  section('C：真实数据行（data/ff14-items.tsv 现取样本）');
  const realText = fs.readFileSync(itemsTsvPath, 'utf8');
  const realLines = realText.split('\n');
  const negLine = realLines.find((l) => l.startsWith('-\t'));
  const dyeLine = realLines.find((l) => l.includes('\tSnow White Dye\t'));
  // 注意：表头行的 p[7] 也非空（'alias'），需以数字开头排除
  const aliasLine = realLines.find((l) => {
    if (!/^[0-9]/.test(l)) return false;
    const p = l.split('\t');
    return p.length >= 8 && p[7].trim();
  });
  ok('取得样本行（- / Dye / alias）', !!negLine && !!dyeLine && !!aliasLine);

  const c = buildLayer();
  c.setDb([FIXTURE, negLine, dyeLine, aliasLine].join('\n'));
  await build(c, null, '真实行');
  const sc = c.snap();
  {
    const p = negLine.split('\t');
    ok('真实 “-” 行：ja 名称仍写入索引', !!p[3] && sc.nameMap[p[3]] === p[1]);
  }
  {
    const p = dyeLine.split('\t');
    const base = p[2].slice(0, -4);
    ok('真实 Dye 行：en 写入', sc.nameMap[p[2]] === p[1]);
    ok('真实 Dye 行：基名补开', sc.nameMap[base] === p[1]);
  }
  {
    const p = aliasLine.split('\t');
    ok('真实 alias 行：en 写入', sc.nameMap[p[2]] === p[1]);
    ok('真实 alias 行：alias 值不建键（现状）', !(p[7] in sc.nameMap));
  }

  // ═══════════ D：全表 + 系列表（真实数据规模级） ═══════════
  section('D：全表构建 + 程序化抽样一致');
  const t0 = Date.now();
  const full = buildLayer();
  full.setDb(realText);
  await build(full, null, '全表');
  console.log(`  全表构建耗时约 ${((Date.now() - t0) / 1000).toFixed(2)}s`);
  const sf = full.snap();
  const nName = Object.keys(sf.nameMap).length;
  const nHash = Object.keys(sf.itemHash).length;
  const nEc = Object.keys(sf.ecidMap).length;
  const nKo = Object.keys(sf.koByZh).length;
  console.log(`  索引规模：nameMap=${nName} itemHash=${nHash} ecidMap=${nEc} koByZh=${nKo}`);
  ok('全表：nameMap 规模健康（≥80000）', nName >= 80000, `实测 ${nName}`);
  ok('全表：itemHash 规模健康（≥20000）', nHash >= 20000, `实测 ${nHash}`);
  ok('全表：ecidMap 规模健康（≥15000）', nEc >= 15000, `实测 ${nEc}`);
  ok('全表：koByZh 规模健康（≥30000）', nKo >= 30000, `实测 ${nKo}`);

  // 期望值预扫描（首现语义，独立于被测实现重述规范）
  const expName = new Map();
  const expHash = new Map();
  const expEcid = new Map();
  const expKo = new Map();
  const parseRow = (l) => {
    if (!l) return null;
    const c0 = l.codePointAt(0);
    if (c0 !== 45 && (c0 < 48 || c0 > 57)) return null;
    const p = l.split('\t');
    if (p.length < 5) return null;
    return {
      neg: p[0] === '-', zh: p[1] || '', en: p[2] || '', ja: p[3] || '', ko: p[4] || '',
      hash: p[5] || '', ecid: p[6] || '',
    };
  };
  for (const l of realLines) {
    const r = parseRow(l);
    if (!r) continue;
    for (const k of [r.en, r.ja, r.ko]) { if (k && !expName.has(k)) expName.set(k, r.zh); }
    if (r.hash && !r.neg && !expHash.has(r.hash)) expHash.set(r.hash, r.zh);
    if (r.zh && r.ecid && !expEcid.has(r.zh)) expEcid.set(r.zh, r.ecid);
    if (r.zh && r.ko && !expKo.has(r.zh)) expKo.set(r.zh, r.ko);
  }

  let mm = 0;
  const mmShow = [];
  const check = (got, want, tag) => {
    if (got !== want) { mm++; if (mmShow.length < 12) mmShow.push(`${tag}: got=${JSON.stringify(got)} want=${JSON.stringify(want)}`); }
  };
  let sampled = 0;
  for (let i = 0; i < realLines.length; i += 200) {
    const r = parseRow(realLines[i]);
    if (!r) continue;
    sampled++;
    if (r.en) check(full.tryEnToZh(r.en), expName.get(r.en) || null, `en[${r.en}]`);
    if (r.ja) check(full.tryEnToZh(r.ja), expName.get(r.ja) || null, `ja[${r.ja}]`);
    if (r.ko) check(full.tryEnToZh(r.ko), expName.get(r.ko) || null, `ko[${r.ko}]`);
    if (r.hash && !r.neg) check(full.lookupZh(hrefStub('https://x/lodestone/playguide/db/item/' + r.hash), ''), expHash.get(r.hash) || null, `hash[${r.hash}]`);
    if (r.zh && r.ecid) check(full.resolveEcId(r.zh), expEcid.get(r.zh) ? String(expEcid.get(r.zh)) : null, `ecid[${r.zh}]`);
    if (r.zh && r.ko) check(full.resolveKo(r.zh), expKo.get(r.zh) || null, `ko[${r.zh}]`);
  }
  ok(`全表抽样一致（${sampled} 条行样本，约 ${Math.round(realLines.length / 200)} 档）`, mm === 0, mmShow.join(' | '));

  section('D2：系列表（data/ff14-series.txt）');
  const seriesText = fs.readFileSync(path.join(dataDirPath, 'ff14-series.txt'), 'utf8');
  full.setSeriesText('\n' + seriesText); // 运行时等价（applyTable：'\n' + txt，src 4248）
  const sMap = new Map();
  for (const l of seriesText.split('\n')) {
    const i = l.indexOf('|');
    if (i > 0) sMap.set(l.slice(0, i), l.slice(i + 1));
  }
  const sKeys = [...sMap.keys()].filter((k) => k.length >= 2 && k.length <= 60 && sMap.get(k));
  let sm = 0;
  const smShow = [];
  const sStep = Math.max(1, Math.floor(sKeys.length / 30));
  let sSampled = 0;
  for (let i = 0; i < sKeys.length; i += sStep) {
    sSampled++;
    const k = sKeys[i];
    const got = full.lookupSeries(k);
    const want = sMap.get(k);
    if (got !== want) { sm++; if (smShow.length < 8) smShow.push(`${k}: got=${got} want=${want}`); }
  }
  ok(`系列表抽样直查一致（${sSampled} 条）`, sm === 0, smShow.join(' | '));

  section('D3：ACL 副本表（data/acl-cfc.txt）');
  const aclText = fs.readFileSync(path.join(dataDirPath, 'acl-cfc.txt'), 'utf8');
  full.setAcl('\n' + aclText); // 运行时等价（applyTable：'\n' + txt，src 4249）
  {
    let am = 0;
    const amShow = [];
    let aLines = 0;
    for (const l of aclText.split('\n')) {
      if (!l) continue;
      const i = l.indexOf('|');
      if (i <= 0) continue;
      aLines++;
      const ja = l.slice(0, i);
      const zh = l.slice(i + 1);
      const got = full.lookupAclCfc(ja);
      if (got !== zh) { am++; if (amShow.length < 8) amShow.push(`${ja}: got=${got} want=${zh}`); }
    }
    ok(`ACL 真实表全覆盖（${aLines} 行）`, am === 0, amShow.join(' | '));
  }

  console.log('\n════════ 汇总 ════════');
  console.log(`通过 ${pass} / 失败 ${fail}`);
  return fail;
}

main()
  .then((f) => process.exit(f ? 1 : 0))
  .catch((e) => { console.error('\n测试异常：', e); process.exit(1); });
