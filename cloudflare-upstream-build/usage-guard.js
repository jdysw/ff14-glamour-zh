var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/graphql.ts
var GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
var USAGE_QUERY = `query Usage($account: String!, $date: Date!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      workersInvocationsAdaptive(limit: 1000, filter: { date: $date }) {
        sum { requests errors cpuTimeUs }
        dimensions { scriptName }
      }
      d1AnalyticsAdaptiveGroups(limit: 1000, filter: { date: $date }) {
        sum { rowsRead rowsWritten readQueries writeQueries }
        dimensions { databaseId }
      }
      durableObjectsInvocationsAdaptiveGroups(limit: 1000, filter: { date: $date }) {
        sum { requests }
        dimensions { scriptName }
      }
      kvOperationsAdaptiveGroups(limit: 1000, filter: { date: $date }) {
        sum { requests }
        dimensions { namespaceId actionType }
      }
      r2OperationsAdaptiveGroups(limit: 1000, filter: { date: $date }) {
        sum { requests }
        dimensions { bucketName actionType }
      }
      queueMessageOperationsAdaptiveGroups(limit: 1000, filter: { date: $date }) {
        sum { billableOperations }
        dimensions { queueId actionType }
      }
    }
  }
}`;
async function fetchUsage(token, account, date, fetchImpl = fetch) {
  const res = await fetchImpl(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: USAGE_QUERY, variables: { account, date } })
  });
  if (!res.ok) throw new Error(`graphql: ${res.status}`);
  const body = await res.json();
  if (body.errors && body.errors.length > 0) {
    throw new Error(`graphql: ${body.errors.map((e) => e.message).join("; ")}`);
  }
  return body.data?.viewer?.accounts?.[0] ?? null;
}
__name(fetchUsage, "fetchUsage");
var R2_CLASS_A = /* @__PURE__ */ new Set([
  "ListBuckets",
  "PutBucket",
  "ListObjects",
  "PutObject",
  "CopyObject",
  "CompleteMultipartUpload",
  "CreateMultipartUpload",
  "LifecycleStorageTierTransition",
  "ListMultipartUploads",
  "UploadPart",
  "UploadPartCopy",
  "ListParts",
  "PutBucketEncryption",
  "PutBucketCors",
  "PutBucketLifecycleConfiguration"
]);
var R2_CLASS_B = /* @__PURE__ */ new Set([
  "HeadBucket",
  "HeadObject",
  "GetObject",
  "UsageSummary",
  "GetBucketEncryption",
  "GetBucketLocation",
  "GetBucketCors",
  "GetBucketLifecycleConfiguration"
]);
function r2Class(actionType) {
  if (R2_CLASS_A.has(actionType)) return "class_a";
  if (R2_CLASS_B.has(actionType)) return "class_b";
  return "other";
}
__name(r2Class, "r2Class");
var KV_ACTIONS = /* @__PURE__ */ new Set(["read", "write", "delete", "list"]);
function kvMetric(actionType) {
  const a = actionType.toLowerCase();
  return KV_ACTIONS.has(a) ? a : "other";
}
__name(kvMetric, "kvMetric");
function add(acc, row) {
  const key = `${row.product}\0${row.metric}\0${row.dim}`;
  const cur = acc.get(key);
  if (cur) cur.value += row.value;
  else acc.set(key, { ...row });
}
__name(add, "add");
function toRows(date, account) {
  const acc = /* @__PURE__ */ new Map();
  if (!account) return [];
  for (const g of account.workersInvocationsAdaptive ?? []) {
    const dim = g.dimensions.scriptName;
    add(acc, { date, product: "workers", metric: "requests", dim, value: g.sum.requests });
    add(acc, { date, product: "workers", metric: "errors", dim, value: g.sum.errors });
    add(acc, { date, product: "workers", metric: "cpu_ms", dim, value: g.sum.cpuTimeUs / 1e3 });
  }
  for (const g of account.d1AnalyticsAdaptiveGroups ?? []) {
    const dim = g.dimensions.databaseId;
    add(acc, { date, product: "d1", metric: "rows_read", dim, value: g.sum.rowsRead });
    add(acc, { date, product: "d1", metric: "rows_written", dim, value: g.sum.rowsWritten });
    add(acc, { date, product: "d1", metric: "read_queries", dim, value: g.sum.readQueries });
    add(acc, { date, product: "d1", metric: "write_queries", dim, value: g.sum.writeQueries });
  }
  for (const g of account.durableObjectsInvocationsAdaptiveGroups ?? []) {
    add(acc, {
      date,
      product: "do",
      metric: "requests",
      dim: g.dimensions.scriptName,
      value: g.sum.requests
    });
  }
  for (const g of account.kvOperationsAdaptiveGroups ?? []) {
    add(acc, {
      date,
      product: "kv",
      metric: kvMetric(g.dimensions.actionType),
      dim: g.dimensions.namespaceId,
      value: g.sum.requests
    });
  }
  for (const g of account.r2OperationsAdaptiveGroups ?? []) {
    add(acc, {
      date,
      product: "r2",
      metric: r2Class(g.dimensions.actionType),
      dim: g.dimensions.bucketName,
      value: g.sum.requests
    });
  }
  for (const g of account.queueMessageOperationsAdaptiveGroups ?? []) {
    add(acc, {
      date,
      product: "queues",
      metric: "operations",
      dim: g.dimensions.queueId,
      value: g.sum.billableOperations
    });
  }
  return [...acc.values()];
}
__name(toRows, "toRows");

// src/spike.ts
var SPIKE_RATIO = 10;
var DEFAULT_THRESHOLDS = {
  "workers.requests": 1e5,
  // 10M / month
  "workers.errors": 1e3,
  // not billed
  "workers.cpu_ms": 3e5,
  // 30M CPU-ms / month
  "d1.rows_read": 25e7,
  // 25B / month
  "d1.rows_written": 5e5,
  // 50M / month
  "d1.read_queries": 1e5,
  // not billed
  "d1.write_queries": 1e4,
  // not billed
  "do.requests": 1e4,
  // 1M / month
  "kv.read": 1e5,
  // 10M / month
  "kv.write": 1e4,
  // 1M / month
  "kv.delete": 1e4,
  // 1M / month
  "kv.list": 1e4,
  // 1M / month
  "kv.other": 1e4,
  "r2.class_a": 1e4,
  // 1M / month
  "r2.class_b": 1e5,
  // 10M / month
  "r2.other": 1e4,
  "queues.operations": 1e4
  // 1M / month
};
var FALLBACK_THRESHOLD = 1e4;
function parseThresholds(json) {
  const out = { ...DEFAULT_THRESHOLDS };
  if (!json || json.trim() === "") return out;
  const parsed = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("THRESHOLDS_JSON must be a JSON object");
  }
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      throw new Error(`THRESHOLDS_JSON[${k}] must be a non-negative number`);
    }
    out[k] = v;
  }
  return out;
}
__name(parseThresholds, "parseThresholds");
function median(values) {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid];
  return (s[mid - 1] + s[mid]) / 2;
}
__name(median, "median");
function spike(today, last7, thresholds = DEFAULT_THRESHOLDS) {
  const out = [];
  for (const metric of Object.keys(today).sort()) {
    const value = today[metric];
    const history = last7[metric];
    if (!history || history.length === 0) continue;
    const floor = thresholds[metric] ?? FALLBACK_THRESHOLD;
    if (value < floor) continue;
    const baseline = median(history);
    const ratio = baseline === 0 ? Number.POSITIVE_INFINITY : value / baseline;
    if (ratio < SPIKE_RATIO) continue;
    out.push({ metric, today: value, baseline, ratio });
  }
  return out;
}
__name(spike, "spike");
function formatRatio(ratio) {
  return Number.isFinite(ratio) ? `${ratio.toFixed(1)}\xD7` : "new";
}
__name(formatRatio, "formatRatio");

// src/notify.ts
function formatMessage(date, spikes) {
  const lines = spikes.map(
    (s) => `\u2022 ${s.metric}: ${s.today.toLocaleString("en-US")} today vs. 7-day median ${s.baseline.toLocaleString("en-US")} (${formatRatio(s.ratio)})`
  );
  return `usage-guard-collector \u2014 ${spikes.length} spike${spikes.length === 1 ? "" : "s"} on ${date} (UTC)
${lines.join("\n")}`;
}
__name(formatMessage, "formatMessage");
async function post(target, url, payload, fetchImpl) {
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return { target, ok: res.ok, status: res.status };
  } catch (e) {
    return { target, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
__name(post, "post");
async function notify(env, text, fetchImpl = fetch) {
  const jobs = [];
  if (env.DISCORD_WEBHOOK_URL) {
    jobs.push(post("discord", env.DISCORD_WEBHOOK_URL, { content: text }, fetchImpl));
  }
  if (env.SLACK_WEBHOOK_URL) {
    jobs.push(post("slack", env.SLACK_WEBHOOK_URL, { text }, fetchImpl));
  }
  return Promise.all(jobs);
}
__name(notify, "notify");

// src/page.ts
function escapeHtml(s) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
__name(escapeHtml, "escapeHtml");
function fmtNum(n) {
  if (n === void 0) return "\u2013";
  return Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}
__name(fmtNum, "fmtNum");
var FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>usage-guard-collector</title><rect width="64" height="64" rx="14" fill="#141821"/><rect x="0.5" y="0.5" width="63" height="63" rx="13.5" fill="none" stroke="#232838"/><circle cx="32" cy="34" r="16" fill="none" stroke="#4f8cff" stroke-width="6" stroke-dasharray="75.40 100.53" transform="rotate(135 32 34)"/><path d="M32 34L41.5 28.4" stroke="#a78bfa" stroke-width="6" stroke-linecap="round"/><circle cx="32" cy="34" r="4.5" fill="#a78bfa"/></svg>`;
function faviconHref() {
  return `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}`;
}
__name(faviconHref, "faviconHref");
var CSS = `body{font:14px/1.5 -apple-system,system-ui,sans-serif;max-width:64rem;margin:2rem auto;padding:0 1rem;color:#222}
table{border-collapse:collapse;width:100%}th,td{padding:.3rem .5rem;border-bottom:1px solid #ddd;text-align:right;white-space:nowrap}
th:first-child,td:first-child{text-align:left}th{font-weight:600}.spike{background:#fff3e0}.muted{color:#777}code{font-size:.9em}`;
function renderPage(m) {
  const spikeKeys = new Set(m.spikes.map((s) => s.metric));
  const head = m.dates.map((d) => `<th>${escapeHtml(d.slice(5))}</th>`).join("");
  const metrics = [...m.table.keys()].sort();
  const body = metrics.length === 0 ? `<tr><td colspan="${m.dates.length + 1}" class="muted">No rows yet. The Cron runs every 6 hours; trigger one with <code>curl -X POST http://127.0.0.1:8787/__scheduled</code> under <code>wrangler dev --test-scheduled</code>.</td></tr>` : metrics.map((k) => {
    const byDate = m.table.get(k);
    const cells = m.dates.map((d) => `<td>${fmtNum(byDate.get(d))}</td>`).join("");
    return `<tr${spikeKeys.has(k) ? ' class="spike"' : ""}><td><code>${escapeHtml(k)}</code></td>${cells}</tr>`;
  }).join("");
  const spikes = m.spikes.length === 0 ? `<p class="muted">No spikes today (today \u2265 10\xD7 the 7-day median and above the per-metric floor).</p>` : `<ul>${m.spikes.map(
    (s) => `<li><code>${escapeHtml(s.metric)}</code>: ${fmtNum(s.today)} today vs. median ${fmtNum(s.baseline)} (${escapeHtml(formatRatio(s.ratio))})</li>`
  ).join("")}</ul>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><meta name="theme-color" content="#141821"><link rel="icon" type="image/svg+xml" href="${faviconHref()}"><title>usage-guard-collector</title><style>${CSS}</style></head><body>
<h1>Cloudflare usage, last ${m.dates.length} days</h1>
<p class="muted">Account-wide daily totals from the GraphQL Analytics API (UTC days; today is partial).
${m.lastCollected ? `Last collected ${escapeHtml(m.lastCollected)}.` : "Not collected yet."}
These are analytics counts, not the invoice.</p>
<h2>Spikes</h2>${spikes}
<h2>Daily totals</h2>
<table><thead><tr><th>metric</th>${head}</tr></thead><tbody>${body}</tbody></table>
<p class="muted">Read-only. Source: <a href="https://github.com/HowardZlh/usage-guard-collector">github.com/HowardZlh/usage-guard-collector</a>.</p>
</body></html>`;
}
__name(renderPage, "renderPage");

// src/store.ts
var UPSERT = `INSERT INTO usage_daily (date, product, metric, dim, value, collected_at)
VALUES (?1, ?2, ?3, ?4, ?5, ?6)
ON CONFLICT (date, product, metric, dim) DO UPDATE SET value = excluded.value, collected_at = excluded.collected_at`;
async function upsertRows(db, rows, collectedAt) {
  if (rows.length === 0) return 0;
  const stmt = db.prepare(UPSERT);
  await db.batch(
    rows.map((r) => stmt.bind(r.date, r.product, r.metric, r.dim, r.value, collectedAt))
  );
  return rows.length;
}
__name(upsertRows, "upsertRows");
async function loadTotals(db, from, to) {
  const res = await db.prepare(
    `SELECT date, product || '.' || metric AS metric, SUM(value) AS value
       FROM usage_daily WHERE date >= ?1 AND date <= ?2
       GROUP BY date, product, metric ORDER BY date, metric`
  ).bind(from, to).all();
  return res.results;
}
__name(loadTotals, "loadTotals");
function buildSeries(rows, today) {
  const out = { today: {}, last7: {} };
  for (const r of rows) {
    if (r.date === today) {
      out.today[r.metric] = r.value;
    } else if (r.date < today) {
      const hist = out.last7[r.metric] ?? [];
      hist.push(r.value);
      out.last7[r.metric] = hist;
    }
  }
  return out;
}
__name(buildSeries, "buildSeries");
function pivot(rows) {
  const m = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const byDate = m.get(r.metric) ?? /* @__PURE__ */ new Map();
    byDate.set(r.date, r.value);
    m.set(r.metric, byDate);
  }
  return m;
}
__name(pivot, "pivot");
async function filterUnnotified(db, date, spikes) {
  if (spikes.length === 0) return [];
  const res = await db.prepare("SELECT product || '.' || metric AS metric FROM spike_notified WHERE date = ?1").bind(date).all();
  const seen = new Set(res.results.map((r) => r.metric));
  return spikes.filter((s) => !seen.has(s.metric));
}
__name(filterUnnotified, "filterUnnotified");
async function markNotified(db, date, spikes, notifiedAt) {
  if (spikes.length === 0) return;
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO spike_notified (date, product, metric, notified_at) VALUES (?1, ?2, ?3, ?4)"
  );
  await db.batch(
    spikes.map((s) => {
      const [product, metric] = splitKey(s.metric);
      return stmt.bind(date, product, metric, notifiedAt);
    })
  );
}
__name(markNotified, "markNotified");
function splitKey(key) {
  const i = key.indexOf(".");
  return i < 0 ? [key, ""] : [key.slice(0, i), key.slice(i + 1)];
}
__name(splitKey, "splitKey");

// src/run.ts
var HISTORY_DAYS = 7;
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
__name(isoDate, "isoDate");
function addDays(date, delta) {
  const d = /* @__PURE__ */ new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return isoDate(d);
}
__name(addDays, "addDays");
async function runCollect(env, now = /* @__PURE__ */ new Date(), fetchImpl = fetch) {
  const today = isoDate(now);
  const summary = { date: today, written: 0, spikes: 0, notified: 0 };
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    summary.error = "CF_API_TOKEN / CF_ACCOUNT_ID not set";
    return summary;
  }
  try {
    const collectedAt = now.toISOString();
    for (const date of [addDays(today, -1), today]) {
      const account = await fetchUsage(env.CF_API_TOKEN, env.CF_ACCOUNT_ID, date, fetchImpl);
      summary.written += await upsertRows(env.USAGE, toRows(date, account), collectedAt);
    }
    const totals = await loadTotals(env.USAGE, addDays(today, -HISTORY_DAYS), today);
    const series = buildSeries(totals, today);
    const spikes = spike(series.today, series.last7, parseThresholds(env.THRESHOLDS_JSON));
    summary.spikes = spikes.length;
    const fresh = await filterUnnotified(env.USAGE, today, spikes);
    if (fresh.length > 0) {
      const results = await notify(env, formatMessage(today, fresh), fetchImpl);
      summary.notified = results.filter((r) => r.ok).length;
      if (results.length > 0 && results.every((r) => r.ok)) {
        await markNotified(env.USAGE, today, fresh, collectedAt);
      }
    }
  } catch (e) {
    summary.error = e instanceof Error ? e.message : String(e);
  }
  return summary;
}
__name(runCollect, "runCollect");
async function renderIndex(env, now = /* @__PURE__ */ new Date()) {
  const today = isoDate(now);
  const from = addDays(today, -(HISTORY_DAYS - 1));
  const totals = await loadTotals(env.USAGE, addDays(today, -HISTORY_DAYS), today);
  const series = buildSeries(totals, today);
  const spikes = spike(series.today, series.last7, parseThresholds(env.THRESHOLDS_JSON));
  const last = await env.USAGE.prepare("SELECT MAX(collected_at) AS t FROM usage_daily").first();
  const dates = [];
  for (let d = from; d <= today; d = addDays(d, 1)) dates.push(d);
  return renderPage({
    dates,
    table: pivot(totals.filter((r) => r.date >= from)),
    spikes,
    lastCollected: last?.t ?? null
  });
}
__name(renderIndex, "renderIndex");

// src/index.ts
var index_default = {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      runCollect(env).then((s) => {
        console.log(JSON.stringify({ event: "collect", ...s }));
      })
    );
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" || url.pathname !== "/") {
      return new Response("Not found", { status: 404 });
    }
    const html = await renderIndex(env);
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
