// tests/unit/test-chinese-search.mjs — v1.4.2 中文装备搜索核心行为
//
// 目的：冻结搜索输入识别、中文查询判定、GET URL 重写等纯逻辑。
//       不依赖真实站点与网络；站点实际表单由 live / 人工验证覆盖。
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../helpers/paths.mjs';

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};
const eq = (name, actual, expected) => ok(name, actual === expected,
  `实际=${JSON.stringify(actual)} 期望=${JSON.stringify(expected)}`);

const SOURCE_TEXT = fs.readFileSync(path.join(repoRoot, 'src/core/chinese-search.js'), 'utf8');

function sliceSource(s) {
  const start = s.indexOf('const SEARCH_SITES = Object.freeze({');
  const end = s.indexOf('\nexport {', start);
  if (start < 0 || end < 0) throw new Error('中文装备搜索源码区段缺失');
  return s.slice(start, end);
}

function buildSearch() {
  const seg = sliceSource(SOURCE_TEXT);
  const body = [
    'const resolveByZh = (v) => ({\'甲\': \'ア\', \'乙\': \'ガ\'}[v] || null);',
    seg,
    'return { buildSearchUrl, findSearchInput, handleChineseSearchSubmit, isChineseSearchQuery, normalizeSearchQuery, searchInputScore };',
  ].join('\n');
  try {
    return new Function(body)();
  } catch (e) {
    throw new Error('中文装备搜索区段装配失败：' + e.message);
  }
}
function fakeInput(attrs = {}) {
  return {
    disabled: false,
    readOnly: false,
    getAttribute(name) { return attrs[name] ?? null; },
  };
}

console.log('\n── A：中文查询判定与规范化 ──');
{
  const api = buildSearch();
  eq('规范化：去首尾空白并合并连续空格', api.normalizeSearchQuery('  月读之  长袍  '), '月读之 长袍');
  eq('中文查询：标准装备名', api.isChineseSearchQuery('月读之长袍'), true);
  eq('中文查询：含数字/标点仍可识别', api.isChineseSearchQuery('贤王莫古力王冠'), true);
  eq('外文查询不拦截', api.isChineseSearchQuery('Tsukuyomi\'s Hose'), false);
  eq('空查询不拦截', api.isChineseSearchQuery('   '), false);
}

console.log('\n── B：搜索框识别 ──');
{
  const api = buildSearch();
  const keyword = fakeInput({ name: 'keyword', placeholder: '装備品名等を入力' });
  const player = fakeInput({ name: 'player', placeholder: 'Player' });
  const title = fakeInput({ name: 'title', placeholder: 'Title' });
  const form = { querySelectorAll: () => [player, title, keyword] };
  eq('优先识别装备关键词输入框', api.findSearchInput(form), keyword);
  ok('关键词输入框得分高于普通文本框', api.searchInputScore(keyword) > api.searchInputScore(player));
  eq('作者/玩家字段被排除', api.searchInputScore(player) < 0, true);

  const partPlaceholders = ['头防具', '胴防具', '手防具', '脚防具', '足防具'];
  for (const part of partPlaceholders) {
    const fcPartSearch = fakeInput({ placeholder: '装備名の一部を入力して検索' });
    const fcGenericSearch = fakeInput({ placeholder: '装備品名等を入力' });
    const fcForm = { querySelectorAll: () => [fcGenericSearch, fcPartSearch] };
    eq('FF14-FC ' + part + ' 页面优先识别部位搜索框', api.findSearchInput(fcForm), fcPartSearch);
  }
}

console.log('\n── C：GET 搜索 URL 重写 ──');
{
  const api = buildSearch();
  const url = api.buildSearchUrl(
    '/?page=2&keyword=旧值',
    [['keyword', '旧值'], ['page', '3'], ['filter', 'body']],
    'keyword',
    'アーモンド胴着',
    'https://mirapri.com/?page=2&keyword=旧值',
  );
  const u = new URL(url);
  eq('保留 action 路径', u.pathname, '/');
  eq('中文名转换为原生搜索名', u.searchParams.get('keyword'), 'アーモンド胴着');
  eq('表单其他字段保留', u.searchParams.get('filter'), 'body');
  eq('表单页码覆盖 action 中旧值', u.searchParams.get('page'), '3');
}

console.log('\\n── D：提交时转换中文查询 ──');
{
  const api = buildSearch();
  const input = {
    value: '甲',
    name: 'keyword',
    disabled: false,
    readOnly: false,
    getAttribute(name) { return name === 'name' ? this.name : name === 'placeholder' ? '装備品名等を入力' : name === 'type' ? 'search' : null; },
    isConnected: true,
  };
  const form = {
    getAttribute(name) { return name === 'method' ? 'get' : name === 'action' ? '/' : null; },
    querySelectorAll() { return [input]; },
  };
  const previousFormData = globalThis.FormData;
  const previousLocation = globalThis.location;
  const calls = [];
  globalThis.FormData = class {
    entries() { return [['keyword', input.value], ['page', '3']][Symbol.iterator](); }
  };
  globalThis.location = {
    href: 'https://mirapri.com/?page=3',
    assign(url) { calls.push(url); },
  };
  const event = {
    target: form,
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; },
  };
  try {
    api.handleChineseSearchSubmit(event, 'mirapri');
  } finally {
    globalThis.FormData = previousFormData;
    globalThis.location = previousLocation;
  }
  eq('中文查询提交时阻止原表单默认提交', event.prevented, true);
  eq('中文查询提交时停止继续传播', event.stopped, true);
  eq('最终搜索 URL 使用日文名称', calls[0], 'https://mirapri.com/?page=3&keyword=%E3%82%A2');
}
console.log('\\n════════ 汇总 ════════');
console.log(`通过 ${pass} / 失败 ${fail}`);
if (fail > 0) process.exit(1);
console.log('── ✅ 通过（exit=0）');
