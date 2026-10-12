#!/usr/bin/env node
// Cloudflare Pages V3 数据站端去重：保留 manifest 和旧 URL，只删除重复静态副本。
// 缺失的旧 URL 由 Pages _redirects 的 200 内部代理提供，用户脚本无需升级。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_POLICIES } from '../../src/core/site-policy.js';
import { requiredV3Files, validV3Manifest } from '../../src/core/v3-contract.js';
import { validRuntimeDictionary } from '../../src/core/dict-contract.js';
import { verifyV3Publish } from './verify-publish-contract.mjs';
import { verifyPagesAssets } from './verify-pages-assets.mjs';

const PREFIX = '/ff14/v3/';
const MAX_REDIRECTS = 2000;
const digest = data => createHash('sha256').update(data).digest('hex');
const byUrl = (a, b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0;

function listedFiles(manifest) {
  const files = [];
  for (const site of SITE_POLICIES) {
    for (const name of requiredV3Files(site)) {
      files.push(manifest.sites[site.id].files[name]);
    }
  }
  files.push(manifest.shared.dict);
  return files;
}

// 严格按相同内容摘要、文件后缀与字节数分组，避免将不同 MIME 的资源合并。
function routesFromManifest(manifest) {
  const groups = new Map();
  for (const meta of listedFiles(manifest)) {
    const extension = path.posix.extname(meta.url);
    const key = meta.sha256 + ':' + extension + ':' + meta.bytes;
    const group = groups.get(key) || [];
    group.push(meta);
    groups.set(key, group);
  }
  const routes = [];
  for (const group of groups.values()) {
    group.sort(byUrl);
    for (const duplicate of group.slice(1)) {
      routes.push({
        source: PREFIX + duplicate.url,
        target: PREFIX + group[0].url,
        bytes: duplicate.bytes,
        sha256: duplicate.sha256,
      });
    }
  }
  routes.sort((a, b) => a.source < b.source ? -1 : a.source > b.source ? 1 : 0);
  assert.ok(routes.length <= MAX_REDIRECTS, 'Pages _redirects 静态规则数超过平台上限');
  return routes;
}

function redirectText(routes) {
  return '# 相同 SHA-256 静态资源共用单份文件；200 为内部代理，不改变旧 URL。\n'
    + routes.map(item => item.source + ' ' + item.target + ' 200').join('\n')
    + '\n';
}

function paths(root) {
  const site = path.resolve(root);
  return { site, v3: path.join(site, 'ff14', 'v3') };
}

// 生成所有实际字节已通过 SHA 校验的计划，不写入或删除任何文件。
export function planPagesDedupe(siteDirectory) {
  const { site, v3 } = paths(siteDirectory);
  verifyPagesAssets(site);
  verifyV3Publish(v3);
  const manifest = JSON.parse(readFileSync(path.join(v3, 'manifest.json'), 'utf8'));
  const routes = routesFromManifest(manifest);
  const bytesSaved = routes.reduce((sum, route) => sum + route.bytes, 0);
  return { routes, bytesSaved, filesBefore: listedFiles(manifest).length,
    filesAfter: listedFiles(manifest).length - routes.length };
}

// 对去重后的实际发布目录完整验收：manifest 仍合法且每条旧 URL 都映射到真实、
// 类型一致、SHA/长度一致的目标，不允许悬空链接或未受控的额外重写规则。
export function verifyPagesDedupe(siteDirectory) {
  const { site, v3 } = paths(siteDirectory);
  verifyPagesAssets(site);
  const manifest = JSON.parse(readFileSync(path.join(v3, 'manifest.json'), 'utf8'));
  assert.ok(validV3Manifest(manifest), '去重后 V3 manifest 结构非法');
  assert.equal(manifest.candidatePolicy, 1, '去重目录必须使用当前装备候选策略');
  assert.deepEqual(Object.keys(manifest.sites).sort(), SITE_POLICIES.map(x => x.id).sort(),
    '去重目录必须保留完整七站');
  const dictionary = JSON.parse(readFileSync(path.join(v3, 'dict.json'), 'utf8'));
  assert.ok(validRuntimeDictionary(dictionary, true), '去重目录的共享词典结构非法');
  const routes = routesFromManifest(manifest);
  const ruleFile = path.join(site, '_redirects');
  assert.equal(readFileSync(ruleFile, 'utf8'), redirectText(routes),
    'Pages 内部代理规则与 manifest 实际重复内容不一致');
  const redirects = new Map(routes.map(item => [item.source, item]));
  const sources = new Set(routes.map(item => item.source));
  const targets = new Set(routes.map(item => item.target));
  assert.equal(sources.size, routes.length, '不允许重复的旧 URL 重写');
  for (const target of targets) {
    assert.ok(!sources.has(target), '禁止重写链或循环引用：' + target);
  }
  for (const meta of listedFiles(manifest)) {
    const url = PREFIX + meta.url;
    const proxy = redirects.get(url);
    const effective = proxy ? proxy.target.slice(PREFIX.length) : meta.url;
    assert.equal(!existsSync(path.join(v3, meta.url)), !!proxy,
      '必须恰好删除需要 200 内部代理的重复文件：' + url);
    const bytes = readFileSync(path.join(v3, effective));
    assert.equal(bytes.length, meta.bytes, '重写后字节长度不一致：' + url);
    assert.equal(digest(bytes), meta.sha256, '重写后 SHA-256 不一致：' + url);
  }
  return {
    logicalFiles: listedFiles(manifest).length,
    storedFiles: listedFiles(manifest).length - routes.length,
    internalRewrites: routes.length,
    duplicateBytesRemoved: routes.reduce((sum, route) => sum + route.bytes, 0),
  };
}

// 在生成与全量验证之后运行：先写规则再删除冗余副本；失败不会进入 Pages 部署。
export function applyPagesDedupe(siteDirectory) {
  const { site, v3 } = paths(siteDirectory);
  const planned = planPagesDedupe(site);
  const ruleFile = path.join(site, '_redirects');
  assert.ok(!existsSync(ruleFile), '拒绝覆盖已有 Pages _redirects 文件');
  writeFileSync(ruleFile, redirectText(planned.routes), { flag: 'wx' });
  for (const route of planned.routes) {
    rmSync(path.join(v3, route.source.slice(PREFIX.length)));
  }
  return verifyPagesDedupe(site);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--site');
  const site = i < 0 ? 'site' : args[i + 1];
  assert.ok(site, '--site 必须指定 Pages 静态部署目录');
  const verifyOnly = args.includes('--verify');
  const result = verifyOnly ? verifyPagesDedupe(site) : applyPagesDedupe(site);
  console.log('✅ Pages V3 旧路径透明去重：' + JSON.stringify(result));
}
