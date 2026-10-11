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
check('回归：用户实际页面 /glamours/head/27832 必须退出物品筛选，而非刷新原 URL', () => {
  const x = harness('https://ffxiv.eorzeacollection.com/glamours/head/27832');
  x.click();
  assert.equal(x.event.defaultPrevented, false, '原站点击事件不能被拦截');
  x.settle();
  assert.deepEqual(x.location.assigned, ['https://ffxiv.eorzeacollection.com/glamours']);
  assert.equal(x.location.reloads, 0, '不能刷新含 /head/27832 的旧筛选 URL');
});
check('物品路径即使带其他筛选参数，也要连物品条件一起清除', () => {
  const x = harness('https://ffxiv.eorzeacollection.com/glamours/head/27832?filter%5Bjob%5D=PLD&search=cat&page=9');
  x.click();
  x.settle();
  assert.deepEqual(x.location.assigned, ['https://ffxiv.eorzeacollection.com/glamours']);
});
check('已是默认幻化列表且没有 URL 筛选时，才允许刷新清除 Vue 暂存值', () => {
  const x = harness('https://ffxiv.eorzeacollection.com/glamours');
  x.click();
  x.settle();
  assert.equal(x.location.assigned.length, 0);
  assert.equal(x.location.reloads, 1);
});
check('其他已确认装备筛选路由同样回到无筛选幻化列表', () => {
  for (const route of [
    'weapon/14675', 'head/77', 'body/200', 'hands/2555', 'legs/2676',
    'feet/27832', 'ear/9876', 'neck/123', 'wrist/9', 'ring/22',
  ]) {
    const x = harness('https://ffxiv.eorzeacollection.com/glamours/' + route + '/?page=2');
    x.click();
    x.settle();
    assert.deepEqual(x.location.assigned, ['https://ffxiv.eorzeacollection.com/glamours'], route);
  }
});
check('不是装备物品路径的职业子分类仍保留', () => {
  const x = harness('https://ffxiv.eorzeacollection.com/glamours/tanks?filterjob=PLD');
  x.click();
  x.settle();
  assert.deepEqual(x.location.assigned, ['https://ffxiv.eorzeacollection.com/glamours/tanks']);
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
