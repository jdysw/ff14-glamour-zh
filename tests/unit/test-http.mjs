// 回归验证 fetch 的超时必须覆盖完整响应体，而非仅覆盖响应头。
// 在无外部网络请求的条件下独立测试生产环境 HTTP 适配器。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../helpers/paths.mjs';

const source = fs.readFileSync(path.join(repoRoot, 'src/core/http.js'), 'utf8');
const start = source.indexOf('  let _httpFreshSequence = 0;');
const end = source.indexOf('  /* @zhixia:core-http-end */', start);
assert.ok(start >= 0 && end > start, 'HTTP adapter source markers must exist');

function clock() {
  let sequence = 0;
  const timers = new Map();
  const schedule = (fn) => {
    const id = ++sequence;
    timers.set(id, { fn, cleared: false });
    return id;
  };
  const clear = (id) => { if (timers.has(id)) timers.get(id).cleared = true; };
  const fire = (id) => { const timer = timers.get(id); if (timer && !timer.cleared) timer.fn(); };
  return { timers, schedule, clear, fire };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function build(fetchImpl, timer, AbortCtor = AbortController, gmRequest = undefined) {
  const body = source.slice(start, end);
  const make = new Function('fetch', 'AbortController', 'GM_xmlhttpRequest', 'setTimeout', 'clearTimeout',
    body + '\nreturn httpGet;');
  return make(fetchImpl, AbortCtor, gmRequest, timer.schedule, timer.clear);
}

// 服务端可能先返回成功的响应头，再让 response.text() 一直等待。
{
  const timer = clock();
  const body = deferred();
  let signal;
  const httpGet = build(async (_url, opts) => {
    signal = opts.signal;
    return { ok: true, text: () => body.promise };
  }, timer);
  const request = httpGet('https://example.test/names.tsv', 100);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(timer.timers.size, 1);
  const first = [...timer.timers.values()][0];
  assert.equal(first.cleared, false, 'timeout must remain active while body is pending');
  timer.fire(1);
  await assert.rejects(request, /timeout/);
  assert.equal(signal.aborted, true, 'time out must abort a stalled body');
  body.resolve('late');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(first.cleared, true);
}

// 浏览器缺少 AbortController 时，Promise 仍必须能超时结束。
{
  const timer = clock();
  const httpGet = build(() => new Promise(() => {}), timer, null);
  const request = httpGet('https://example.test/hang', 100);
  await new Promise((resolve) => setImmediate(resolve));
  timer.fire(1);
  await assert.rejects(request, /timeout/);
}

// 完整读取响应体后应清理定时器，并保留返回内容。
{
  const timer = clock();
  const httpGet = build(async () => ({ ok: true, text: async () => '中文词典' }), timer);
  assert.equal(await httpGet('https://example.test/dict.json', 100), '中文词典');
  assert.equal([...timer.timers.values()][0].cleared, true);
}

// 非 2xx 状态仍应报错；该测试不要求服务端错误响应为文本。
{
  const timer = clock();
  const httpGet = build(async () => ({ ok: false, status: 503, text: async () => 'unavailable' }), timer);
  await assert.rejects(httpGet('https://example.test/offline', 100), /HTTP 503/);
  assert.equal([...timer.timers.values()][0].cleared, true);
}

console.log('✅ HTTP header/body timeout, abort fallback, success and error regressions passed');
