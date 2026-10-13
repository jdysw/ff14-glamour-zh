// 浏览器事件契约的真实中文搜索 ESM 覆盖：不改生产源码，隔离 DOM/Timer/GM。
// 校验中文输入法组合态、候选空态、视口滚动、GET 与 React 独立框事件。
import test from 'node:test';
import assert from 'node:assert/strict';
import { _applyV3, dataInvalidate } from '../../src/core/data-manager.js';
import { handleChineseSearchSubmit, startChineseSearch } from '../../src/core/chinese-search.js';

const original = new Map([
  'window', 'document', 'location', 'FormData', 'setTimeout', 'clearTimeout',
  'innerWidth', 'innerHeight', '__zhxChineseSearchBound',
].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const timers = new Map();
let timerId = 0;
globalThis.setTimeout = (fn, delay) => {
  const id = ++timerId;
  timers.set(id, { fn, delay });
  return id;
};
globalThis.clearTimeout = id => timers.delete(id);
function runTimers(delay) {
  const matches = [...timers].filter(([, item]) => item.delay === delay);
  for (const [id, item] of matches) {
    timers.delete(id);
    item.fn();
  }
}
function element(tagName) {
  const attributes = new Map();
  const children = [];
  return {
    tagName: tagName.toUpperCase(), nodeType: 1, dataset: {}, style: {},
    value: '', className: '', textContent: '', id: '', hidden: false,
    children, isConnected: true, disabled: false, readOnly: false,
    getAttribute: name => attributes.get(name) ?? null,
    setAttribute(name, value) { attributes.set(name, String(value)); },
    removeAttribute: name => attributes.delete(name),
    appendChild(child) { children.push(child); child.parentElement = this; return child; },
    append(...nodes) { for (const node of nodes) this.appendChild(node); },
    replaceChildren(...nodes) {
      children.length = 0;
      this.append(...nodes);
    },
    querySelectorAll(selector) {
      const result = [];
      function walk(node) {
        for (const child of node.children) {
          if ((selector === 'button[data-zhx-index]' && child.tagName === 'BUTTON'
              && child.dataset.zhxIndex !== undefined)
            || (selector === 'input' && child.tagName === 'INPUT')) result.push(child);
          if (child.children) walk(child);
        }
      }
      walk(this);
      return result;
    },
    contains(node) {
      if (this === node) return true;
      return children.some(child => child === node || child.contains?.(node));
    },
    closest() { return null; },
    getBoundingClientRect() { return this.rect || { top: 90, left: 120, right: 320, bottom: 118, width: 200 }; },
    focus() { this.focused = true; },
    setSelectionRange(start, end) { this.selection = [start, end]; },
    dispatchEvent(evt) { (this.events ||= []).push(evt.type); return true; },
    scrollIntoView() { this.scrolled = true; },
  };
}
const handlers = new Map();
const body = element('BODY');
const head = element('HEAD');
const root = element('HTML');
root.clientWidth = 1024;
root.clientHeight = 768;
const document = {
  body, head, documentElement: root,
  addEventListener(name, cb, capture) {
    assert.equal(capture, true);
    if (!handlers.has(name)) handlers.set(name, []);
    handlers.get(name).push(cb);
  },
  createElement: tag => element(tag),
};
const location = {
  hostname: 'ffxiv.eorzeacollection.com', pathname: '/facewear',
  href: 'https://ffxiv.eorzeacollection.com/facewear?page=4',
  assign() { throw new Error('没有明确提交时不可擅自跳转'); },
};
for(const [key,value] of Object.entries({
  document, location, innerWidth: 1024, innerHeight: 768,
})) globalThis[key]=value;
assert.equal(_applyV3({ candidatePolicy: 1, names: 'English Gear\t测试中文装备\t1\t0\n' }), true);
const fire = (name, event) => {
  assert.ok(handlers.has(name), '绑定后必须监听 ' + name);
  for (const fn of handlers.get(name)) fn(event);
};
const event = (target, key = '') => ({
  target, key, keyCode: 0, prevented: false, stopped: false,
  preventDefault() { this.prevented = true; },
  stopPropagation() { this.stopped = true; },
});

test('七站搜索入口：只绑定一次，表单输入组合态中不得弹候选', () => {
  assert.equal(startChineseSearch('unknown'), undefined);
  startChineseSearch('ec');
  assert.equal(globalThis.__zhxChineseSearchBound, true);
  assert.equal(handlers.get('input').length, 2);
  assert.equal(handlers.get('submit').length, 1);
  startChineseSearch('ec');
  assert.equal(handlers.get('input').length, 2, '必须避免 SPA 重入重复注册');

  const form = {
    querySelectorAll() { return [this.input]; },
    contains(value) { return value === this.input; },
    getAttribute(name) { return name === 'method' ? 'get' : name === 'action' ? '/' : null; },
  };
  const input = element('INPUT');
  input.value = '测试中文装备';
  input.name = 'keyword';
  input.setAttribute('name', 'keyword');
  input.setAttribute('placeholder', 'Search...');
  input.form = form;
  form.input = input;

  fire('compositionstart', event(input));
  fire('focusin', event(input));
  assert.equal([...timers.values()].some(x => x.delay === 70), false,
    '输入法组合期间不得展示候选');
  fire('compositionend', event(input));
  assert.ok([...timers.values()].some(x => x.delay === 70));
  runTimers(70);
  const box = body.children.find(x => x.id === 'zhx-chinese-suggest-list');
  assert.ok(box, 'EC 面饰页必须在 V3 尚未 ready 时也能显示已有本地候选结果');
  assert.equal(box.hidden, false);
  assert.equal(box.getAttribute('role'), 'status', '无匹配时应显示明确空结果状态');
  assert.equal(box.children[0].textContent, '未找到对应装备');
  assert.equal(input.getAttribute('aria-expanded'), 'true');
  assert.ok(box.style.left.endsWith('px'));
  assert.ok(box.style.width.endsWith('px'));

  fire('scroll', event(body));
  assert.equal(box.hidden, false, '输入框仍在视口中时页面滚动不可无故关闭');
  input.rect = { top: -400, left: 20, right: 200, bottom: -350, width: 180 };
  fire('scroll', event(body));
  assert.equal(box.hidden, true, '滚出视口必须关闭候选');
  input.rect = null;

  input.value = '中';
  fire('input', event(input));
  runTimers(70);
  assert.equal(box.hidden, true, '过短中文不得打开候选');
  input.value = '测试中文装备';
  fire('focusin', event(input));
  runTimers(70);
  assert.equal(box.hidden, false);
  fire('focusout', event(input));
  runTimers(120);
  assert.equal(box.hidden, true, '离焦延迟后关闭候选');
  fire('pointerdown', event(body));
  fire('keydown', event(input, 'Escape'));
});

test('GET 查询转换：真实中文名称索引、安全保留有效筛选，英文原生词不改写', () => {
  const nativeFormData = globalThis.FormData;
  const originalLocation = globalThis.location;
  const calls = [];
  try {
    globalThis.location = {
      hostname: 'mirapri.com', pathname: '/',
      href: 'https://mirapri.com/?page=1',
      assign(url) { calls.push(url); },
    };
    const form = {
      input: null,
      querySelectorAll() { return [this.input]; },
      getAttribute(name) { return name === 'method' ? 'get' : name === 'action' ? '/?sort=1' : null; },
    };
    const input = element('INPUT');
    input.setAttribute('name', 'keyword');
    input.name = 'keyword';
    input.form = form;
    input.value = '测试中文装备';
    form.input = input;
    globalThis.FormData = class {
      entries() {
        return [['keyword', '测试中文装备'], ['page', '2'], ['empty', '']][Symbol.iterator]();
      }
    };
    const submitted = event(form);
    handleChineseSearchSubmit(submitted, 'mirapri');
    assert.equal(submitted.prevented, true);
    assert.equal(submitted.stopped, true);
    assert.equal(calls.length, 1);
    const u = new URL(calls[0]);
    assert.equal(u.searchParams.get('keyword'), 'English Gear');
    assert.equal(u.searchParams.get('page'), '2');
    assert.equal(u.searchParams.get('sort'), '1');
    assert.equal(u.searchParams.has('empty'), false);

    input.value = 'English Gear';
    handleChineseSearchSubmit(event(form), 'mirapri');
    assert.equal(calls.length, 1, '原生英文搜索不应改写');
    assert.equal(handleChineseSearchSubmit(event(form), 'non-site'), undefined);
  } finally {
    globalThis.FormData = nativeFormData;
    globalThis.location = originalLocation;
  }
});

test('独立搜索框：搜索按钮仅在显式提交时派发原生 input 并恢复中文显示', () => {
  const oldLocation = globalThis.location;
  globalThis.location = {
    hostname: 'mirapri.com', pathname: '/',
    href: 'https://mirapri.com/',
  };
  try {
    const container = element('DIV');
    container.parentElement = body;
    const field = element('INPUT');
    field.setAttribute('placeholder', 'Search...');
    field.value = '测试中文装备';
    container.appendChild(field);
    const button = element('BUTTON');
    button.textContent = '搜索';
    container.appendChild(button);
    button.closest = selector => selector.includes('button, input[type="submit"]') ? button : null;
    fire('click', event(button));
    assert.equal(field.events?.filter(x => x === 'input').length, 1,
      '点击搜索应仅触发一次用于站点检索的原生 input');
    assert.equal(field.value, 'English Gear');
    runTimers(0);
    assert.equal(field.value, '测试中文装备', '显示恢复不能重复发 input 事件');
    assert.equal(field.events.length, 1);
    field.value = '测试中文装备';
    fire('keydown', event(field, 'Enter'));
    assert.equal(field.events.length, 2, '独立搜索框 Enter 应和按钮一致执行转换');
    runTimers(0);
    assert.equal(field.value, '测试中文装备');
  } finally {
    globalThis.location = oldLocation;
  }
});

test.after(() => {
  timers.clear();
  dataInvalidate();
  for (const [key, descriptor] of original) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
});
