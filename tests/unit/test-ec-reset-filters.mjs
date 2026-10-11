// EC Reset filters: use the production handler and observe actual navigation,
// not a dummy click counter that passes when the UI remains filtered.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../../src/sites/eorzea-collection.js', import.meta.url), 'utf8');
const start = src.indexOf('  // EC\'s Reset filters action should always return');
const end = src.indexOf('  function startEC() {', start);
assert.ok(start >= 0 && end > start, 'Production EC reset handler exists');
const factory = new Function('document', 'globalThis', 'setTimeout', 'URL',
  src.slice(start, end) + '\nreturn bindECResetFilters;');

let passed = 0;
function check(name, run) {
  run();
  console.log('PASS ' + name);
  passed++;
}

function harness(href, { path, disabled = false, text = '重置筛选', plainTarget = false } = {}) {
  const listeners = [];
  const timers = [];
  const location = {
    href,
    pathname: path || new URL(href).pathname,
    assigned: [],
    reloads: 0,
    assign(url) { this.assigned.push(url); this.href = url; },
    reload() { this.reloads++; },
  };
  const globals = { location };
  const doc = { addEventListener(type, fn, capture) {
    assert.equal(type, 'click');
    assert.equal(capture, true);
    listeners.push(fn);
  }};
  const bind = factory(doc, globals, fn => { timers.push(fn); }, URL);
  bind();
  bind();
  assert.equal(listeners.length, 1, 'Handler must be installed only once');
  const button = { textContent: text, disabled };
  const event = {
    target: plainTarget
      ? { textContent: text, closest: () => null }
      : { closest: selector => selector === 'button, a, [role="button"]' ? button : null },
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; },
  };
  return {
    event, location, timers,
    click() { listeners[0](event); },
    settle() { for (const fn of timers.splice(0)) fn(); },
  };
}

check('已应用筛选：单击重置恢复当前分类的无参数 URL', () => {
  const x = harness('https://ffxiv.eorzeacollection.com/glamours/tanks?filtergender=Female&filterjob=PLD&search=maid&page=8');
  x.click();
  assert.equal(x.event.defaultPrevented, false, 'Native handler must still run');
  assert.equal(x.event.propagationStopped, false);
  x.settle();
  assert.deepEqual(x.location.assigned, ['https://ffxiv.eorzeacollection.com/glamours/tanks']);
});
check('无 URL 参数：仍刷新，清除尚未应用的 Vue 筛选状态', () => {
  const x = harness('https://ffxiv.eorzeacollection.com/glamours/head/28453');
  x.click();
  x.settle();
  assert.equal(x.location.reloads, 1);
});
check('站点已跳转时不再执行兜底，避免重复导航', () => {
  const x = harness('https://ffxiv.eorzeacollection.com/glamours?filtergender=Female');
  x.click();
  x.location.href = 'https://ffxiv.eorzeacollection.com/glamours';
  x.settle();
  assert.equal(x.location.assigned.length, 0);
  assert.equal(x.location.reloads, 0);
});
check('gearsets 列表：Reset 清除筛选与中文检索，保留套装类别', () => {
  const x = harness('https://ffxiv.eorzeacollection.com/gearsets/casters?search=hooded&filterjob=BLM&page=3', { text: 'Reset' });
  x.click();
  x.settle();
  assert.deepEqual(x.location.assigned, ['https://ffxiv.eorzeacollection.com/gearsets/casters']);
});
check('accessories 列表：Reset 清除首饰筛选，保留当前列表路径', () => {
  const x = harness('https://ffxiv.eorzeacollection.com/accessories?search=memory&filterjob=AST', { text: 'Reset' });
  x.click();
  x.settle();
  assert.deepEqual(x.location.assigned, ['https://ffxiv.eorzeacollection.com/accessories']);
});
check('gearsets Reset 文本控件（非 button/a）同样生效', () => {
  const x = harness('https://ffxiv.eorzeacollection.com/gearsets?headPiece=22994', { text: 'Reset', plainTarget: true });
  x.click();
  x.settle();
  assert.deepEqual(x.location.assigned, ['https://ffxiv.eorzeacollection.com/gearsets']);
});
check('非重置按钮（应用筛选）不会触发页面刷新', () => {
  const x = harness('https://ffxiv.eorzeacollection.com/glamours?filterjob=PLD', { text: '应用筛选' });
  x.click();
  assert.equal(x.timers.length, 0);
});
check('页面未激活的按钮不执行重置', () => {
  const x = harness('https://ffxiv.eorzeacollection.com/glamours?filterjob=PLD', { disabled: true });
  x.click();
  assert.equal(x.timers.length, 0);
});
check('非筛选栏目如 facewear 不受兜底影响', () => {
  const x = harness('https://ffxiv.eorzeacollection.com/facewear?search=abc');
  x.click();
  assert.equal(x.timers.length, 0);
});
check('英文字体大小写与原中文按钮均识别', () => {
  for (const text of ['Reset filters', 'RESET FILTERS', '清空筛选']) {
    const x = harness('https://ffxiv.eorzeacollection.com/glamours?filterjob=PLD', { text });
    x.click();
    x.settle();
    assert.equal(x.location.assigned.length, 1, text);
  }
});
console.log('EC Reset filters ' + passed + ' groups passed');
