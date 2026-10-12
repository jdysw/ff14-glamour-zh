// 测试真实 V3 七站文件契约及 SHA 内容下的 Pages 内部代理式去重。
// 验证同内容仅留一份、所有旧 URL 的有效正文一致、失效规则与损坏文件均被拒绝。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SITE_POLICIES } from '../../src/core/site-policy.js';
import { RUNTIME_DICT_LAYERS } from '../../src/core/dict-contract.js';
import { requiredV3Files } from '../../src/core/v3-contract.js';
import { applyPagesDedupe, planPagesDedupe, verifyPagesDedupe } from '../../tools/data/dedupe-pages.mjs';
import { verifyV3Publish } from '../../tools/data/verify-publish-contract.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = mkdtempSync(path.join(os.tmpdir(), 'zhx-dedupe-pages-'));
const site = path.join(root, 'site');
const v3 = path.join(site, 'ff14', 'v3');
mkdirSync(v3, { recursive: true });

try {
  const sites = {};
  const contents = new Map();
  for (const policy of SITE_POLICIES) {
    const files = {};
    for (const name of requiredV3Files(policy)) {
      const ext = ['series', 'acl'].includes(name) ? 'txt' : 'tsv';
      const url = policy.id + '/' + name + '.' + ext;
      // 让全部 alias 保持一致，同时让其他文件包含站点标识。
      const text = name === 'alias' ? '跨站共有译名\t装备甲\n'
        : policy.id + '/' + name + '\t装备乙\n';
      const bytes = Buffer.from(text, 'utf8');
      mkdirSync(path.dirname(path.join(v3, url)), { recursive: true });
      writeFileSync(path.join(v3, url), bytes);
      contents.set(url, bytes);
      files[name] = { url, sha256: sha(bytes), bytes: bytes.length };
    }
    sites[policy.id] = { files };
  }
  const dict = Buffer.from(JSON.stringify(
    Object.fromEntries(RUNTIME_DICT_LAYERS.map(layer => [layer, {}])), null, 2), 'utf8');
  writeFileSync(path.join(v3, 'dict.json'), dict);
  contents.set('dict.json', dict);
  const manifest = {
    schema: 3, candidatePolicy: 1, version: 'abcdef123456', sites,
    shared: { dict: { url: 'dict.json', sha256: sha(dict), bytes: dict.length } },
  };
  writeFileSync(path.join(v3, 'manifest.json'), JSON.stringify(manifest));
  assert.equal(verifyV3Publish(v3).files, contents.size);

  const plan = planPagesDedupe(site);
  const aliasCount = SITE_POLICIES.filter(policy => requiredV3Files(policy).includes('alias')).length;
  assert.equal(plan.routes.length, aliasCount - 1,
    '按照站点实际需求推导 alias 完全相同副本数量');
  assert.ok(plan.routes.every(route => route.source.endsWith('/alias.tsv') &&
    route.target.endsWith('/alias.tsv')));
  assert.equal(plan.filesAfter, plan.filesBefore - plan.routes.length);
  assert.ok(!existsSync(path.join(site, '_redirects')), '计划阶段不能修改生产产物');

  const result = applyPagesDedupe(site);
  assert.equal(result.internalRewrites, plan.routes.length);
  assert.equal(result.logicalFiles, contents.size);
  assert.equal(result.storedFiles, contents.size - plan.routes.length);
  assert.equal(result.duplicateBytesRemoved, plan.bytesSaved);
  assert.deepEqual(verifyPagesDedupe(site), result);
  assert.deepEqual(JSON.parse(readFileSync(path.join(v3, 'manifest.json'), 'utf8')), manifest,
    '去重必须保留旧 manifest 全部路径和元数据');
  const rules = readFileSync(path.join(site, '_redirects'), 'utf8');
  for (const route of plan.routes) {
    assert.ok(rules.includes(route.source + ' ' + route.target + ' 200'),
      '必须使用透明内部代理而非 301/302 浏览器跳转');
    assert.ok(!existsSync(path.join(site, route.source.slice(1))));
  }
  // 所有被声明的旧文件都可以按有效代理目标还原成原字节。
  for (const [url, bytes] of contents) {
    const from = '/ff14/v3/' + url;
    const redirect = plan.routes.find(route => route.source === from);
    const effective = redirect ? redirect.target.slice('/ff14/v3/'.length) : url;
    assert.deepEqual(readFileSync(path.join(v3, effective)), bytes,
      '旧 URL 必须还原到完全一样的正文：' + from);
  }

  const canonical = path.join(v3, plan.routes[0].target.slice('/ff14/v3/'.length));
  const saved = readFileSync(canonical);
  writeFileSync(canonical, '错误字节');
  assert.throws(() => verifyPagesDedupe(site), /SHA-256|字节长度/,
    '代理后的目标被篡改必须使发布前校验失败');
  writeFileSync(canonical, saved);
  assert.deepEqual(verifyPagesDedupe(site), result);

  writeFileSync(path.join(site, '_redirects'), rules.replace(' 200', ' 302'));
  assert.throws(() => verifyPagesDedupe(site), /规则与 manifest/,
    '外部跳转或手改重写规则必须被拒绝');
  writeFileSync(path.join(site, '_redirects'), rules);
  assert.throws(() => applyPagesDedupe(site), /ENOENT|不匹配/,
    '已去重目录不能再次作为未优化的原始文件重新处理');

  console.log('✅ Pages V3 去重：旧 URL 不变、200 代理、逐字节一致、错误规则与损坏资源拒绝');
} finally {
  rmSync(root, { recursive: true, force: true });
}
