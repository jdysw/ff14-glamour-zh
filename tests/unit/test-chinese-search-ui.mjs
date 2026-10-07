// tests/unit/test-chinese-search-ui.mjs — v1.4.2 中文装备搜索 UI 行为
//
// 目的：冻结智能输入的 DOM/UI 契约，不依赖真实站点、Chrome 或第三方 DOM 库。
//       采用最小 DOM harness 驱动 canonical source，验证事件绑定、候选渲染、
//       键盘 / pointer / IME、视口定位、未命中提示和搜索框缓存。
//       数据层排序与解析契约由 test-item-resolver.mjs 独立验证。

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
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'id') this.id = String(value);
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

function buildSearchHarness() {
  const ready = [];
  const suggestions = Object.freeze([
    { zh: '炎灵', native: 'カ' },
    { zh: '炎灵长袍', native: 'エ' },
    { zh: '炎灵长裤', native: 'オ' },
    { zh: '炎灵袍', native: 'エ' },
    { zh: '炎灵裤', native: 'オ' },
  ]);
  const seg = sliceSource(SOURCE_TEXT);
  const body = [
    'const onTablesReady = (cb) => { __ready.push(cb); };',
    'const resolveByZh = (v) => ({甲: "ア", 乙: "ガ"})[v] || null;',
    'const suggestByZh = (v) => v === "炎灵" ? __suggestions.slice() : (v === "炎灵袍" ? __suggestions.slice(3, 4) : []);',
    seg,
    'return { startChineseSearch, handleChineseSearchSubmit, findSearchInput };',
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
    eq('候选框底部空间不足时向上弹出', Number(box?.style.top) < input._rect.top, true);
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
