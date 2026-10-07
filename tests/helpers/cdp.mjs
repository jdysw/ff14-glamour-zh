// 极简 CDP 客户端（Node ≥22 内置 WebSocket / fetch）
// 用法见同目录测试脚本；连接 127.0.0.1:9223 的 headless Chrome
import { setTimeout as sleep } from 'node:timers/promises';

export { sleep };

export class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
    this.consoleLines = [];
  }
  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = () => rej(new Error('websocket 连接失败: ' + wsUrl));
    });
    const c = new CDP(ws);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null && c.pending.has(msg.id)) {
        const { res, rej } = c.pending.get(msg.id);
        c.pending.delete(msg.id);
        msg.error ? rej(new Error('CDP error ' + JSON.stringify(msg.error).slice(0, 300))) : res(msg.result);
      } else if (msg.method) {
        if (msg.method === 'Runtime.consoleAPICalled') {
          const t = (msg.params.args || []).map((a) => {
            if (a.type === 'string') return a.value;
            if (a.value !== undefined) return JSON.stringify(a.value);
            if (a.description) return a.description;
            return a.type;
          }).join(' ');
          c.consoleLines.push(t);
        }
        const hs = c.handlers.get(msg.method);
        if (hs) for (const fn of hs) { try { fn(msg.params); } catch (e) {} }
      }
    };
    return c;
  }
  on(method, fn) {
    const a = this.handlers.get(method) || [];
    a.push(fn);
    this.handlers.set(method, a);
  }
  send(method, params = {}, timeoutMs = 180000) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          rej(new Error('CDP 超时: ' + method));
        }
      }, timeoutMs);
      // Phase 19：响应/出错即清理超时定时器——否则残留定时器（最长 timeoutMs）拖住
      //   进程收尾，令每个使用 CDP 的测试文件多等最多 ~3 分钟（套件级悬挂）
      const wrap = (fn) => (v) => { clearTimeout(timer); fn(v); };
      this.pending.set(id, { res: wrap(res), rej: wrap(rej) });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expr, { awaitPromise = true } = {}) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise, timeout: 120000,
    });
    if (r.exceptionDetails) {
      throw new Error('eval 异常: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
    }
    return r.result ? r.result.value : undefined;
  }
  waitForEvent(method, timeoutMs = 30000) {
    return new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error('等待事件超时: ' + method)), timeoutMs);
      const fn = (p) => {
        clearTimeout(timer);
        res(p);
      };
      const a = this.handlers.get(method) || [];
      a.push(fn);
      this.handlers.set(method, a);
    });
  }
  async close() {
    try { this.ws.close(); } catch (e) {}
  }
}

export async function newPage(port, url = 'about:blank', { width = 1440, height = 900 } = {}) {
  const r = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!r.ok) throw new Error('创建页面失败: ' + r.status);
  const target = await r.json();
  const cdp = await CDP.connect(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  try {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  } catch (e) {}
  return { cdp, target };
}

export async function closePage(port, targetId) {
  try { await fetch(`http://127.0.0.1:${port}/json/close/${targetId}`); } catch (e) {}
}
