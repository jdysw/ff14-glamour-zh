// 直接加载生产 Probe ESM 的诊断、统计与浏览器只读 UI 行为。
// 诊断只在本地可见；测试不发送网络请求、不执行 22 秒延迟，也不伪造命中。
import test from 'node:test';
import assert from 'node:assert/strict';

const previous = new Map(['window', 'location', 'navigator', 'document', 'setTimeout', 'clearTimeout']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const listeners = new Map();
const window = {
  __zhxDiagOn: true,
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 2,
  addEventListener(type, fn) { listeners.set(type, fn); },
};
const location = {
  hostname: 'mirapri.com', protocol: 'https:', search: '', hash: '',
  href: 'https://mirapri.com/equipment/',
};
const navigator = { userAgent: 'coverage-node-agent' };
function node(tag) {
  return {
    tagName: tag.toUpperCase(), nodeType: 1, style: {}, children: [],
    textContent: '', id: '', value: '', dataset: {}, readOnly: false,
    appendChild(child) { this.children.push(child); child.parentElement = this; return child; },
    remove() { this.removed = true; },
    focus() { this.focused = true; },
    select() { this.selected = true; },
    querySelector(sel) {
      const id = sel.startsWith('#') ? sel.slice(1) : '';
      const walk = el => {
        if (id && el.id === id) return el;
        for (const child of el.children) {
          const match = walk(child);
          if (match) return match;
        }
        return null;
      };
      return walk(this);
    },
  };
}
const body = node('body');
const document = {
  title: '单元测试',
  readyState: 'loading',
  body,
  documentElement: node('html'),
  createElement: node,
  getElementById(id) { return body.querySelector('#' + id); },
  execCommand(command) { assert.equal(command, 'copy'); return true; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
};
document.documentElement.dataset = {};
for (const [key, value] of Object.entries({ window, location, navigator, document })) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
const P = await import('../../src/core/probe.js');

test('Probe 默认只注册诊断入口：诊断标记/缓存规模为可观测真实统计', () => {
  assert.equal(P.__zhxProbeOn(), false);
  assert.equal(typeof window.__zhxDiagRecord, 'function');
  assert.equal(window.__zhxProbeDump, undefined, '非探测 URL 不应自动弹诊断面板');
  assert.equal(P.__zhxProbeBtnCss.includes('cursor:pointer'), true);
  P.__zhxMark('unit-native');
  assert.equal(typeof window.__zhxMarks['unit-native'], 'number');
  const record = P.__zhxDiagRecord();
  assert.equal(record.v, 1);
  assert.equal(typeof record.boot, 'number');
  assert.equal(typeof record.obs.ticks, 'number');
  assert.equal(typeof record.dom.calls, 'number');
  assert.equal(typeof record.scan.local, 'number');
  assert.equal(typeof record.dl.net, 'number');
  assert.equal(typeof record.res.hit, 'number');
  assert.equal(typeof record.dict.chars, 'number');
  assert.ok(record.dict.chars > 0);
  assert.ok(Object.hasOwn(record.cache, 'entries'));
  assert.equal(record.marks['unit-native'], window.__zhxMarks['unit-native']);
  assert.ok(P.__zhxDictChars() > 0);
});

test('Probe 文本：环境、缓存来源、版本及 Wiki 专项域名隔离', () => {
  const env = [];
  P.__zhxProbeEnv(env);
  assert.equal(env[0], 'ZHX-PROBE: v1');
  assert.ok(env.some(line => line === 'site: mirapri.com'));
  assert.ok(env.some(line => line.includes('view: 1280x720 dpr=2')));
  const metrics = [];
  P.__zhxProbeData(metrics);
  assert.ok(metrics.some(line => line.startsWith('marks: ')));
  assert.ok(metrics.some(line => line.startsWith('idx: nameMap=')));
  assert.ok(metrics.some(line => line.startsWith('cache: ')));
  assert.ok(metrics.some(line => line.startsWith('dict: ')));
  const before = metrics.length;
  P.__zhxProbeWiki(metrics);
  assert.equal(metrics.length, before, '其它站点不得采集 Wiki DOM');
  assert.ok(P.__zhxProbeText().includes('ZHX-PROBE: v1'));

  location.search = '?zhx_probe=1';
  assert.equal(P.__zhxProbeOn(), true);
  location.search = '';
  location.hash = '#zhx_probe';
  assert.equal(P.__zhxProbeOn(), true);
  location.hash = '';
  location.protocol = 'file:';
  P.__zhxProbeWiki(metrics);
  assert.ok(metrics.some(line => line.startsWith('wiki: ')));
  location.protocol = 'https:';
});

test('Probe 诊断面板和复制：创建/刷新/关闭与旧浏览器复制兜底', () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timers = new Map();
  let next = 1;
  globalThis.setTimeout = (callback, delay) => {
    assert.equal(delay, 2600, '此用例只创建自动消失的 Toast');
    const id = next++;
    timers.set(id, callback);
    return id;
  };
  globalThis.clearTimeout = id => timers.delete(id);
  try {
    P.__zhxProbePanel('原始探测报告');
    const box = document.getElementById('zhx-probe-box');
    assert.ok(box, '应创建诊断面板');
    const ta = document.getElementById('zhx-probe-text');
    assert.equal(ta.value, '原始探测报告');
    P.__zhxProbePanel('更新后的报告');
    assert.equal(document.body.children.length, 1, '重复刷新不能重复插入面板');
    assert.equal(ta.value, '更新后的报告');

    const buttons = [];
    const collectButtons = el => {
      if (el.tagName === 'BUTTON') buttons.push(el);
      for (const child of el.children) collectButtons(child);
    };
    collectButtons(box);
    assert.deepEqual(buttons.map(x => x.textContent), ['关闭', '复制报告', '刷新报告']);
    buttons[2].onclick();
    assert.ok(ta.value.includes('ZHX-PROBE: v1'));

    ta.value = '需要复制的内容';
    P.__zhxProbeCopy(ta);
    assert.equal(ta.focused, true);
    assert.equal(ta.selected, true);
    const toast = document.getElementById('zhx-probe-toast');
    assert.equal(toast.textContent, '已复制，发送给栀夏即可');
    assert.equal(timers.size, 1);
    P.__zhxProbeToast('另外的提示');
    assert.equal(toast.textContent, '另外的提示');
    buttons[0].onclick();
    assert.equal(box.removed, true);
    for (const callback of timers.values()) callback();
    assert.equal(toast.removed, true);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test.after(() => {
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
});
