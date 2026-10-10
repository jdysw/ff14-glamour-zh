// tests/unit/test-chinese-search-ui.mjs — v1.4.2 中文装备搜索 UI 行为
//
// 目的：冻结智能输入的 DOM/UI 契约，不依赖真实站点、Chrome 或第三方 DOM 库。
//       采用最小 DOM harness 驱动 canonical source，验证事件绑定、候选渲染、
//       键盘 / pointer / IME、视口定位、未命中提示和搜索框缓存。
//       数据层排序与解析契约由 test-item-resolver.mjs 独立验证。
//       1.4.2 后续修复（b 方案）：E 段——独立搜索框输入停顿不自动转换；点选候选做转换式搜索。

import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../helpers/paths.mjs';

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); }
};
const eq = (name, actual, expected) => ok(name, actual === expected,
  '实际=' + JSON.stringify(actual) + ' 期望=' + JSON.stringify(expected));

const SOURCE_TEXT = fs.readFileSync(path.join(repoRoot, 'src/core/chinese-search.js'), 'utf8');

function sliceSource(s) {
  const start = s.indexOf('const SEARCH_SITES = Object.freeze({');
  const end = s.indexOf('\nexport {', start);
  if (start < 0 || end < 0) throw new Error('中文装备搜索源码区段缺失');
  return s.slice(start, end);
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.hidden = false;
    this.isConnected = true;
    this.disabled = false;
    this.readOnly = false;
    this.value = '';
    this.name = '';
    this.id = '';
    this.className = '';
    this.textContent = '';
    this.form = null;
    this._rect = { left: 20, top: 540, right: 240, bottom: 570, width: 220, height: 30 };
    this.focused = false;
    this.selection = null;
    this.scrolled = false;
    this.dispatched = [];
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'id') this.id = String(value);
    if (name === 'name') this.name = String(value); // 与真实 HTMLInputElement 的反射属性保持一致
  }

  getAttribute(name) {
    if (name === 'id') return this.id || null;
    if (name === 'name') return this.name || null;
    if (name === 'value') return this.value || null;
    return this.attributes[name] ?? null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    child.isConnected = this.isConnected;
    return child;
  }

  append(...nodes) {
    for (const node of nodes) this.appendChild(node);
  }

  replaceChildren(...nodes) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this.append(...nodes);
  }

  contains(node) {
    if (node === this) return true;
    return this.children.some((child) => child.contains(node));
  }

  closest(selector) {
    if (selector === 'button, input[type="submit"], [role="button"]' && this.tagName === 'BUTTON') return this;
    if (selector === 'button[data-zhx-index]' && this.tagName === 'BUTTON'
      && this.dataset.zhxIndex !== undefined) return this;
    return this.parentNode?.closest?.(selector) || null;
  }

  querySelectorAll(selector) {
    const out = [];
    const matches = (node) => {
      if (selector === 'input') return node.tagName === 'INPUT';
      if (selector === 'button[data-zhx-index]') {
        return node.tagName === 'BUTTON' && node.dataset.zhxIndex !== undefined;
      }
      return false;
    };
    const walk = (node) => {
      for (const child of node.children) {
        if (matches(child)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  getBoundingClientRect() {
    return { ...this._rect };
  }

  focus() {
    this.focused = true;
  }

  setSelectionRange(start, end) {
    this.selection = [start, end];
  }

  scrollIntoView() {
    this.scrolled = true;
  }

  dispatchEvent(event) {
    this.dispatched.push(event?.type || 'unknown');
    return true;
  }
}

class FakeDocument {
  constructor() {
    this.listeners = new Map();
    this.head = new FakeElement('head');
    this.body = new FakeElement('body');
    this.documentElement = new FakeElement('html');
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  addEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    list.push(handler);
    this.listeners.set(type, list);
  }

  dispatch(type, event) {
    for (const handler of this.listeners.get(type) || []) handler(event);
  }
}

function findSuggestBox(document) {
  return document.body.children.find((el) => el.dataset.zhxChineseSuggest !== undefined) || null;
}

function sleep(ms = 90) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSearchHarness(suggestionsOverride) {
  const ready = [];
  const suggestions = Object.freeze(suggestionsOverride || [
    { zh: '炎灵', native: 'カ' },
    { zh: '炎灵长袍', native: 'エ' },
    { zh: '炎灵长裤', native: 'オ' },
    { zh: '炎灵袍', native: 'エ' },
    { zh: '炎灵裤', native: 'オ' },
  ]);
  const seg = sliceSource(SOURCE_TEXT);
  const body = [
    'const onTablesReady = (cb) => { __ready.push(cb); };',
    'const resolveByZh = (v) => ({甲: "ア", 乙: "ガ", 炎灵: "カ"})[v] || null;',
    'const resolvePartialByZh = (v) => ({丙丁: "ウエ"})[v] || null;',
    'const suggestByZh = (v,_limit,scope) => {const rows = v === "炎灵" || v === "鸟甲" || v === "装备" ? __suggestions.slice() : (v === "炎灵袍" ? __suggestions.slice(3, 4) : __suggestions.filter(r => r.zh.includes(v))); if(scope instanceof Set) return rows.filter(r=>scope.has(r.native)); if(typeof scope==="number") return rows.filter(r=>r.slot===scope); return rows;};',
    'const resolveECGearsetSearch = (v) => ({幻境: "Phantom Vision", 幻境意象御敌套装: "Phantom Vision Fending", 御敌: "Fending"})[v] || null;',
    'const suggestECGearsetsByZh = (v) => v === "幻境" ? [{ zh: "幻境意象御敌套装", native: "Phantom Vision Fending" }] : [];',
    seg,
    'return { startChineseSearch, handleChineseSearchSubmit, findSearchInput, isStandaloneSearchInput, ecSearchContext, ecScopedSuggestions, ecScopedNative, facewearNatives: new Set(EC_FACEWEAR_ROWS.map(row => row.native)) };',
  ].join('\n');
  try {
    const fn = new Function('__ready', '__suggestions', body);
    return { api: fn(ready, suggestions), ready, suggestions };
  } catch (e) {
    throw new Error('中文装备搜索 UI 区段装配失败：' + e.message);
  }
}

const previousDocument = globalThis.document;
const previousAddEventListener = globalThis.addEventListener;
const previousInnerWidth = globalThis.innerWidth;
const previousInnerHeight = globalThis.innerHeight;
const previousBound = globalThis.__zhxChineseSearchBound;

let document;
const installDocument = () => {
  document = new FakeDocument();
  globalThis.document = document;
};
installDocument();
globalThis.innerWidth = 360;
globalThis.innerHeight = 600;
globalThis.addEventListener = () => {};
delete globalThis.__zhxChineseSearchBound;

try {
  console.log('\n── A：搜索框缓存 ──');
  {
    const { api } = buildSearchHarness();
    const input = new FakeElement('input');
    input.form = { contains: (x) => x === input };
    let scans = 0;
    input.form.querySelectorAll = () => { scans++; return [input]; };
    eq('首次识别搜索框', api.findSearchInput(input.form), input);
    eq('第二次识别命中 WeakMap 缓存', api.findSearchInput(input.form), input);
    eq('缓存避免重复 querySelectorAll', scans, 1);

    const replacement = new FakeElement('input');
    replacement.form = input.form;
    input.isConnected = false;
    input.form.contains = (x) => x === replacement;
    input.form.querySelectorAll = () => [replacement];
    eq('旧输入框断连后自动重新识别', api.findSearchInput(input.form), replacement);
  }

  console.log('\n── B：智能输入 UI 渲染 / 视口定位 ──');
  {
    installDocument();
    delete globalThis.__zhxChineseSearchBound;
    const harness = buildSearchHarness();
    const api = harness.api;
    const ready = harness.ready;
    const form = new FakeElement('form');
    const input = new FakeElement('input');
    input.form = form;
    input.name = 'keyword';
    input.setAttribute('type', 'search');
    input.setAttribute('placeholder', '装備品名等を入力');
    form.appendChild(input);

    api.startChineseSearch('mirapri');
    input.value = '炎灵';

    document.dispatch('focusin', { target: input });
    await sleep();
    eq('数据未就绪时不创建候选框', !!findSuggestBox(document), false);

    ready[0]();
    await sleep();
    const box = findSuggestBox(document);
    eq('数据就绪后展示候选框', box?.hidden, false);
    eq('候选框使用 listbox 语义', box?.getAttribute('role'), 'listbox');
    eq('候选数量正确', box?.querySelectorAll('button[data-zhx-index]').length, 5);
    const popupTop = Number.parseFloat(box?.style.top);
    eq('候选框底部空间不足时向上弹出', popupTop < input._rect.top, true);
    eq('输入框 aria-expanded=true', input.getAttribute('aria-expanded'), 'true');
  }

  console.log('\n── C：键盘 / pointer 选择 ──');
  {
    installDocument();
    delete globalThis.__zhxChineseSearchBound;
    const harness = buildSearchHarness();
    const api = harness.api;
    const ready = harness.ready;
    const form = new FakeElement('form');
    const input = new FakeElement('input');
    input.form = form;
    input.name = 'keyword';
    input.setAttribute('type', 'search');
    input.setAttribute('placeholder', '装備品名等を入力');
    form.appendChild(input);
    input.value = '炎灵';

    api.startChineseSearch('mirapri');
    ready[0]();
    document.dispatch('focusin', { target: input });
    await sleep();

    const down1 = { target: input, key: 'ArrowDown', prevented: false, preventDefault() { this.prevented = true; } };
    document.dispatch('keydown', down1);
    const box = findSuggestBox(document);
    const buttons = box.querySelectorAll('button[data-zhx-index]');
    eq('ArrowDown 阻止默认行为', down1.prevented, true);
    eq('ArrowDown 激活第一项', buttons[0].dataset.active, '1');

    const down2 = { target: input, key: 'ArrowDown', prevented: false, preventDefault() { this.prevented = true; } };
    document.dispatch('keydown', down2);
    eq('第二次 ArrowDown 激活第二项', buttons[1].dataset.active, '1');

    const enter = {
      target: input, key: 'Enter', prevented: false, stopped: false,
      preventDefault() { this.prevented = true; },
      stopPropagation() { this.stopped = true; },
    };
    document.dispatch('keydown', enter);
    eq('Enter 选择候选并阻止提交', enter.prevented, true);
    eq('Enter 同时停止事件传播', enter.stopped, true);
    eq('Enter 选择第二项中文名', input.value, '炎灵长袍');
    eq('选择后关闭候选框', box.hidden, true);

    input.value = '炎灵';
    document.dispatch('focusin', { target: input });
    await sleep();
    const freshBox = findSuggestBox(document);
    const buttons2 = freshBox.querySelectorAll('button[data-zhx-index]');
    const pointer = {
      target: buttons2[3],
      prevented: false,
      preventDefault() { this.prevented = true; },
    };
    document.dispatch('pointerdown', pointer);
    eq('pointerdown 阻止默认行为', pointer.prevented, true);
    eq('pointerdown 选择别名候选', input.value, '炎灵袍');
    eq('pointerdown 后关闭候选框', freshBox.hidden, true);
  }

  console.log('\n── D：IME / Esc / 未命中提示 ──');
  {
    installDocument();
    delete globalThis.__zhxChineseSearchBound;
    const harness = buildSearchHarness();
    const api = harness.api;
    const ready = harness.ready;
    const form = new FakeElement('form');
    const input = new FakeElement('input');
    input.form = form;
    input.name = 'keyword';
    input.setAttribute('type', 'search');
    input.setAttribute('placeholder', '装備品名等を入力');
    form.appendChild(input);
    api.startChineseSearch('mirapri');
    ready[0]();

    input.value = '炎灵';
    document.dispatch('focusin', { target: input });
    await sleep();
    const box = findSuggestBox(document);

    document.dispatch('compositionstart', { target: input });
    eq('compositionstart 立即关闭候选', box.hidden, true);

    input.value = '炎灵长';
    document.dispatch('input', { target: input });
    await sleep();
    eq('IME 组合期间不重新展示候选', box.hidden, true);

    document.dispatch('compositionend', { target: input });
    input.value = '炎灵';
    await sleep();
    eq('compositionend 后恢复候选查询', box.hidden, false);

    const esc = {
      target: input, key: 'Escape', prevented: false,
      preventDefault() { this.prevented = true; },
    };
    document.dispatch('keydown', esc);
    eq('Escape 阻止默认行为', esc.prevented, true);
    eq('Escape 关闭候选', box.hidden, true);

    input.value = '不存在装备';
    document.dispatch('input', { target: input });
    await sleep();
    eq('中文查询无候选时显示明确提示', box.hidden, false);
    const status = box.children[0];
    eq('未命中提示文本', status?.textContent, '未找到对应装备');
    eq('未命中提示使用 status 语义', status?.getAttribute('role'), 'status');
    eq('未命中提示容器切换为 status', box.getAttribute('role'), 'status');
  }

  console.log('\n── E：独立搜索框（无 form）— b 方案：输入停顿不转换 ──');
  {
    installDocument();
    delete globalThis.__zhxChineseSearchBound;
    const harness = buildSearchHarness();
    const api = harness.api;
    api.startChineseSearch('ronka');

    const standalone = new FakeElement('input');
    standalone.setAttribute('type', 'search');
    standalone.setAttribute('placeholder', '검색어를 입력해주세요');
    standalone.value = '炎灵';
    document.dispatch('input', { target: standalone });
    await sleep(750);
    eq('输入停顿后完整中文名保持原样（不自动转换）', standalone.value, '炎灵');
    eq('不派发 input 事件（不触发站点检索）', (standalone.dispatched || []).length, 0);

    const unknown = new FakeElement('input');
    unknown.setAttribute('type', 'search');
    unknown.setAttribute('placeholder', '검색어를 입력해주세요');
    unknown.value = '不存在装备';
    document.dispatch('input', { target: unknown });
    await sleep(750);
    eq('未命中中文名保持原样', unknown.value, '不存在装备');

    // b 方案：部分词也不转换（此前为公共子串自动替换；部分词兜底仍保留在提交路径）
    const partial = new FakeElement('input');
    partial.setAttribute('type', 'search');
    partial.setAttribute('placeholder', '검색어를 입력해주세요');
    partial.value = '丙丁';
    document.dispatch('input', { target: partial });
    await sleep(750);
    eq('部分词输入停顿保持原样（不自动转换）', partial.value, '丙丁');

    const partialNone = new FakeElement('input');
    partialNone.setAttribute('type', 'search');
    partialNone.setAttribute('placeholder', '검색어를 입력해주세요');
    partialNone.value = '甲乙丙丁戊';
    document.dispatch('input', { target: partialNone });
    await sleep(750);
    eq('部分词也无解时保持原样', partialNone.value, '甲乙丙丁戊');

    const plain = new FakeElement('input');
    plain.setAttribute('type', 'text');
    plain.setAttribute('placeholder', '备注');
    plain.value = '炎灵';
    document.dispatch('input', { target: plain });
    await sleep(750);
    eq('非搜索语义输入框不转换', plain.value, '炎灵');

    const form = new FakeElement('form');
    const inForm = new FakeElement('input');
    inForm.form = form;
    inForm.setAttribute('type', 'search');
    inForm.setAttribute('placeholder', '装備品名等を入力');
    form.appendChild(inForm);
    inForm.value = '炎灵';
    document.dispatch('input', { target: inForm });
    await sleep(750);
    eq('表单内搜索框不走独立转换（由提交路径处理）', inForm.value, '炎灵');
  }

  console.log('\n── F：vue-select 搜索框（EC 部位筛选器）— b 方案：不转换 + 候选面板 ──');
  {
    installDocument();
    delete globalThis.__zhxChineseSearchBound;
    const harness = buildSearchHarness();
    const api = harness.api;
    api.startChineseSearch('ec');

    const form = new FakeElement('form');
    const vs = new FakeElement('input');
    vs.form = form;
    vs.className = 'vs__search';
    vs.setAttribute('type', 'search');
    vs.setAttribute('placeholder', 'Any head');
    form.appendChild(vs);
    vs.value = '炎灵';
    document.dispatch('focusin', { target: vs });
    await sleep();
    harness.ready[0]();
    await sleep();
    document.dispatch('input', { target: vs });
    await sleep(750);
    eq('vue-select 输入停顿保持原样（不自动转换）', vs.value, '炎灵');
    eq('不派发 input 事件（不触发站点检索）', (vs.dispatched || []).length, 0);

    // b 方案新增：vue-select 也挂候选面板（点选候选时做转换式搜索）
    const vsBox = findSuggestBox(document);
    ok('vue-select 出现智能候选面板', !!vsBox && vsBox.hidden === false && vsBox.querySelectorAll('button[data-zhx-index]').length > 0);

    const plain = new FakeElement('input');
    plain.form = form;
    plain.setAttribute('type', 'text');
    plain.setAttribute('placeholder', '備考欄');
    form.appendChild(plain);
    plain.value = '炎灵';
    document.dispatch('input', { target: plain });
    await sleep(750);
    eq('非 vue-select 的表单内框不转换（回归保护）', plain.value, '炎灵');
  }

  console.log('\n── G：候选列表体验（全量数据 / 可视 8 行 / 滚动不关闭）──');
  {
    installDocument();
    delete globalThis.__zhxChineseSearchBound;
    const many = [{ zh: '炎灵', native: 'カ' }];
    for (let i = 1; i <= 12; i++) many.push({ zh: '炎灵装' + i, native: '装' });
    const harness = buildSearchHarness(many);
    const api = harness.api;
    api.startChineseSearch('mirapri');

    const form = new FakeElement('form');
    const input = new FakeElement('input');
    input.form = form;
    input.name = 'keyword';
    input.setAttribute('type', 'search');
    input.setAttribute('placeholder', '装備品名等を入力');
    form.appendChild(input);
    input.value = '炎灵';
    document.dispatch('focusin', { target: input });
    await sleep();
    harness.ready[0]();
    await sleep();

    const box = findSuggestBox(document);
    eq('G1 数据全量渲染（13 条 > 可视 8 行）', box.querySelectorAll('button[data-zhx-index]').length, 13);
    eq('G2 列表高度 = 可视 8 行（8×44+8=360px）', box.style.maxHeight, '360px');

    document.dispatch('scroll', { target: box });
    eq('G3a 列表自身滚动不关闭候选框', box.hidden, false);
    document.dispatch('scroll', { target: box.children[0] });
    eq('G3b 列表内元素滚动不关闭候选框', box.hidden, false);

    // 页面滚动（无滚动条的候选框链式滚动 / 滑到列表边界后继续滑）：
    // 输入框仍在视口 → 保持打开（跟随重定位）；滚出视口 → 关闭。
    document.dispatch('scroll', { target: document.body });
    eq('G4a 页面滚动但输入框仍在视口 → 保持打开', box.hidden, false);
    input._rect = { left: 20, top: 700, right: 240, bottom: 730, width: 220, height: 30 };
    document.dispatch('scroll', { target: document.body });
    eq('G4b 输入框滚出视口 → 关闭', box.hidden, true);
  }

  console.log('\n── H：独立搜索框智能输入（点选转换式搜索，保留中文）──');
  {
    installDocument();
    delete globalThis.__zhxChineseSearchBound;
    const harness = buildSearchHarness();
    const api = harness.api;
    api.startChineseSearch('ronka');

    // ronka 风格：无 form 的独立搜索框（React 站点）
    const input = new FakeElement('input');
    input.setAttribute('type', 'search');
    input.setAttribute('placeholder', '검색어를 입력하세요');
    input.value = '炎灵';
    document.dispatch('focusin', { target: input });
    await sleep();
    harness.ready[0]();
    await sleep();

    const box = findSuggestBox(document);
    eq('H1 独立框输入中文出现智能候选', box?.hidden, false);
    eq('H2 候选数量正确', box?.querySelectorAll('button[data-zhx-index]').length, 5);

    // b 方案：点选候选 → 转换式搜索（用原生名触发站点检索），显示随后恢复为中文
    const pointer = { target: box.children[0], prevented: false, preventDefault() { this.prevented = true; } };
    document.dispatch('pointerdown', pointer);
    eq('H3 点击候选后同步设为原生名（触发转换式搜索）', input.value, 'カ');
    eq('H3b 派发 input 事件（站内搜索用原生名）', (input.dispatched || []).includes('input'), true);
    eq('H3c 选择后关闭候选框', box.hidden, true);
    await sleep();
    eq('H4 显示恢复为中文（搜索后输入框保留中文）', input.value, '炎灵');
    await sleep(700);
    eq('H5 恢复后保持中文（无额外事件）', input.value, '炎灵');
  }
  console.log('\n── I：独立框按回车与点击搜索按钮 ──');
  for (const site of ['endcloset', 'ronka', 'collection', 'ec']) {
    installDocument();
    delete globalThis.__zhxChineseSearchBound;
    const harness = buildSearchHarness();
    harness.api.startChineseSearch(site);
    const host = new FakeElement('div');
    const input = new FakeElement('input');
    input.setAttribute('placeholder', site === 'endcloset' ? '搜索投影套装、装备名、标签...' : '搜索装备名');
    if (site === 'ec') input.className = 'vs__search';
    const button = new FakeElement('button');
    button.setAttribute('title', '执行搜索（回车）');
    host.append(input, button);
    const searched = [];
    input.dispatchEvent = (event) => { searched.push([event.type, input.value]); return true; };
    input.value = '炎灵';
    let prevented = false;
    document.dispatch('keydown', { target: input, key: 'Enter', preventDefault() { prevented = true; } });
    eq(site + ' 回车前转换为原生名', input.value, 'カ');
    eq(site + ' 保留站点回车事件', prevented, false);
    ok(site + ' 通过 input 事件更新站点状态', searched.some(([type, value]) => type === 'input' && value === 'カ'));
    await sleep();
    eq(site + ' 回车后保留中文显示', input.value, '炎灵');
    input.value = '炎灵';
    document.dispatch('click', { target: button });
    eq(site + ' 搜索按钮转换使用相同原生名', input.value, 'カ');
    await sleep();
    eq(site + ' 搜索按钮后保留中文显示', input.value, '炎灵');
    input.value = '丙丁';
    document.dispatch('keydown', { target: input, key: 'Enter' });
    eq(site + ' 显式搜索支持部分中文词', input.value, 'ウエ');
    await sleep();
    input.value = '不存在装备';
    document.dispatch('keydown', { target: input, key: 'Enter' });
    eq(site + ' 未知中文词不改写', input.value, '不存在装备');
    input.value = '炎灵';
    document.dispatch('compositionstart', { target: input });
    document.dispatch('keydown', { target: input, key: 'Enter', isComposing: true });
    document.dispatch('click', { target: button });
    eq(site + ' 输入法确认期间不触发转换', input.value, '炎灵');
    document.dispatch('compositionend', { target: input });
    await sleep();
    input.value = '炎灵';
    document.dispatch('keydown', { target: input, key: 'Enter' });
    await sleep(150);
    input.value = 'カ'; // 模拟 React 在结果加载后回写受控值。
    await sleep(450);
    eq(site + ' 受控框回写后再次恢复中文显示', input.value, '炎灵');
    input.value = '用户继续输入';
    document.dispatch('input', { target: input });
    await sleep(1000);
    eq(site + ' 延迟恢复不会覆盖后续输入', input.value, '用户继续输入');
  }
  console.log('\n── J：表单选择候选即提交，选中别名保持原生名称 ──');
  {
    installDocument();
    delete globalThis.__zhxChineseSearchBound;
    const harness = buildSearchHarness();
    harness.api.startChineseSearch('mirapri');
    const form = new FakeElement('form');
    const input = new FakeElement('input');
    input.form = form;
    input.name = 'keyword';
    input.setAttribute('type', 'search');
    input.setAttribute('placeholder', '装備品名等を入力');
    form.appendChild(input);
    input.value = '炎灵';
    const previousFormData = globalThis.FormData;
    const previousLocation = globalThis.location;
    const urls = [];
    let submissions = 0;
    globalThis.FormData = class {
      entries() { return [['keyword', input.value]][Symbol.iterator](); }
    };
    globalThis.location = { href: 'https://mirapri.com/', assign(url) { urls.push(url); } };
    form.requestSubmit = () => {
      submissions++;
      harness.api.handleChineseSearchSubmit({
        target: form, preventDefault() {}, stopPropagation() {},
      }, 'mirapri');
    };
    try {
      harness.ready[0]();
      document.dispatch('focusin', { target: input });
      await sleep();
      const box = findSuggestBox(document);
      document.dispatch('pointerdown', {
        target: box.querySelectorAll('button[data-zhx-index]')[3],
        preventDefault() {},
      });
      eq('候选点击调用站点 requestSubmit 一次', submissions, 1);
      eq('提交别名使用候选绑定的原生名称，不重新猜测', new URL(urls[0]).searchParams.get('keyword'), 'エ');
      eq('候选中文显示不被提交时的原生名称覆盖', input.value, '炎灵袍');
    } finally {
      globalThis.FormData = previousFormData;
      if (previousLocation === undefined) delete globalThis.location;
      else globalThis.location = previousLocation;
    }
  }
  console.log('\n── K：渐进加载与手机软键盘可视视口 ──');
  {
    installDocument();
    delete globalThis.__zhxChineseSearchBound;
    const rows = [];
    for (let i = 0; i < 170; i++) rows.push({ zh: '炎灵装备' + i, native: 'ネイティブ' + i });
    const harness = buildSearchHarness(rows);
    harness.api.startChineseSearch('fc');
    const form = new FakeElement('form');
    const input = new FakeElement('input');
    input.form = form;
    input.name = 'keyword';
    input.setAttribute('type', 'search');
    input.setAttribute('placeholder', '装備名の一部を入力して検索');
    form.appendChild(input);
    input.value = '炎灵';
    const previousView = globalThis.visualViewport;
    globalThis.visualViewport = { width: 320, height: 260, offsetLeft: 0, offsetTop: 100, addEventListener() {} };
    input._rect = { left: 12, top: 310, right: 250, bottom: 340, width: 238, height: 30 };
    try {
      harness.ready[0]();
      document.dispatch('focusin', { target: input });
      await sleep();
      const box = findSuggestBox(document);
      eq('170 条只初始渲染 80 个 DOM 节点', box.querySelectorAll('button[data-zhx-index]').length, 80);
      eq('弹窗顶部不超出 visualViewport', Number.parseFloat(box.style.top) >= 100, true);
      eq('弹窗宽度受 visualViewport 限制', Number.parseFloat(box.style.width) <= 304, true);
      box.scrollTop = 980;
      box.clientHeight = 150;
      box.scrollHeight = 1000;
      document.dispatch('scroll', { target: box });
      eq('接近底部追加第二批 80 条', box.querySelectorAll('button[data-zhx-index]').length, 160);
      for (let i = 0; i <= 160; i++) {
        document.dispatch('keydown', { target: input, key: 'ArrowDown', preventDefault() {} });
      }
      eq('键盘导航跨过已渲染批次后继续追加', box.querySelectorAll('button[data-zhx-index]').length, 170);
      eq('键盘导航可激活第 161 条', box.querySelectorAll('button[data-zhx-index]')[160].dataset.active, '1');
    } finally {
      if (previousView === undefined) delete globalThis.visualViewport;
      else globalThis.visualViewport = previousView;
    }
  }
  console.log('\n── M：EC Gearsets 必须提交到原站 GET search，兼容无表单、表单与候选 ──');
  {
    installDocument();
    delete globalThis.__zhxChineseSearchBound;
    const originalLocation = globalThis.location;
    const navigations = [];
    globalThis.location = {
      hostname: 'ffxiv.eorzeacollection.com',
      pathname: '/gearsets',
      href: 'https://ffxiv.eorzeacollection.com/gearsets?filter%5Bjob%5D=PLD&page=8',
      assign(url) { navigations.push(url); },
    };
    try {
      const harness = buildSearchHarness();
      harness.api.startChineseSearch('ec');
      const form = new FakeElement('form');
      const input = new FakeElement('input');
      input.form = form;
      input.name = 'search';
      input.setAttribute('type', 'search');
      input.setAttribute('placeholder', 'Search...');
      form.appendChild(input);
      const ignored = new FakeElement('input');
      ignored.form = form;
      ignored.setAttribute('placeholder', 'Filter by head');
      form.appendChild(ignored);
      ok('M1 主搜索框在 gearsets 页面识别成功',
        harness.api.findSearchInput(form) === input);
      // 站点翻译会把 Search... 改写成 搜索…；主搜索字段必须继续能识别。
      input.setAttribute('placeholder', '搜索…');

      // 不手动触发 onTablesReady：套装词典不应被 V3 物品数据就绪状态阻塞。
      input.value = '幻境';
      document.dispatch('focusin', { target: input });
      await sleep();
      const box = findSuggestBox(document);
      eq('M2 V3 未就绪也出现套装中文候选', box?.hidden, false);
      eq('M3 套装候选显示英文搜索关键词',
        box?.querySelectorAll('button[data-zhx-index]')[0]?.children[1]?.textContent,
        'Phantom Vision Fending');
      document.dispatch('pointerdown', {
        target: box.querySelectorAll('button[data-zhx-index]')[0],
        preventDefault() {},
      });
      eq('M4 候选点击只导航一次', navigations.length, 1);
      const selectedUrl = new URL(navigations[0]);
      eq('M5 用原站 search 参数查询真实英文套装',
        selectedUrl.searchParams.get('search'), 'Phantom Vision Fending');
      eq('M6 原有职业筛选保留', selectedUrl.searchParams.get('filter[job]'), 'PLD');
      eq('M7 换关键词回到第一页', selectedUrl.searchParams.has('page'), false);

      input.value = '御敌';
      const submit = {
        target: form, prevented: false, stopped: false,
        preventDefault() { this.prevented = true; },
        stopPropagation() { this.stopped = true; },
      };
      document.dispatch('submit', submit);
      eq('M8 表单提交转换中文职能并导航', new URL(navigations[1]).searchParams.get('search'), 'Fending');
      eq('M9 表单提交阻止原生重复提交', submit.prevented && submit.stopped, true);

      input.value = '幻境';
      const enter = {
        target: input, key: 'Enter', prevented: false, stopped: false,
        preventDefault() { this.prevented = true; },
        stopPropagation() { this.stopped = true; },
      };
      document.dispatch('keydown', enter);
      eq('M10 回车导航使用原站 search 参数', new URL(navigations[2]).searchParams.get('search'), 'Phantom Vision');
      eq('M11 回车阻止重复提交', enter.prevented && enter.stopped, true);

      ignored.value = '幻境';
      document.dispatch('keydown', { target: ignored, key: 'Enter', preventDefault() {} });
      eq('M12 其他过滤框不能触发套装搜索', navigations.length, 3);
      input.value = '未知套装';
      const unknown = { target: input, key: 'Enter', prevented: false, preventDefault() { this.prevented = true; } };
      document.dispatch('keydown', unknown);
      eq('M13 未知中文套装不乱转换', navigations.length, 3);
      eq('M14 未知关键词保留原站处理', unknown.prevented, false);

      // 套装页还可能使用无 form 的动态搜索框，必须同样可靠提交。
      const independent = new FakeElement('input');
      independent.setAttribute('type', 'search');
      independent.setAttribute('placeholder', '搜索…');
      independent.value = '幻境';
      const independentEnter = { target: independent, key: 'Enter', preventDefault() {}, stopPropagation() {} };
      document.dispatch('keydown', independentEnter);
      eq('M15 无表单搜索框回车也导航', new URL(navigations[3]).searchParams.get('search'), 'Phantom Vision');

      globalThis.location.pathname = '/gearsets/casters';
      globalThis.location.href = 'https://ffxiv.eorzeacollection.com/gearsets/casters?page=3';
      independent.value = '幻境';
      document.dispatch('keydown', independentEnter);
      eq('M16 职业分类套装页也支持中文搜索', new URL(navigations[4]).pathname, '/gearsets/casters');
      eq('M17 职业分类搜索参数正确', new URL(navigations[4]).searchParams.get('search'), 'Phantom Vision');
      globalThis.location.pathname = '/gearset/phantom-vision-fending';
      independent.value = '幻境';
      document.dispatch('keydown', independentEnter);
      eq('M18 单件套装详情页不接管搜索', navigations.length, 5);
      globalThis.location.pathname = '/glamours';
      independent.value = '幻境';
      document.dispatch('keydown', independentEnter);
      eq('M19 EC 其他页面不走 Gearsets 专用导航', navigations.length, 5);
    } finally {
      if (originalLocation === undefined) delete globalThis.location;
      else globalThis.location = originalLocation;
    }
  }

  console.log('\n── N：EC 鸟甲 / 独立面饰表 / 五大装备部位，智能输入端到端分类 ──');
  {
    installDocument();
    delete globalThis.__zhxChineseSearchBound;
    const oldLocation = globalThis.location;
    const suggestions = [
      { zh: '鸟甲飞行', native: 'Flyer Shaffron', slot: 5 },
      { zh: '鸟甲护具', native: 'Some Non-Barding Headgear', slot: 0 },
      { zh: '装备头盔', native: 'Official Head', slot: 0 },
      { zh: '装备长袍', native: 'Official Body', slot: 1 },
      { zh: '装备手套', native: 'Official Hands', slot: 2 },
      { zh: '装备长裤', native: 'Official Legs', slot: 3 },
      { zh: '装备靴子', native: 'Official Feet', slot: 4 },
      { zh: '饰品耳环', native: 'Abyssos Earrings of Fending', slot: 9 },
      { zh: '饰品戒指', native: 'Abyssos Ring of Fending', slot: 12 },
      { zh: '饰品头盔', native: 'Official Head', slot: 0 },
    ];
    try {
      const harness = buildSearchHarness(suggestions);
      harness.api.startChineseSearch('ec');
      const input = new FakeElement('input');
      input.className = 'vs__search';
      input.setAttribute('type', 'search');
      input.setAttribute('placeholder', 'Search for option');
      globalThis.location = { hostname: 'ffxiv.eorzeacollection.com', pathname: '/facewear' };
      input.value = '椭圆眼镜';
      document.dispatch('focusin',{target:input});
      await sleep();
      eq('N0 面饰独立 Glasses 数据不依赖 V3 网络成功也可以出现中文候选',
        findSuggestBox(document)?.hidden, false);
      for (const cb of harness.ready) cb();
      input.setAttribute('placeholder', 'Any head');
      globalThis.location.pathname = '/companion-glamours';
      eq('N1 鸟甲页面分类不是通用物品', harness.api.ecSearchContext(input)?.kind, 'barding');
      eq('N2 候选使用官方 ItemAction 鸟甲集合，排除误含鸟甲二字的头盔',
        harness.api.ecScopedSuggestions('鸟甲',input).map(r=>r.native).join('|'),'Flyer Shaffron');
      eq('N3 只输入一个完整鸟甲中文名可得到对应英文名称',
        harness.api.ecScopedNative('鸟甲飞行',input,false),'Flyer Shaffron');
      input.value = '鸟甲';
      document.dispatch('focusin',{target:input});
      await sleep();
      let box = findSuggestBox(document);
      eq('N4 鸟甲页输入联想只渲染鸟甲',
        box?.querySelectorAll('button[data-zhx-index]').map(btn=>btn.children[1]?.textContent).join('|'),
        'Flyer Shaffron');
      document.dispatch('pointerdown',{target:box.querySelectorAll('button[data-zhx-index]')[0],preventDefault(){}});
      eq('N5 选择鸟甲候选派发站点原生 input 事件',input.dispatched.includes('input'),true);
      globalThis.location.pathname = '/facewear';
      input.value = '椭圆眼镜';
      eq('N6 面饰路由强制对应游戏独立 Glasses 表',harness.api.ecSearchContext(input)?.kind,'facewear');
      const faces=harness.api.ecScopedSuggestions('眼镜',input);
      ok('N7 中文面饰数据来自 Glasses Sheet',faces.some(row=>row.native==='Oval Spectacles'&&row.zh==='椭圆眼镜'));
      ok('N8 不会误含头部装备/鸟甲',faces.every(row=>row.zh.includes('眼镜')&&row.native!=='Flyer Shaffron'));
      eq('N9 面饰精确中文名解析为正确的 EC 原生英文',
        harness.api.ecScopedNative('椭圆眼镜',input,false),'Oval Spectacles');
      eq('N10 不把头盔当成面饰候选',harness.api.ecScopedSuggestions('鸟甲',input).length,0);
      input.value = '椭圆眼镜';
      document.dispatch('focusin',{target:input});
      await sleep();
      box=findSuggestBox(document);
      ok('N11 面饰弹出候选全部来自官方 Glasses Sheet，不把普通眼镜装备混入',
        box?.querySelectorAll('button[data-zhx-index]').every(btn=>
          harness.api.facewearNatives.has(btn.children[1]?.textContent)));
      globalThis.location.pathname = '/gearsets';
      for (const [enSlot,expectedSlot,expectedName] of [
        ['head',0,'Some Non-Barding Headgear|Official Head'],['body',1,'Official Body'],
        ['hands',2,'Official Hands'],['legs',3,'Official Legs'],['feet',4,'Official Feet'],
      ]) {
        input.setAttribute('placeholder','Any '+enSlot);
        eq('N 识别 EC '+enSlot+' 的官方装备部位',harness.api.ecSearchContext(input)?.slot,expectedSlot);
        eq('N EC '+enSlot+' 只保留同部位候选',harness.api.ecScopedSuggestions('装备',input).map(r=>r.native).join('|'),expectedName);
      }
      input.setAttribute('placeholder','Search for option');
      const field = new FakeElement('div');
      field.textContent = 'HEAD';
      input.parentElement = field;
      eq('N 未提供部位 placeholder 时，读取邻近单一 HEAD 标签',
        harness.api.ecSearchContext(input)?.slot, 0);
      field.textContent = 'HEAD BODY';
      eq('N 多个邻近部位冲突时不猜测所属部位', harness.api.ecSearchContext(input), null);
      input.parentElement = null;
      input.setAttribute('placeholder','手部筛选');
      eq('N 已汉化的部位名称也能准确识别', harness.api.ecSearchContext(input)?.slot, 2);
      const main = new FakeElement('input');
      main.setAttribute('placeholder','搜索');
      eq('N12 Gearsets 普通主搜索不误判为头部槽位',harness.api.ecSearchContext(main),null);
      eq('N13 Gearsets 主搜索继续使用套装专用中文索引',
        harness.api.ecScopedSuggestions('幻境',main)[0]?.native,'Phantom Vision Fending');
      globalThis.location.pathname = '/accessories';
      input.setAttribute('placeholder','Search for option');
      eq('N15 未绑定具体部位的饰品搜索框也只能显示饰品',
        harness.api.ecSearchContext(input)?.kind, 'accessories');
      eq('N16 饰品列表使用官方耳颈腕指部位的并集，不会显示普通头盔',
        harness.api.ecScopedSuggestions('饰品',input).map(r=>r.native).join('|'),
        'Abyssos Earrings of Fending|Abyssos Ring of Fending');
      input.setAttribute('placeholder','Any earrings');
      eq('N17 饰品页已绑定耳部的 Vue 输入优先限定耳部',
        harness.api.ecSearchContext(input)?.kind, 'accessory-slot');
      eq('N18 饰品耳部候选排除同系列戒指',
        harness.api.ecScopedSuggestions('饰品',input).map(r=>r.native).join('|'),
        'Abyssos Earrings of Fending');
      globalThis.location.pathname = '/accessories/mistic-memory';
      main.value = '饰品';
      eq('N19 饰品详情页无具体部位的输入也保持饰品范围',
        harness.api.ecScopedSuggestions('饰品',main).length, 2);
      globalThis.location.hostname = 'ff14-fc.com';
      eq('N14 非 EC 页面不启用分类路由',harness.api.ecSearchContext(input),null);
    } finally {
      if (oldLocation === undefined) delete globalThis.location;
      else globalThis.location = oldLocation;
    }
  }

  console.log('\n── L：六站输入框隔离 / 搜索能力矩阵 ──');
  for (const site of ['mirapri', 'fc', 'ronka', 'collection', 'ec', 'endcloset']) {
    installDocument();
    delete globalThis.__zhxChineseSearchBound;
    const { api } = buildSearchHarness();
    api.startChineseSearch(site);
    const equipment = new FakeElement('input');
    equipment.setAttribute('type', 'search');
    equipment.setAttribute('placeholder', '搜索装备名');
    eq(site + ' 装备独立搜索框可识别', api.isStandaloneSearchInput(equipment), true);

    const author = new FakeElement('input');
    author.setAttribute('type', 'text');
    author.setAttribute('name', 'search_by_player');
    author.setAttribute('placeholder', 'Search by player');
    eq(site + ' 玩家字段不得误接管', api.isStandaloneSearchInput(author), false);

    const title = new FakeElement('input');
    title.setAttribute('type', 'text');
    title.setAttribute('placeholder', 'Search by title');
    eq(site + ' 标题字段不得误接管', api.isStandaloneSearchInput(title), false);

    const masked = new FakeElement('input');
    masked.setAttribute('type', 'password');
    masked.setAttribute('placeholder', 'Search');
    eq(site + ' 密码字段不得误接管', api.isStandaloneSearchInput(masked), false);

    const vueSelect = new FakeElement('input');
    vueSelect.setAttribute('type', 'search');
    vueSelect.setAttribute('placeholder', 'Any head');
    vueSelect.className = 'vs__search';
    vueSelect.form = new FakeElement('form');
    eq(site + ' vue-select 只有 EC 允许接管', api.isStandaloneSearchInput(vueSelect), site === 'ec');
  }
} finally {
  globalThis.document = previousDocument;
  if (previousAddEventListener === undefined) delete globalThis.addEventListener;
  else globalThis.addEventListener = previousAddEventListener;
  if (previousInnerWidth === undefined) delete globalThis.innerWidth;
  else globalThis.innerWidth = previousInnerWidth;
  if (previousInnerHeight === undefined) delete globalThis.innerHeight;
  else globalThis.innerHeight = previousInnerHeight;
  if (previousBound === undefined) delete globalThis.__zhxChineseSearchBound;
  else globalThis.__zhxChineseSearchBound = previousBound;
}

console.log('\n════════ 汇总 ════════');
console.log('通过 ' + pass + ' / 失败 ' + fail);
if (fail > 0) process.exit(1);
console.log('── ✅ 通过（exit=0）');
