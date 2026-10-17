#!/usr/bin/env node
// 第四阶段：基于真实 V3 与隔离 V3.1 文件，计算可复现的存储和请求模型。
// 不发 HTTP 请求，也不将估算吞吐量冒充实测浏览器或 Cloudflare CDN 指标。
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { DATA_POLICIES } from '../../src/core/site-policy.js';
import { auditStorage } from './audit-storage.mjs';
import { verifyV31Preview } from './v31-preview.mjs';
import { validV31Manifest } from './v31-contract.mjs';

const count = (array, field) => array.reduce((sum, item) => sum + item[field], 0);
const plain = bytes => ({
  bytes: bytes.length,
  gzipBytes: gzipSync(bytes, { level: 9, mtime: 0 }).length,
  brotliBytes: brotliCompressSync(bytes, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  }).length,
});

// 对一个站点只模拟资源请求，不虚构并发、耗时、边缘缓存命中或 GM 存储实现。
function requestsFor(site, manifest, metrics) {
  const files = Object.values(manifest.sites[site.id].files);
  if (site.tables.includes('dict')) files.push(manifest.shared.dict);
  return files.map(meta => {
    const metric = metrics.get(meta.url);
    assert.ok(metric, '缺少资源压缩基准：' + meta.url);
    return { url: meta.url, ...metric };
  });
}

function simulateVisits(siteOrder, manifest, metrics, sharedCache) {
  const visited = new Set();
  const steps = [];
  for (const siteId of siteOrder) {
    const site = DATA_POLICIES.find(item => item.id === siteId);
    assert.ok(site, '未知站点：' + siteId);
    const entries = requestsFor(site, manifest, metrics);
    const cache = sharedCache ? visited : new Set();
    const requested = entries.filter(item => {
      if (cache.has(item.url)) return false;
      cache.add(item.url);
      return true;
    });
    steps.push({
      site: siteId, requests: requested.length, rawBytes: count(requested, 'bytes'),
      gzipBytes: count(requested, 'gzipBytes'),
      brotliBytes: count(requested, 'brotliBytes'),
    });
  }
  return {
    requests: count(steps, 'requests'),
    rawBytes: count(steps, 'rawBytes'),
    gzipBytes: count(steps, 'gzipBytes'),
    brotliBytes: count(steps, 'brotliBytes'),
    steps,
  };
}

function manifestCost(bytes) {
  const payload = plain(bytes);
  return { requests: 1, ...payload };
}

function withSingleManifest(metrics, meta) {
  return {
    requests: metrics.requests + 1,
    rawBytes: metrics.rawBytes + meta.bytes,
    gzipBytes: metrics.gzipBytes + meta.gzipBytes,
    brotliBytes: metrics.brotliBytes + meta.brotliBytes,
  };
}

// 将 manifest 的一次请求单列（假设同一用户脚本共享完整清单缓存）。
// 两者大小不同且都须传输，避免仅根据内容去重率夸大单站收益。
export function evaluateV31(v3Directory, previewDirectory) {
  const source = path.resolve(v3Directory);
  const previewDir = path.resolve(previewDirectory);
  const v3 = auditStorage(source);
  const previewStats = verifyV31Preview(source, previewDir);
  const legacy = JSON.parse(readFileSync(path.join(source, 'manifest.json'), 'utf8'));
  const next = JSON.parse(readFileSync(path.join(previewDir, 'manifest.v31.json'), 'utf8'));
  assert.ok(validV31Manifest(next), '必须为有效的 V3.1 预览清单');
  assert.equal(v3.sourceManifestVersion, next.source.version, '源版本不一致');
  const v3Metrics = new Map(v3.files.map(item => [
    item.path, { bytes: item.bytes, gzipBytes: item.gzipBytes, brotliBytes: item.brotliBytes },
  ]));
  const v31Metrics = new Map();
  for (const site of DATA_POLICIES) {
    for (const [name, meta] of Object.entries(next.sites[site.id].files)) {
      const oldRef = legacy.sites[site.id].files[name];
      const metric = v3Metrics.get(oldRef.url);
      assert.ok(metric && metric.bytes === meta.bytes, 'V3.1 文件大小不对应 V3：' + meta.url);
      v31Metrics.set(meta.url, metric);
    }
  }
  v31Metrics.set(next.shared.dict.url, v3Metrics.get(legacy.shared.dict.url));

  const order = DATA_POLICIES.map(item => item.id);
  const oldManifest = manifestCost(readFileSync(path.join(source, 'manifest.json')));
  const newManifest = manifestCost(readFileSync(path.join(previewDir, 'manifest.v31.json')));
  const oldShared = simulateVisits(order, legacy, v3Metrics, true);
  const newShared = simulateVisits(order, next, v31Metrics, true);
  const oldIsolated = simulateVisits(order, legacy, v3Metrics, false);
  const newIsolated = simulateVisits(order, next, v31Metrics, false);
  const perSite = Object.fromEntries(order.map(id => {
    const old = simulateVisits([id], legacy, v3Metrics, false);
    const nextSite = simulateVisits([id], next, v31Metrics, false);
    return [id, {
      v3: withSingleManifest(old, oldManifest),
      v31: withSingleManifest(nextSite, newManifest),
      // 数据文件按内容一一对应，故单站冷访问不应该减少任何资源请求。
      sameAssetRequests: old.requests === nextSite.requests,
      sameAssetBytes: old.rawBytes === nextSite.rawBytes,
    }];
  }));
  return {
    schema: 1, evidence: 'deterministic-local-model-not-network-measurement',
    sourceVersion: v3.sourceManifestVersion,
    storage: {
      v3LogicalFiles: v3.total.files, v31Objects: previewStats.uniqueObjects,
      v3LogicalBytes: v3.total.rawBytes, v31UniqueBytes: previewStats.uniqueBytes,
      duplicateBytesRemovedInPreview: previewStats.reclaimableBytes,
      duplicatePercent: Number((previewStats.reclaimableBytes / v3.total.rawBytes * 100).toFixed(2)),
    },
    manifest: { v3: oldManifest, v31: newManifest },
    scenarios: {
      // 依次访问七站，按资源 URL 共享缓存时的理论上限；不等同于当前 GM 缓存键。
      sevenSitesSharedCache: {
        v3: withSingleManifest(oldShared, oldManifest),
        v31: withSingleManifest(newShared, newManifest),
      },
      // 各站完全独立缓存时：即使共享远端对象也没有跨站本地去重。
      sevenSitesIsolatedCache: {
        v3: withSingleManifest(oldIsolated, oldManifest),
        v31: withSingleManifest(newIsolated, newManifest),
      },
      // 已缓存且清单未到刷新期：两版均不发起资源请求。
      fullyWarmReload: { v3Requests: 0, v31Requests: 0 },
    },
    perSiteCold: perSite,
    constraints: {
      manifestsDownloadedOnce: true,
      order,
      browserTimingMeasured: false,
      realCdnRequestsMeasured: false,
      actualGmCacheSharingMeasured: false,
      currentProductionUsesV31: false,
    },
    decision: {
      readyForProduction: false,
      recommendation: '保留 V3 为生产默认；V3.1 仅独立原型',
      blockers: [
        '尚无七站真实浏览器冷启动、热缓存与跨域 GM 缓存测量',
        '尚无独立预发 Pages 部署后的真实响应头、CDN 行为与回滚验证',
        '生产客户端尚未实现和端到端验证 V3.1 双协议选择与原子切换',
        '旧对象的跨次 Pages 全站部署保留期限和回收策略尚未生产验收',
      ],
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const v3i = args.indexOf('--dir');
  const prei = args.indexOf('--preview');
  const outi = args.indexOf('--out');
  assert.ok(v3i >= 0 && args[v3i + 1] && prei >= 0 && args[prei + 1],
    '用法：--dir <V3目录> --preview <隔离预览目录> [--out <JSON>]');
  const report = evaluateV31(args[v3i + 1], args[prei + 1]);
  const text = JSON.stringify(report, null, 2) + '\n';
  if (outi >= 0) {
    assert.ok(args[outi + 1], '--out 必须指定文件路径');
    writeFileSync(args[outi + 1], text);
  } else process.stdout.write(text);
}
