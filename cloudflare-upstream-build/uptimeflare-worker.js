var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str, encoding, cb) {
    if (str instanceof Uint8Array) {
      str = new TextDecoder().decode(str);
    }
    try {
      console.log(str);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var workerdProcess = getBuiltinModule("node:process");
var isWorkerdProcessV2 = globalThis.Cloudflare.compatibilityFlags.enable_nodejs_process_v2;
var unenvProcess = new Process({
  env: globalProcess.env,
  // `hrtime` is only available from workerd process v2
  hrtime: isWorkerdProcessV2 ? workerdProcess.hrtime : hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  // Always implemented by workerd
  env,
  // Only implemented in workerd v2
  hrtime: hrtime3,
  // Always implemented by workerd
  nextTick
} = unenvProcess;
var {
  _channel,
  _disconnect,
  _events,
  _eventsCount,
  _handleQueue,
  _maxListeners,
  _pendingMessage,
  _send,
  assert: assert2,
  disconnect,
  mainModule
} = unenvProcess;
var {
  // @ts-expect-error `_debugEnd` is missing typings
  _debugEnd,
  // @ts-expect-error `_debugProcess` is missing typings
  _debugProcess,
  // @ts-expect-error `_exiting` is missing typings
  _exiting,
  // @ts-expect-error `_fatalException` is missing typings
  _fatalException,
  // @ts-expect-error `_getActiveHandles` is missing typings
  _getActiveHandles,
  // @ts-expect-error `_getActiveRequests` is missing typings
  _getActiveRequests,
  // @ts-expect-error `_kill` is missing typings
  _kill,
  // @ts-expect-error `_linkedBinding` is missing typings
  _linkedBinding,
  // @ts-expect-error `_preload_modules` is missing typings
  _preload_modules,
  // @ts-expect-error `_rawDebug` is missing typings
  _rawDebug,
  // @ts-expect-error `_startProfilerIdleNotifier` is missing typings
  _startProfilerIdleNotifier,
  // @ts-expect-error `_stopProfilerIdleNotifier` is missing typings
  _stopProfilerIdleNotifier,
  // @ts-expect-error `_tickCallback` is missing typings
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  availableMemory,
  // @ts-expect-error `binding` is missing typings
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  // @ts-expect-error `domain` is missing typings
  domain,
  emit,
  emitWarning,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  // @ts-expect-error `initgroups` is missing typings
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  memoryUsage,
  // @ts-expect-error `moduleLoadList` is missing typings
  moduleLoadList,
  off,
  on,
  once,
  // @ts-expect-error `openStdin` is missing typings
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  // @ts-expect-error `reallyExit` is missing typings
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = isWorkerdProcessV2 ? workerdProcess : unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// src/index.ts
import { DurableObject } from "cloudflare:workers";

// ../uptime.config.ts
var workerConfig = {
  monitors: [
    { id: "zhixia-web", name: "Zhixia \u4E2A\u4EBA\u7F51\u7AD9", method: "GET", target: "https://zhixia.uk/", expectedCodes: [200], timeout: 1e4 },
    { id: "zhixia-image", name: "Cloudflare \u56FE\u5E8A", method: "GET", target: "https://cloudflare-imgbed-14k.pages.dev/", expectedCodes: [200], timeout: 1e4 },
    { id: "ff14-glamour", name: "FF14 \u6570\u636E\u9875\u9762", method: "GET", target: "https://zhixia-data.pages.dev/", expectedCodes: [200], timeout: 1e4 }
  ],
  notification: { timeZone: "Asia/Singapore", gracePeriod: 5 }
};
var maintenances = [];

// src/util.ts
async function getWorkerLocation() {
  const res = await fetch("https://cloudflare.com/cdn-cgi/trace");
  const text = await res.text();
  const colo = /^colo=(.*)$/m.exec(text)?.[1];
  return colo;
}
__name(getWorkerLocation, "getWorkerLocation");
var fetchTimeout = /* @__PURE__ */ __name((url, ms, { signal, ...options } = {}) => {
  const controller = new AbortController();
  const promise = fetch(url, { signal: controller.signal, ...options });
  if (signal) signal.addEventListener("abort", () => controller.abort());
  const timeout = setTimeout(() => controller.abort(), ms);
  return promise.finally(() => clearTimeout(timeout));
}, "fetchTimeout");
function withTimeout(millis, promise) {
  const timeout = new Promise(
    (resolve, reject) => setTimeout(() => reject(new Error(`Promise timed out after ${millis}ms`)), millis)
  );
  return Promise.race([promise, timeout]);
}
__name(withTimeout, "withTimeout");
function formatStatusChangeNotification(monitor, isUp, timeIncidentStart, timeNow, reason, timeZone) {
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone
  });
  let downtimeDuration = Math.round((timeNow - timeIncidentStart) / 60);
  const timeNowFormatted = dateFormatter.format(new Date(timeNow * 1e3));
  const timeIncidentStartFormatted = dateFormatter.format(new Date(timeIncidentStart * 1e3));
  if (isUp) {
    return `\u2705 ${monitor.name} is up! 
The service is up again after being down for ${downtimeDuration} minutes.`;
  } else if (timeNow == timeIncidentStart) {
    return `\u{1F534} ${monitor.name} is currently down. 
Service is unavailable at ${timeNowFormatted}. 
Issue: ${reason || "unspecified"}`;
  } else {
    return `\u{1F534} ${monitor.name} is still down. 
Service is unavailable since ${timeIncidentStartFormatted} (${downtimeDuration} minutes). 
Issue: ${reason || "unspecified"}`;
  }
}
__name(formatStatusChangeNotification, "formatStatusChangeNotification");
function templateWebhookPlayload(payload, message) {
  for (const key in payload) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      if (payload[key] === "$MSG") {
        payload[key] = message;
      } else if (typeof payload[key] === "object" && payload[key] !== null) {
        templateWebhookPlayload(payload[key], message);
      }
    }
  }
}
__name(templateWebhookPlayload, "templateWebhookPlayload");
async function webhookNotify(webhook, message) {
  if (Array.isArray(webhook)) {
    for (const w of webhook) {
      await webhookNotify(w, message);
    }
    return;
  }
  console.log(
    "Sending webhook notification: " + JSON.stringify(message) + " to webhook " + webhook.url
  );
  try {
    let url = webhook.url;
    let method = webhook.method;
    let headers = new Headers(webhook.headers);
    let payloadTemplated = JSON.parse(
      JSON.stringify(webhook.payload)
    );
    templateWebhookPlayload(payloadTemplated, message);
    let body = void 0;
    switch (webhook.payloadType) {
      case "param":
        method = method ?? "GET";
        const urlTmp = new URL(url);
        for (const [k, v] of Object.entries(payloadTemplated)) {
          urlTmp.searchParams.append(k, v.toString());
        }
        url = urlTmp.toString();
        break;
      case "json":
        method = method ?? "POST";
        if (headers.get("content-type") === null) {
          headers.set("content-type", "application/json");
        }
        body = JSON.stringify(payloadTemplated);
        break;
      case "x-www-form-urlencoded":
        method = method ?? "POST";
        if (headers.get("content-type") === null) {
          headers.set("content-type", "application/x-www-form-urlencoded");
        }
        body = new URLSearchParams(payloadTemplated).toString();
        break;
      default:
        throw "Unrecognized payload type: " + webhook.payloadType;
    }
    console.log(
      `Webhook finalized parameters: ${method} ${url}, headers ${JSON.stringify(
        Object.fromEntries(headers.entries())
      )}, body ${JSON.stringify(body)}`
    );
    const resp = await fetchTimeout(url, webhook.timeout ?? 5e3, { method, headers, body });
    if (!resp.ok) {
      console.log(
        "Error calling webhook server, code: " + resp.status + ", response: " + await resp.text()
      );
    } else {
      console.log("Webhook notification sent successfully, code: " + resp.status);
    }
  } catch (e) {
    console.log("Error calling webhook server: " + e);
  }
}
__name(webhookNotify, "webhookNotify");
var formatAndNotify = /* @__PURE__ */ __name(async (monitor, isUp, timeIncidentStart, timeNow, reason) => {
  const skipList = workerConfig.notification?.skipNotificationIds;
  if (skipList && skipList.includes(monitor.id)) {
    console.log(`Skipping notification for ${monitor.name} (${monitor.id} in skipNotificationIds)`);
    return;
  }
  const maintenanceList = maintenances.filter(
    (m) => new Date(timeNow * 1e3) >= new Date(m.start) && (!m.end || new Date(timeNow * 1e3) <= new Date(m.end))
  ).map((e) => e.monitors || []).flat();
  if (maintenanceList.includes(monitor.id)) {
    console.log(`Skipping notification for ${monitor.name} (in maintenance)`);
    return;
  }
  if (workerConfig.notification?.webhook) {
    const notification = formatStatusChangeNotification(
      monitor,
      isUp,
      timeIncidentStart,
      timeNow,
      reason,
      workerConfig.notification?.timeZone ?? "Etc/GMT"
    );
    await webhookNotify(workerConfig.notification.webhook, notification);
  } else {
    console.log(`Webhook not set, skipping notification for ${monitor.name}`);
  }
}, "formatAndNotify");

// src/monitor.ts
function isIpAddress(hostname) {
  if (hostname.includes(":")) return true;
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const value = Number(part);
    return value >= 0 && value <= 255;
  });
}
__name(isIpAddress, "isIpAddress");
function getDomainOnlyIpVersionOption(hostname, gpUrl) {
  if (isIpAddress(hostname)) return {};
  return { ipVersion: Number(gpUrl.searchParams.get("ipVersion") || 4) };
}
__name(getDomainOnlyIpVersionOption, "getDomainOnlyIpVersionOption");
async function httpResponseBasicCheck(monitor, code, bodyReader) {
  if (monitor.expectedCodes) {
    if (!monitor.expectedCodes.includes(code)) {
      return `Expected codes: ${JSON.stringify(monitor.expectedCodes)}, Got: ${code}`;
    }
  } else {
    if (code < 200 || code > 299) {
      return `Expected codes: 2xx, Got: ${code}`;
    }
  }
  if (monitor.responseKeyword || monitor.responseForbiddenKeyword) {
    const responseBody = await bodyReader();
    if (monitor.responseKeyword && !responseBody.includes(monitor.responseKeyword)) {
      console.log(
        `${monitor.name} expected keyword ${monitor.responseKeyword}, not found in response (truncated to 100 chars): ${responseBody.slice(0, 100)}`
      );
      return "HTTP response doesn't contain the configured keyword";
    }
    if (monitor.responseForbiddenKeyword && responseBody.includes(monitor.responseForbiddenKeyword)) {
      console.log(
        `${monitor.name} forbidden keyword ${monitor.responseForbiddenKeyword}, found in response (truncated to 100 chars): ${responseBody.slice(0, 100)}`
      );
      return "HTTP response contains the configured forbidden keyword";
    }
  }
  return null;
}
__name(httpResponseBasicCheck, "httpResponseBasicCheck");
async function getStatusWithGlobalPing(monitor) {
  try {
    if (monitor.checkProxy === void 0) {
      throw "empty check proxy for globalping, shouldn't call this method";
    }
    const gpUrl = new URL(monitor.checkProxy);
    if (gpUrl.protocol !== "globalping:") {
      throw "incorrect check proxy protocol for globalping, got: " + gpUrl.protocol;
    }
    const token = gpUrl.hostname;
    let globalPingRequest = {};
    if (monitor.method === "TCP_PING") {
      const targetUrl = new URL("https://" + monitor.target);
      const ipVersionOption = getDomainOnlyIpVersionOption(targetUrl.hostname, gpUrl);
      globalPingRequest = {
        type: "ping",
        target: targetUrl.hostname,
        locations: gpUrl.searchParams.get("magic") !== null ? [
          {
            magic: gpUrl.searchParams.get("magic")
          }
        ] : void 0,
        measurementOptions: {
          port: targetUrl.port,
          packets: 1,
          protocol: "tcp",
          // TODO: icmp?
          ...ipVersionOption
        }
      };
    } else {
      const targetUrl = new URL(monitor.target);
      const ipVersionOption = getDomainOnlyIpVersionOption(targetUrl.hostname, gpUrl);
      if (monitor.body !== void 0) {
        throw "custom body not supported";
      }
      if (monitor.method && !["GET", "HEAD", "OPTIONS"].includes(monitor.method.toUpperCase())) {
        throw "only GET, HEAD, OPTIONS methods are supported";
      }
      globalPingRequest = {
        type: "http",
        target: targetUrl.hostname,
        locations: gpUrl.searchParams.get("magic") !== null ? [
          {
            magic: gpUrl.searchParams.get("magic")
          }
        ] : void 0,
        measurementOptions: {
          request: {
            method: monitor.method,
            path: targetUrl.pathname,
            query: targetUrl.search === "" ? void 0 : targetUrl.search,
            headers: Object.fromEntries(
              Object.entries(monitor.headers ?? {}).map(([key, value]) => [key, String(value)])
            )
            // TODO: host header?
          },
          port: targetUrl.port === "" ? targetUrl.protocol === "http:" ? 80 : 443 : Number(targetUrl.port),
          protocol: targetUrl.protocol.replace(":", ""),
          ...ipVersionOption
        }
      };
    }
    const startTime = Date.now();
    console.log(`Requesting the Global Ping API, payload: ${JSON.stringify(globalPingRequest)}`);
    const measurement = await fetchTimeout("https://api.globalping.io/v1/measurements", 5e3, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify(globalPingRequest)
    });
    const measurementResponse = await measurement.json();
    if (measurement.status !== 202) {
      throw measurementResponse.error.message;
    }
    const measurementId = measurementResponse.id;
    console.log(
      `Measurement created successfully, id: ${measurementId}, time elapsed: ${Date.now() - startTime}ms`
    );
    const pollStart = Date.now();
    let measurementResult;
    while (true) {
      if (Date.now() - pollStart > (monitor.timeout ?? 1e4) + 2e3) {
        throw "api polling timeout";
      }
      measurementResult = await (await fetchTimeout(`https://api.globalping.io/v1/measurements/${measurementId}`, 5e3)).json();
      if (measurementResult.status !== "in-progress") {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1e3));
    }
    console.log(
      `Measurement ${measurementId} finished with response: ${JSON.stringify(
        measurementResult
      )}, time elapsed: ${Date.now() - pollStart}ms`
    );
    if (measurementResult.status !== "finished" || measurementResult.results[0].result.status !== "finished") {
      console.log(
        `measurement failed with status: ${measurementResult.status}, result status: ${measurementResult.results[0].result.status}`
      );
      throw `status [${measurementResult.status}|${measurementResult.results[0].result.status}]: ${measurementResult.results?.[0].result?.rawOutput?.slice(0, 64)}`;
    }
    const country = measurementResult.results[0].probe.country;
    const city = measurementResult.results[0].probe.city;
    if (monitor.method === "TCP_PING") {
      const time3 = Math.round(measurementResult.results[0].result.stats.avg);
      return {
        location: country + "/" + city,
        status: {
          ping: time3,
          up: true,
          err: ""
        }
      };
    } else {
      const time3 = measurementResult.results[0].result.timings.total;
      const code = measurementResult.results[0].result.statusCode;
      const body = measurementResult.results[0].result.rawBody;
      let err = await httpResponseBasicCheck(monitor, code, () => body);
      if (err !== null) {
        console.log(`${monitor.name} didn't pass response check: ${err}`);
      }
      if (monitor.target.toLowerCase().startsWith("https") && !measurementResult.results[0].result.tls.authorized) {
        console.log(
          `${monitor.name} TLS certificate not trusted: ${measurementResult.results[0].result.tls.error}`
        );
        err = "TLS certificate not trusted: " + measurementResult.results[0].result.tls.error;
      }
      return {
        location: country + "/" + city,
        status: {
          ping: time3,
          up: err === null,
          err: err ?? ""
        }
      };
    }
  } catch (e) {
    console.log(`Globalping ${monitor.name} errored with ${e}`);
    return {
      location: "ERROR",
      status: {
        ping: e.toString().toLowerCase().includes("timeout") ? monitor.timeout ?? 1e4 : 0,
        up: false,
        err: "Globalping error: " + e.toString()
      }
    };
  }
}
__name(getStatusWithGlobalPing, "getStatusWithGlobalPing");
async function getStatus(monitor) {
  let status = {
    ping: 0,
    up: false,
    err: "Unknown"
  };
  const startTime = Date.now();
  if (monitor.method === "TCP_PING") {
    try {
      const connect = await import(
        /* webpackIgnore: true */
        "cloudflare:sockets"
      ).then(
        (sockets) => sockets.connect
      );
      const parsed = new URL("https://" + monitor.target);
      const socket = connect({ hostname: parsed.hostname, port: Number(parsed.port) });
      await withTimeout(monitor.timeout || 1e4, socket.opened);
      await socket.close();
      console.log(`${monitor.name} connected to ${monitor.target}`);
      status.ping = Date.now() - startTime;
      status.up = true;
      status.err = "";
    } catch (e) {
      console.log(`${monitor.name} errored with ${e.name}: ${e.message}`);
      if (e.message.includes("timed out")) {
        status.ping = monitor.timeout || 1e4;
      }
      status.up = false;
      status.err = e.name + ": " + e.message;
    }
  } else {
    try {
      let headers = new Headers(monitor.headers);
      if (!headers.has("user-agent")) {
        headers.set("user-agent", "UptimeFlare/1.0 (+https://github.com/lyc8503/UptimeFlare)");
      }
      const response = await fetchTimeout(monitor.target, monitor.timeout || 1e4, {
        method: monitor.method,
        headers,
        body: monitor.body,
        cf: {
          cacheTtlByStatus: {
            "100-599": -1
            // Don't cache any status code, from https://developers.cloudflare.com/workers/runtime-apis/request/#requestinitcfproperties
          }
        }
      });
      console.log(`${monitor.name} responded with ${response.status}`);
      status.ping = Date.now() - startTime;
      const err = await httpResponseBasicCheck(
        monitor,
        response.status,
        response.text.bind(response)
      );
      try {
        await response.body?.cancel();
      } catch (e) {
      }
      if (err !== null) {
        console.log(`${monitor.name} didn't pass response check: ${err}`);
      }
      status.up = err === null;
      status.err = err ?? "";
    } catch (e) {
      console.log(`${monitor.name} errored with ${e.name}: ${e.message}`);
      if (e.name === "AbortError") {
        status.ping = monitor.timeout || 1e4;
        status.up = false;
        status.err = `Timeout after ${status.ping}ms`;
      } else {
        status.up = false;
        status.err = e.name + ": " + e.message;
      }
    }
  }
  return status;
}
__name(getStatus, "getStatus");
async function doMonitor(monitor, defaultLocation, env2) {
  let checkLocation = defaultLocation;
  let status;
  if (monitor.checkProxy) {
    try {
      console.log(`[${monitor.id}] Calling check proxy: ${monitor.checkProxy}`);
      let resp;
      if (monitor.checkProxy.startsWith("worker://")) {
        const doLoc = monitor.checkProxy.replace("worker://", "");
        const doId = env2.REMOTE_CHECKER_DO.idFromName(`${doLoc}:${monitor.id}`);
        const doStub = env2.REMOTE_CHECKER_DO.get(doId, {
          locationHint: doLoc
        });
        resp = await doStub.getLocationAndStatus(monitor);
        try {
          await doStub.kill();
        } catch (err) {
        }
      } else if (monitor.checkProxy.startsWith("globalping://")) {
        resp = await getStatusWithGlobalPing(monitor);
      } else {
        resp = await (await fetch(monitor.checkProxy, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(monitor)
        })).json();
      }
      checkLocation = resp.location;
      status = resp.status;
    } catch (err) {
      console.log(`[${monitor.id}] Error calling proxy: ${err}`);
      if (monitor.checkProxyFallback) {
        console.log("Falling back to local check...");
        status = await getStatus(monitor);
      } else {
        status = { ping: 0, up: false, err: "Unknown check proxy error" };
      }
    }
  } else {
    status = await getStatus(monitor);
  }
  console.log(`[${monitor.id}] Check result from ${checkLocation}: up=${status.up}, ping=${status.ping}, err=${status.err}`);
  return {
    location: checkLocation,
    status,
    id: monitor.id
  };
}
__name(doMonitor, "doMonitor");

// src/store.ts
async function getFromStore(env2, key) {
  const stmt = env2.UPTIMEFLARE_D1.prepare("SELECT value FROM uptimeflare WHERE key = ?");
  const result = await stmt.bind(key).first();
  return result?.value || null;
}
__name(getFromStore, "getFromStore");
async function setToStore(env2, key, value) {
  const stmt = env2.UPTIMEFLARE_D1.prepare(
    "INSERT INTO uptimeflare (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;"
  );
  await stmt.bind(key, value).run();
}
__name(setToStore, "setToStore");
var CompactedMonitorStateWrapper = class {
  static {
    __name(this, "CompactedMonitorStateWrapper");
  }
  constructor(compactedStateStr) {
    if (!compactedStateStr) {
      this.data = {
        lastUpdate: 0,
        overallUp: 0,
        overallDown: 0,
        incident: {},
        latency: {}
      };
      return;
    }
    this.data = JSON.parse(compactedStateStr);
  }
  getCompactedStateStr() {
    return JSON.stringify(this.data);
  }
  // Don't use this method at server-side
  uncompact() {
    let state = {
      lastUpdate: this.data.lastUpdate,
      overallUp: this.data.overallUp,
      overallDown: this.data.overallDown,
      incident: {},
      latency: {}
    };
    const hex2Uint8Arr = /* @__PURE__ */ __name((hex) => {
      if (Uint8Array.fromHex) {
        return Uint8Array.fromHex(hex);
      } else {
        console.warn("Uint8Array.fromHex is not available, using parseInt as fallback. Consider upgrading your browser.");
        const ret = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
          ret[i / 2] = parseInt(hex.slice(i, i + 2), 16);
        }
        return ret;
      }
    }, "hex2Uint8Arr");
    Object.keys(this.data.incident).forEach((monitorId) => {
      state.incident[monitorId] = [];
      const incidents = this.data.incident[monitorId];
      if (incidents.start.length !== incidents.end.length || incidents.start.length !== incidents.error.length) {
        throw new Error(
          "Inconsistent incident data lengths, please report an issue at https://github.com/lyc8503/UptimeFlare"
        );
      }
      for (let i = 0; i < incidents.start.length; i++) {
        state.incident[monitorId].push({
          start: incidents.start[i],
          end: incidents.end[i],
          error: incidents.error[i]
        });
      }
    });
    Object.keys(this.data.latency).forEach((monitorId) => {
      state.latency[monitorId] = [];
      const latencies = this.data.latency[monitorId];
      const locUncompacted = [];
      latencies.loc.c.forEach((count3, index) => {
        for (let i = 0; i < count3; i++) {
          locUncompacted.push(latencies.loc.v[index]);
        }
      });
      const timeArr = new Uint32Array(hex2Uint8Arr(latencies.time).buffer);
      const pingArr = new Uint16Array(hex2Uint8Arr(latencies.ping).buffer);
      if (timeArr.length !== pingArr.length || timeArr.length !== locUncompacted.length) {
        throw new Error(
          "Inconsistent latency data lengths, please report an issue at https://github.com/lyc8503/UptimeFlare."
        );
      }
      for (let i = 0; i < timeArr.length; i++) {
        state.latency[monitorId].push({
          time: timeArr[i],
          ping: pingArr[i],
          loc: locUncompacted[i]
        });
      }
    });
    return state;
  }
  incidentLen(monitorId) {
    const incidents = this.data.incident[monitorId];
    if (!incidents) return 0;
    return incidents.start.length;
  }
  getIncident(monitorId, index) {
    const incidents = this.data.incident[monitorId];
    if (!incidents || index < 0 || index >= incidents.start.length) {
      throw new Error("Index out of bounds or monitor not found");
    }
    return {
      start: incidents.start[index],
      end: incidents.end[index],
      error: incidents.error[index]
    };
  }
  setIncident(monitorId, index, incident) {
    const incidents = this.data.incident[monitorId];
    if (!incidents || index < 0 || index >= incidents.start.length) {
      throw new Error("Index out of bounds or monitor not found");
    }
    incidents.start[index] = incident.start;
    incidents.end[index] = incident.end;
    incidents.error[index] = incident.error;
  }
  appendIncident(monitorId, incident) {
    let incidents = this.data.incident[monitorId];
    if (!incidents) {
      this.data.incident[monitorId] = {
        start: [],
        end: [],
        error: []
      };
      incidents = this.data.incident[monitorId];
    }
    incidents.start.push(incident.start);
    incidents.end.push(incident.end);
    incidents.error.push(incident.error);
  }
  shiftIncident(monitorId) {
    const incidents = this.data.incident[monitorId];
    incidents.start.shift();
    incidents.end.shift();
    incidents.error.shift();
  }
  unshiftIncident(monitorId, incident) {
    const incidents = this.data.incident[monitorId];
    incidents.start.unshift(incident.start);
    incidents.end.unshift(incident.end);
    incidents.error.unshift(incident.error);
  }
  latencyLen(monitorId) {
    const latencies = this.data.latency[monitorId];
    if (!latencies) return 0;
    return latencies.ping.length / 4;
  }
  appendLatency(monitorId, record) {
    let latencies = this.data.latency[monitorId];
    if (!latencies) {
      this.data.latency[monitorId] = {
        time: "",
        ping: "",
        loc: {
          c: [],
          v: []
        }
      };
      latencies = this.data.latency[monitorId];
    }
    latencies.time += new Uint8Array(new Uint32Array([record.time]).buffer).toHex();
    latencies.ping += new Uint8Array(new Uint16Array([record.ping]).buffer).toHex();
    if (latencies.loc.v[latencies.loc.v.length - 1] !== record.loc) {
      latencies.loc.c.push(1);
      latencies.loc.v.push(record.loc);
    } else {
      latencies.loc.c[latencies.loc.c.length - 1] += 1;
    }
  }
  getFirstLatency(monitorId) {
    let latencies = this.data.latency[monitorId];
    return {
      // @ts-expect-error
      time: new Uint32Array(Uint8Array.fromHex(latencies.time.slice(0, 8)).buffer)[0],
      // @ts-expect-error
      ping: new Uint16Array(Uint8Array.fromHex(latencies.ping.slice(0, 4)).buffer)[0],
      loc: latencies.loc.v[0]
    };
  }
  getLastLatency(monitorId) {
    let latencies = this.data.latency[monitorId];
    return {
      // @ts-expect-error
      time: new Uint32Array(Uint8Array.fromHex(latencies.time.slice(-8)).buffer)[0],
      // @ts-expect-error
      ping: new Uint16Array(Uint8Array.fromHex(latencies.ping.slice(-4)).buffer)[0],
      loc: latencies.loc.v[latencies.loc.v.length - 1]
    };
  }
  unshiftLatency(monitorId) {
    let latencies = this.data.latency[monitorId];
    latencies.time = latencies.time.slice(8);
    latencies.ping = latencies.ping.slice(4);
    latencies.loc.c[0] -= 1;
    if (latencies.loc.c[0] === 0) {
      latencies.loc.c.shift();
      latencies.loc.v.shift();
    }
  }
};

// node_modules/yocto-queue/index.js
var Node = class {
  static {
    __name(this, "Node");
  }
  value;
  next;
  constructor(value) {
    this.value = value;
  }
};
var Queue = class {
  static {
    __name(this, "Queue");
  }
  #head;
  #tail;
  #size;
  constructor() {
    this.clear();
  }
  enqueue(value) {
    const node = new Node(value);
    if (this.#head) {
      this.#tail.next = node;
      this.#tail = node;
    } else {
      this.#head = node;
      this.#tail = node;
    }
    this.#size++;
  }
  dequeue() {
    const current = this.#head;
    if (!current) {
      return;
    }
    this.#head = this.#head.next;
    this.#size--;
    if (!this.#head) {
      this.#tail = void 0;
    }
    return current.value;
  }
  peek() {
    if (!this.#head) {
      return;
    }
    return this.#head.value;
  }
  clear() {
    this.#head = void 0;
    this.#tail = void 0;
    this.#size = 0;
  }
  get size() {
    return this.#size;
  }
  *[Symbol.iterator]() {
    let current = this.#head;
    while (current) {
      yield current.value;
      current = current.next;
    }
  }
  *drain() {
    while (this.#head) {
      yield this.dequeue();
    }
  }
};

// node_modules/p-limit/index.js
function pLimit(concurrency) {
  validateConcurrency(concurrency);
  const queue = new Queue();
  let activeCount = 0;
  const resumeNext = /* @__PURE__ */ __name(() => {
    if (activeCount < concurrency && queue.size > 0) {
      activeCount++;
      queue.dequeue()();
    }
  }, "resumeNext");
  const next = /* @__PURE__ */ __name(() => {
    activeCount--;
    resumeNext();
  }, "next");
  const run = /* @__PURE__ */ __name(async (function_, resolve, arguments_) => {
    const result = (async () => function_(...arguments_))();
    resolve(result);
    try {
      await result;
    } catch {
    }
    next();
  }, "run");
  const enqueue = /* @__PURE__ */ __name((function_, resolve, arguments_) => {
    new Promise((internalResolve) => {
      queue.enqueue(internalResolve);
    }).then(run.bind(void 0, function_, resolve, arguments_));
    if (activeCount < concurrency) {
      resumeNext();
    }
  }, "enqueue");
  const generator = /* @__PURE__ */ __name((function_, ...arguments_) => new Promise((resolve) => {
    enqueue(function_, resolve, arguments_);
  }), "generator");
  Object.defineProperties(generator, {
    activeCount: {
      get: /* @__PURE__ */ __name(() => activeCount, "get")
    },
    pendingCount: {
      get: /* @__PURE__ */ __name(() => queue.size, "get")
    },
    clearQueue: {
      value() {
        queue.clear();
      }
    },
    concurrency: {
      get: /* @__PURE__ */ __name(() => concurrency, "get"),
      set(newConcurrency) {
        validateConcurrency(newConcurrency);
        concurrency = newConcurrency;
        queueMicrotask(() => {
          while (activeCount < concurrency && queue.size > 0) {
            resumeNext();
          }
        });
      }
    },
    map: {
      async value(iterable, function_) {
        const promises = Array.from(iterable, (value, index) => this(function_, value, index));
        return Promise.all(promises);
      }
    }
  });
  return generator;
}
__name(pLimit, "pLimit");
function validateConcurrency(concurrency) {
  if (!((Number.isInteger(concurrency) || concurrency === Number.POSITIVE_INFINITY) && concurrency > 0)) {
    throw new TypeError("Expected `concurrency` to be a number from 1 and up");
  }
}
__name(validateConcurrency, "validateConcurrency");

// src/index.ts
var Worker = {
  async scheduled(event, env2, ctx) {
    const workerLocation = await getWorkerLocation() || "ERROR";
    console.log(`Running scheduled event on ${workerLocation}...`);
    const state = new CompactedMonitorStateWrapper(await getFromStore(env2, "state"));
    state.data.overallDown = 0;
    state.data.overallUp = 0;
    let statusChanged = false;
    const currentTimeSecond = Math.round(Date.now() / 1e3);
    let checkQueue = [];
    let checkResult = {};
    const limit = pLimit(5);
    for (const monitor of workerConfig.monitors) {
      checkQueue.push(limit(() => doMonitor(monitor, workerLocation, env2)));
    }
    for (const result of await Promise.all(checkQueue)) {
      checkResult[result.id] = result;
    }
    for (const monitor of workerConfig.monitors) {
      console.log(`Processing monitor result: ${monitor.name} (${monitor.id})`);
      let monitorStatusChanged = false;
      const { location: checkLocation, status } = checkResult[monitor.id];
      status.up ? state.data.overallUp++ : state.data.overallDown++;
      if (state.incidentLen(monitor.id) === 0) {
        state.appendIncident(monitor.id, {
          start: [currentTimeSecond],
          end: currentTimeSecond,
          error: ["dummy"]
        });
      }
      let lastIncident = state.getIncident(monitor.id, state.incidentLen(monitor.id) - 1);
      if (status.up) {
        if (lastIncident.end === null) {
          lastIncident.end = currentTimeSecond;
          state.setIncident(monitor.id, state.incidentLen(monitor.id) - 1, lastIncident);
          monitorStatusChanged = true;
          try {
            if (
              // grace period not set OR ...
              workerConfig.notification?.gracePeriod === void 0 || // only when we have sent a notification for DOWN status, we will send a notification for UP status (within 30 seconds of possible drift)
              currentTimeSecond - lastIncident.start[0] >= (workerConfig.notification.gracePeriod + 1) * 60 - 30
            ) {
              await formatAndNotify(monitor, true, lastIncident.start[0], currentTimeSecond, "OK");
            } else {
              console.log(
                `grace period (${workerConfig.notification?.gracePeriod}m) not met, skipping webhook UP notification for ${monitor.name}`
              );
            }
            console.log("Calling config onStatusChange callback...");
            await workerConfig.callbacks?.onStatusChange?.(
              env2,
              monitor,
              true,
              lastIncident.start[0],
              currentTimeSecond,
              "OK"
            );
          } catch (e) {
            console.log("Error calling callback: ");
            console.log(e);
          }
        }
      } else {
        if (lastIncident.end !== null) {
          state.appendIncident(monitor.id, {
            start: [currentTimeSecond],
            end: null,
            error: [status.err]
          });
          monitorStatusChanged = true;
        } else if (lastIncident.end === null && lastIncident.error.slice(-1)[0] !== status.err) {
          lastIncident.start.push(currentTimeSecond);
          lastIncident.error.push(status.err);
          state.setIncident(monitor.id, state.incidentLen(monitor.id) - 1, lastIncident);
          monitorStatusChanged = true;
        }
        const currentIncident = state.getIncident(monitor.id, state.incidentLen(monitor.id) - 1);
        try {
          if (
            // monitor status changed AND...
            monitorStatusChanged && // grace period not set OR ...
            (workerConfig.notification?.gracePeriod === void 0 || // have sent a notification for DOWN status
            currentTimeSecond - currentIncident.start[0] >= (workerConfig.notification.gracePeriod + 1) * 60 - 30) || // grace period is set AND...
            workerConfig.notification?.gracePeriod !== void 0 && // grace period is met
            currentTimeSecond - currentIncident.start[0] >= workerConfig.notification.gracePeriod * 60 - 30 && currentTimeSecond - currentIncident.start[0] < workerConfig.notification.gracePeriod * 60 + 30
          ) {
            if (currentIncident.start[0] !== currentTimeSecond && workerConfig.notification?.skipErrorChangeNotification) {
              console.log(
                "Skipping notification for following error reason change due to user config"
              );
            } else {
              await formatAndNotify(
                monitor,
                false,
                currentIncident.start[0],
                currentTimeSecond,
                status.err
              );
            }
          } else {
            console.log(
              `Grace period (${workerConfig.notification?.gracePeriod}m) not met or no change (currently down for ${currentTimeSecond - currentIncident.start[0]}s, changed ${monitorStatusChanged}), skipping webhook DOWN notification for ${monitor.name}`
            );
          }
          if (monitorStatusChanged) {
            console.log("Calling config onStatusChange callback...");
            await workerConfig.callbacks?.onStatusChange?.(
              env2,
              monitor,
              false,
              currentIncident.start[0],
              currentTimeSecond,
              status.err
            );
          }
        } catch (e) {
          console.log("Error calling callback: ");
          console.log(e);
        }
        try {
          console.log("Calling config onIncident callback...");
          await workerConfig.callbacks?.onIncident?.(
            env2,
            monitor,
            currentIncident.start[0],
            currentTimeSecond,
            status.err
          );
        } catch (e) {
          console.log("Error calling callback: ");
          console.log(e);
        }
      }
      state.appendLatency(monitor.id, {
        loc: checkLocation,
        ping: status.ping,
        time: currentTimeSecond
      });
      while (state.getFirstLatency(monitor.id).time < currentTimeSecond - 12 * 60 * 60) {
        state.unshiftLatency(monitor.id);
      }
      while (state.incidentLen(monitor.id) > 0 && state.getIncident(monitor.id, 0).end && state.getIncident(monitor.id, 0).end < currentTimeSecond - 90 * 24 * 60 * 60) {
        state.shiftIncident(monitor.id);
      }
      if (state.incidentLen(monitor.id) === 0 || state.getIncident(monitor.id, 0).start[0] > currentTimeSecond - 90 * 24 * 60 * 60 && state.getIncident(monitor.id, 0).error[0] != "dummy") {
        state.unshiftIncident(monitor.id, {
          start: [currentTimeSecond - 90 * 24 * 60 * 60],
          end: currentTimeSecond - 90 * 24 * 60 * 60,
          error: ["dummy"]
        });
      }
      statusChanged ||= monitorStatusChanged;
    }
    console.log(
      `statusChanged: ${statusChanged}, lastUpdate: ${state.data.lastUpdate}, currentTime: ${currentTimeSecond}`
    );
    if (statusChanged || currentTimeSecond - state.data.lastUpdate >= (workerConfig.kvWriteCooldownMinutes ?? 3) * 60 - 10) {
      console.log("Updating state...");
      state.data.lastUpdate = currentTimeSecond;
      await setToStore(env2, "state", state.getCompactedStateStr());
    } else {
      console.log("Skipping state update due to cooldown period.");
    }
  }
};
var index_default = Worker;
var RemoteChecker = class extends DurableObject {
  static {
    __name(this, "RemoteChecker");
  }
  constructor(ctx, env2) {
    super(ctx, env2);
  }
  async getLocationAndStatus(monitor) {
    const colo = await getWorkerLocation();
    console.log(`Running remote checker (DurableObject) at ${colo}...`);
    const status = await getStatus(monitor);
    return {
      location: colo,
      status
    };
  }
  async kill() {
    this.ctx.blockConcurrencyWhile(async () => {
      throw "killed";
    });
  }
};
export {
  RemoteChecker,
  index_default as default
};
//# sourceMappingURL=index.js.map
