// Item Resolver contract tests against the V3 runtime indexes.
import fs from 'node:fs';
import { readDist, itemsTsvPath } from '../helpers/paths.mjs';
import { readRuntimeV3 } from '../helpers/v3-cache.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); } };
const eq = (name, actual, expected) => ok(name, actual === expected, '实际=' + JSON.stringify(actual) + ' 期望=' + JSON.stringify(expected));
const DIST_TEXT = readDist();
function sliceAll(s, tag) {
  const a = '/* @zhixia:' + tag + '-start */', b = '/* @zhixia:' + tag + '-end */', out = [];
  let from = 0;
  for (;;) { const i = s.indexOf(a, from); if (i < 0) break; const j = s.indexOf(b, i + a.length); if (j < 0) throw new Error('unclosed ' + tag); out.push(s.slice(i, j + b.length)); from = j + b.length; }
  if (!out.length) throw new Error('missing ' + tag);
  return out;
}
const resolverSegs = sliceAll(DIST_TEXT, 'core-item-resolver').map((s) => s.replaceAll('const id = findSite()?.id;', 'const id = __testFindSite()?.id;'));
function extractFn(src, name) {
  const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('missing helper ' + name);
  let d = 0, j = i;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); }
  throw new Error('unclosed helper ' + name);
}
const helpers = ['_shortestStr', '_countIncludes', '_lcs90'].map((n) => extractFn(DIST_TEXT, n)).join('\n');
function buildResolver(env = {}) {
  const body = [
    'let _tablesReady = true;',
    'let itemHash = __env.itemHash || Object.create(null);',
    'let nameMap = __env.nameMap || Object.create(null);',
    'let ecidMap = __env.ecidMap || Object.create(null);',
    'let koByZh = __env.koByZh || Object.create(null);',
    'const __testFindSite = () => __env.site || { id: "mirapri" };',
    'const tryEnToZh = (n) => n === "KNOWN_EN" ? "英文名译" : null;',
    'const _zhxErr = () => {};',
    helpers,
    ...resolverSegs,
    '_irDupMap = __env.dupMap || null;',
    '_irAliasMap = __env.aliasMap || null;',
    '_irGlamMap = __env.glamMap || null;',
    '_irCandidatePolicy = __env.candidatePolicy ?? 1;',
    'return { resolveByHash, resolveByName, resolveByZh, suggestByZh, resolveAllByName, resolveAlias, resolve, resolveEcId, resolveKo, resolvePartialByZh, _irBuildSearchFromNames, __stats: () => ({ ..._irStats }) };',
  ].join('\n');
  return new Function('__env', body)(env);
}
const nameMap = { 'ア': '甲', '가': '甲', A: '甲', 'イ': '丙', '나': '丙', B: '丙', 'ウ': '丁', '다': '丁', C: '丁', 'エ': '炎灵长袍', D: '炎灵长袍', 'オ': '炎灵长裤', E: '炎灵长裤', 'カ': '炎灵', F: '炎灵' };
const glamMap = Object.fromEntries(Object.keys(nameMap).map((k) => [k, '1']));
const dupMap = { A: ['甲', '乙'], 'ア': ['甲', '乙'], '가': ['甲', '乙'] };
const aliasMap = { 丙组合: ['丙'], 丙套装: ['丙'], 炎灵袍: ['炎灵长袍'], 炎灵裤: ['炎灵长裤'] };
const mkEnv = (over = {}) => ({ itemHash: { h1: '甲', h3: '丙' }, nameMap: { ...nameMap }, ecidMap: { 甲: 100, 丙: 102 }, koByZh: { 甲: '가', 丙: '나' }, glamMap: { ...glamMap }, dupMap: { ...dupMap }, aliasMap: { ...aliasMap }, candidatePolicy: 1, site: { id: 'mirapri' }, ...over });

console.log('\n── A：查询与重名/别名注册表 ──');
{
 const api = buildResolver(mkEnv());
 eq('hash命中', api.resolveByHash('h1'), '甲'); eq('hash未命中', api.resolveByHash('nope'), null);
 eq('名称首值命中', api.resolveByName('A'), '甲'); eq('名称未命中', api.resolveByName('nope'), null);
 eq('EC ID 转字符串', api.resolveEcId('甲'), '100'); eq('韩文名反查', api.resolveKo('甲'), '가');
 eq('重复名称完整结果', JSON.stringify(api.resolveAllByName('A')), JSON.stringify(['甲', '乙']));
 eq('同名未重复返回单值数组', JSON.stringify(api.resolveAllByName('B')), JSON.stringify(['丙']));
 eq('别名读取', JSON.stringify(api.resolveAlias('丙组合')), JSON.stringify(['丙']));
 eq('接口函数齐备', ['resolveByHash','resolveByName','resolveByZh','suggestByZh','resolveAllByName','resolveAlias','resolve','resolveEcId','resolveKo','resolvePartialByZh'].every((k) => typeof api[k] === 'function'), true);
 const stats=buildResolver(mkEnv()); stats.resolveByHash('h1'); stats.resolveByName('nope'); stats.resolveEcId('丙'); stats.resolveKo('无');
 eq('统计计数', JSON.stringify(stats.__stats()), JSON.stringify({hit:2,miss:2}));
}

console.log('\n── B：中文名称与别名搜索契约 ──');
{
 const api=buildResolver(mkEnv());
 eq('日文名可由中文名命中', api.resolveByZh('甲'), 'ア');
 eq('中文别名可命中对应原生名', api.resolveByZh('丙组合'), 'イ');
 eq('候选短输入下限', JSON.stringify(api.suggestByZh('炎')), JSON.stringify([]));
 const suggestions=api.suggestByZh('炎灵');
 eq('规范名优先、完整结果包含正式名和别名', suggestions.map(x=>x.zh).join(','), '炎灵,炎灵长袍,炎灵长裤,炎灵袍,炎灵裤');
 eq('limit 生效', api.suggestByZh('炎灵',2).length, 2);
 eq('大 limit 有防御上限', api.suggestByZh('炎灵',99999).length <= 3000, true);
 const partialApi=buildResolver(mkEnv({ nameMap:{'メイドローブ':'女仆长袍','メイドパンツ':'女仆长裤','メイド腕带':'女仆腕带'}, glamMap:{'メイドローブ':'1','メイドパンツ':'1','メイド腕带':'1'}, aliasMap:{} }));
 eq('部分词提取日文公共片段', partialApi.resolvePartialByZh('女仆'), 'メイド');
 eq('未命中不转换', partialApi.resolvePartialByZh('紫电'), null);
}
{
 const api=buildResolver(mkEnv({ site:{id:'ec'}, nameMap:{ A:'甲',B:'丙',C:'丁',D:'炎灵长袍',E:'炎灵长裤',F:'炎灵' }, aliasMap:{}, glamMap:Object.fromEntries(['A','B','C','D','E','F'].map(k=>[k,'1'])) }));
 eq('英文站名映射', api.resolveByZh('甲'), 'A');
 const ko=buildResolver(mkEnv({ site:{id:'ronka'}, nameMap:{ '가':'甲','나':'丙' }, aliasMap:{}, glamMap:{'가':'1','나':'1'} }));
 eq('韩文站名映射', ko.resolveByZh('甲'), '가');
}

console.log('\n── B1：中文中间词匹配与候选排序 ──');
{
 const names={ 'メイドヘッド':'女仆发带', '星メイド':'星光女仆长袍', 'メイドトップ':'女仆上衣', 'おしゃれ':'时尚饰品' };
 const glam=Object.fromEntries(Object.keys(names).map(k=>[k,'1']));
 const aliases={ '星光女仆别名':['女仆上衣'], '女仆饰品':['时尚饰品'] };
 const api=buildResolver(mkEnv({ nameMap:names, glamMap:glam, aliasMap:aliases }));
 const rows=api.suggestByZh('女仆');
 const prefixes=['女仆上衣','女仆发带'].sort((a,b)=>a.localeCompare(b));
 eq('前缀优先，中间包含其次，再依次匹配别名',rows.map(r=>r.zh).join('|'),
   [...prefixes,'星光女仆长袍','女仆饰品','星光女仆别名'].join('|'));
 eq('词中中文别名仍对应原站语言名',rows.at(-1)?.native,'メイドトップ');
 eq('跨匹配分组时仍受 limit 约束',api.suggestByZh('女仆',3).length,3);
 eq('不含输入词的物品不混入候选',rows.some(r=>r.zh==='时尚饰品'),false);
}

console.log('\n── C：候选安全策略 ──');
{
 const api=buildResolver(mkEnv());
 const built=api._irBuildSearchFromNames({A1:'甲乙',B1:'乙丙',C1:'丙丁',D1:'丁戊',E1:'戊己'}, {'禁用别名':['丙丁']}, {A1:'1',B1:'0',C1:'',D1:'1',E1:'2'});
 eq('仅显式1允许', built.map['甲乙'], 'A1'); eq('标0排除', built.map['乙丙'], undefined);
 eq('无标记排除', built.map['丙丁'], undefined); eq('其他1允许', built.map['丁戊'], 'D1');
 eq('非法标记排除', built.map['戊己'], undefined); eq('别名不得绕过allow标记', built.map['禁用别名'], undefined);
 const restricted=buildResolver(mkEnv({candidatePolicy:0}));
 eq('未知policy禁用倒排候选', restricted.resolveByZh('甲'), null);
 eq('未知policy不影响普通名称解析', restricted.resolveByName('A'), '甲');
}

console.log('\n── D：canonical V3 数据 goldens ──');
{
 const { manifest, siteFiles }=readRuntimeV3('mirapri');
 const names=Object.create(null), glam=Object.create(null), alias=Object.create(null), dup=Object.create(null);
 for(const line of siteFiles.names.text.split(/\r?\n/)){const p=line.split('\t');if(p[0]){names[p[0]]=p[1];if(p[2]!==undefined)glam[p[0]]=p[2].trim();}}
 const multi=(text,out)=>{for(const line of text.split(/\r?\n/)){const p=line.split('\t');if(p[0])out[p[0]]=p.slice(1).filter(Boolean);}};
 multi(siteFiles.alias.text,alias); multi(siteFiles.dup.text,dup);
 const api=buildResolver(mkEnv({nameMap:names,glamMap:glam,aliasMap:alias,dupMap:dup,candidatePolicy:manifest.candidatePolicy}));
 const legacy=['英骑装备的改良材料','改良型加隆德御敌腰带','阿马罗装备的修复素材','魔法阳伞','亚麻阳伞'];
 for(const zh of legacy) eq('真实候选排除 '+zh,api.resolveByZh(zh),null);
 for(const zh of ['光之鸟甲','航空兜帽','猎蛋装甲','防雨装甲','女仆发带','阳伞','黑色蕾丝阳伞']) ok('真实候选保留 '+zh,!!api.resolveByZh(zh));
 eq('V3候选策略=1',manifest.candidatePolicy,1);
 eq('canonical文件存在',typeof siteFiles.names.text,'string');
 const ec=readRuntimeV3('ec');
 const enNames=Object.create(null),enGlam=Object.create(null),enAlias=Object.create(null);
 for(const line of ec.siteFiles.names.text.split(/\r?\n/)){const p=line.split('\t');if(p[0]){enNames[p[0]]=p[1];if(p[2]!==undefined)enGlam[p[0]]=p[2].trim();}}
 multi(ec.siteFiles.alias.text,enAlias);
 const dyeZh=enNames['Snow White Dye'];
 const ecApi=buildResolver(mkEnv({nameMap:enNames,glamMap:enGlam,aliasMap:enAlias,candidatePolicy:ec.manifest.candidatePolicy}));
 ok('English dye V3 mapping remains available for display',!!dyeZh && ecApi.resolveByName('Snow White Dye')===dyeZh);
 eq('English dye with candidate flag 0 is excluded from candidates',enGlam['Snow White Dye'], '0');
 eq('English dye is not searchable as a Chinese equipment candidate',ecApi.resolveByZh(dyeZh),null);
}

console.log('\n── E：统一解析优先级 ──');
{
 const api=buildResolver(mkEnv());
 eq('hash优先',api.resolve({hash:'h3',name:'A'}),'丙');
 eq('hash miss回退名称',api.resolve({hash:'nope',name:'A'}),'甲');
 eq('name命中',api.resolve({name:'B'}),'丙');
 eq('别名作为后备',api.resolve({alias:'丙组合'}),'丙');
 eq('全部miss',api.resolve({hash:'x',name:'y',alias:'z'}),null);
 eq('latin fallback on',api.resolve({name:'KNOWN_EN'},{latinFallback:true}),'英文名译');
 eq('latin fallback default off',api.resolve({name:'KNOWN_EN'}),null);
}

console.log('\n── F：ready-independent API safety ──');
{
 const api=buildResolver(mkEnv({nameMap:{ A:'甲' }, glamMap:{A:'1'},aliasMap:null,dupMap:null}));
 eq('无复杂注册表时名称仍可解析',api.resolveByName('A'),'甲');
 eq('无候选名称返回null',api.resolveByZh('不存在'),null);
}

console.log('通过 '+pass+' / 失败 '+fail);
if(fail)process.exit(1);
console.log('✅ test-item-resolver通过');
