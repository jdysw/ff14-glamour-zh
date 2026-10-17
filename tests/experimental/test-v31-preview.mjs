// 使用真实七站契约构造两代数据，证明内容寻址预览、逐字节一致性和旧 V3 回退。
// 不修改用户脚本，也不通过调整测试预期规避失败。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_POLICIES } from '../../src/core/site-policy.js';
import { RUNTIME_DICT_LAYERS } from '../../src/core/dict-contract.js';
import { requiredV3Files, validV3Manifest } from '../../src/core/v3-contract.js';
import { SHARED_CANDIDATE_GROUPS } from '../../tools/data/verify-shared-candidates.mjs';
import { createV31Preview, verifyV31Preview } from '../../tools/data/v31-preview.mjs';
import { readV31WithV3Fallback } from '../../tools/data/v31-preview-reader.mjs';
import { createV31RetainedStore } from '../../tools/data/v31-retention.mjs';
import { evaluateV31 } from '../../tools/data/v31-evaluate.mjs';
import { v31ObjectUrl, validV31Manifest, v31GetFile } from '../../tools/data/v31-contract.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const root = mkdtempSync(path.join(os.tmpdir(), 'zhx-v31-proof-'));
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

function fixture(folder, version, changedSite = '') {
  mkdirSync(folder, { recursive: true });
  const sites = {};
  for (const policy of DATA_POLICIES) {
    const files = {};
    for (const name of requiredV3Files(policy)) {
      const extension = ['series', 'acl'].includes(name) ? 'txt' : 'tsv';
      const filename = policy.id + '/' + name + '.' + extension;
      const shared = SHARED_CANDIDATE_GROUPS.find(group =>
        group.type === name && group.sites.includes(policy.id));
      const label = shared ? name + '-共用' : policy.id + '-' + name;
      const suffix = changedSite === policy.id && name === 'names' ? '-新版本' : '';
      const payload = Buffer.from(label + suffix + '\t中文数据\n', 'utf8');
      mkdirSync(path.dirname(path.join(folder, filename)), { recursive: true });
      writeFileSync(path.join(folder, filename), payload);
      files[name] = { url: filename, sha256: digest(payload), bytes: payload.length };
    }
    sites[policy.id] = { files };
  }
  const dictionary = Object.fromEntries(RUNTIME_DICT_LAYERS.map(key => [key, {}]));
  const dict = Buffer.from(JSON.stringify(dictionary), 'utf8');
  writeFileSync(path.join(folder, 'dict.json'), dict);
  const manifest = {
    schema: 3, candidatePolicy: 1, version,
    sites, shared: { dict: { url: 'dict.json', sha256: digest(dict), bytes: dict.length } },
  };
  writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify(manifest));
  return manifest;
}

try {
  const oldDir = path.join(root, 'v3-old');
  const previewDir = path.join(root, 'preview-old');
  const legacy = fixture(oldDir, '123456abcdef');
  assert.equal(validV3Manifest(legacy), true);
  const stats = createV31Preview(oldDir, previewDir);
  const preview = JSON.parse(readFileSync(path.join(previewDir, 'manifest.v31.json'), 'utf8'));
  assert.equal(validV31Manifest(preview), true);
  assert.equal(validV3Manifest(preview), false, '新清单不能混入旧 V3 清单入口');
  assert.equal(stats.logicalFiles, Object.values(legacy.sites).reduce((count, site) => count + Object.keys(site.files).length, 1));
  assert.ok(stats.uniqueObjects < stats.logicalFiles, '必须真实减少重复内容对象');
  assert.ok(stats.reclaimableBytes > 0, '必须保有可测量的去重收益');
  assert.deepEqual(stats, verifyV31Preview(oldDir, previewDir));
  const assessment = evaluateV31(oldDir, previewDir);
  assert.equal(assessment.storage.v3LogicalFiles, stats.logicalFiles);
  assert.equal(assessment.storage.v31Objects, stats.uniqueObjects);
  assert.equal(assessment.storage.duplicateBytesRemovedInPreview, stats.reclaimableBytes);
  assert.ok(assessment.scenarios.sevenSitesSharedCache.v31.requests
    < assessment.scenarios.sevenSitesSharedCache.v3.requests,
  '跨站共享缓存模型应减少实际对象请求数');
  assert.equal(assessment.scenarios.sevenSitesIsolatedCache.v31.requests,
    assessment.scenarios.sevenSitesIsolatedCache.v3.requests,
    '完全隔离缓存模型下不应凭空减少请求数');
  for (const site of DATA_POLICIES) {
    assert.equal(assessment.perSiteCold[site.id].sameAssetRequests, true,
      '单站冷访问不能靠跨站去重减少文件请求');
    assert.equal(assessment.perSiteCold[site.id].sameAssetBytes, true,
      '单站冷访问文件正文必须逐字节等价');
  }
  assert.equal(assessment.scenarios.fullyWarmReload.v3Requests, 0);
  assert.equal(assessment.scenarios.fullyWarmReload.v31Requests, 0);
  assert.equal(assessment.decision.readyForProduction, false,
    '缺少真实浏览器和 CDN 验收时不得自动宣称已可上线');
  assert.equal(assessment.constraints.browserTimingMeasured, false);
  assert.equal(stats.uniqueObjects, new Set(
    DATA_POLICIES.flatMap(site => Object.values(preview.sites[site.id].files).map(meta => meta.url))
      .concat(preview.shared.dict.url)).size);
  assert.equal(preview.source.version, legacy.version);
  assert.equal(preview.shared.dict.url, v31ObjectUrl(legacy.shared.dict.sha256, 'json'));

  const source = site => legacy.sites[site].files.names;
  assert.equal(v31GetFile(preview, 'fc', 'names').url,
    v31GetFile(preview, 'collection', 'names').url, '相同内容必须复用同一不可变对象');
  assert.notEqual(v31GetFile(preview, 'fc', 'names').url,
    v31GetFile(preview, 'ec', 'names').url, '不同语言文件不允许因为名称相同被错误合并');

  const getPreview = async url => readFileSync(path.join(previewDir, url), 'utf8');
  const getLegacy = async url => readFileSync(path.join(oldDir, url), 'utf8');
  const args = { previewManifest: preview, legacyManifest: legacy,
    legacyManifestBytes: readFileSync(path.join(oldDir, 'manifest.json'), 'utf8'),
    siteId: 'fc', name: 'names', fetchPreview: getPreview, fetchLegacy: getLegacy };
  const content = readFileSync(path.join(oldDir, source('fc').url), 'utf8');
  assert.deepEqual(await readV31WithV3Fallback(args), { source: 'v31', text: content });
  assert.deepEqual(await readV31WithV3Fallback({ ...args, legacyManifestBytes: undefined }),
    { source: 'v3', text: content }, '缺少来源原始清单字节时不能选择新协议');
  assert.deepEqual(await readV31WithV3Fallback({ ...args, legacyManifestBytes: '{}'}),
    { source: 'v3', text: content }, '来源 V3 清单摘要不匹配时必须回退');
  assert.deepEqual(await readV31WithV3Fallback({ ...args, fetchPreview: async () => null }),
    { source: 'v3', text: content }, '新对象不存在时必须校验旧 V3 再回退');
  const incompatible = structuredClone(preview);
  incompatible.source.version = 'abcdef123456';
  assert.equal(validV31Manifest(incompatible), true);
  assert.deepEqual(await readV31WithV3Fallback({ ...args, previewManifest: incompatible }),
    { source: 'v3', text: content }, '不能跨数据版本组合新对象和旧版索引');
  assert.deepEqual(await readV31WithV3Fallback({ ...args, fetchPreview: async () => '损坏' }),
    { source: 'v3', text: content }, '新对象摘要错误不能进入索引');
  // 不再接受缺少 bytes 的历史清单，包括实验读取器的回退路径。
  const historical = structuredClone(legacy);
  for (const site of Object.values(historical.sites)) {
    for (const meta of Object.values(site.files)) delete meta.bytes;
  }
  delete historical.shared.dict.bytes;
  assert.equal(validV3Manifest(historical), false);
  assert.deepEqual(await readV31WithV3Fallback({ ...args,
    legacyManifest: historical, fetchPreview: async () => null }),
    null, '缺少 bytes 的历史清单不能作为回退数据');
  assert.deepEqual(await readV31WithV3Fallback({ ...args, fetchPreview: async () => { throw Error('offline'); } }),
    { source: 'v3', text: content }, '断网时必须能从可信旧 V3 副本恢复');
  assert.equal(await readV31WithV3Fallback({ ...args, fetchPreview: async () => '损坏',
    fetchLegacy: async () => '损坏' }), null, '新旧两份均损坏时必须失败关闭');

  const altered = structuredClone(preview);
  altered.sites.fc.files.names.url = '../evil.tsv';
  assert.equal(validV31Manifest(altered), false, '拒绝路径穿越');
  assert.deepEqual(await readV31WithV3Fallback({ ...args, previewManifest: altered }),
    { source: 'v3', text: content }, '新清单无效时只能使用已验证旧清单');
  const changed = structuredClone(preview);
  changed.sites.fc.files.names.sha256 = 'a'.repeat(64);
  assert.equal(validV31Manifest(changed), false, '对象路径不能脱离摘要');
  const extra = structuredClone(preview);
  extra.sites.fc.files.unexpected = extra.sites.fc.files.names;
  assert.equal(validV31Manifest(extra), false, '不能让未知资源绕过文件白名单');

  // 文件本身被篡改或旧对象遗失时，独立校验器必须明确失败。
  const sharedFile = path.join(previewDir, preview.sites.fc.files.names.url);
  const original = readFileSync(sharedFile);
  writeFileSync(sharedFile, '破坏文件');
  assert.throws(() => verifyV31Preview(oldDir, previewDir), /不一致|不匹配/);
  writeFileSync(sharedFile, original);
  assert.deepEqual(verifyV31Preview(oldDir, previewDir), stats);

  assert.throws(() => createV31Preview(oldDir, previewDir), /必须为空/,
    '禁止覆盖已生成的指纹对象集');
  assert.throws(() => createV31Preview(oldDir, path.join(repoRoot, 'site', 'v31-test')),
    /不得位于站点/, '预览构建必须在真实部署目录外');
  const alias = path.join(root, 'linked-output');
  symlinkSync(root, alias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => createV31Preview(oldDir, path.join(alias, 'preview')),
    /符号链接/, '父级符号链接不能绕过预览目录隔离');

  // 两代数据彼此隔离；新版本不应删除旧版本的离线回退资产。
  const nextDir = path.join(root, 'v3-next');
  const nextPreviewDir = path.join(root, 'preview-next');
  fixture(nextDir, 'fedcba654321', 'mirapri');
  createV31Preview(nextDir, nextPreviewDir);
  assert.deepEqual(verifyV31Preview(oldDir, previewDir), stats,
    '新版预览不能破坏已发布的上一代预览资源');
  assert.ok(verifyV31Preview(nextDir, nextPreviewDir).uniqueObjects >= stats.uniqueObjects);
  const retainedDir = path.join(root, 'retained-preview');
  const retained = createV31RetainedStore([previewDir, nextPreviewDir], retainedDir);
  assert.equal(retained.snapshots, 2);
  assert.equal(retained.archivedManifests, 2);
  const nextManifest = JSON.parse(readFileSync(path.join(nextPreviewDir, 'manifest.v31.json'), 'utf8'));
  const current = JSON.parse(readFileSync(path.join(retainedDir, 'manifest.v31.json'), 'utf8'));
  assert.deepEqual(current, nextManifest, '当前指针必须指向最新清单');
  const previousArchive = path.join(retainedDir, 'manifests',
    legacy.version + '-' + preview.source.manifestSha256.slice(0, 12) + '.json');
  assert.deepEqual(JSON.parse(readFileSync(previousArchive, 'utf8')), preview,
    '必须归档旧清单用于明确回滚');
  const oldName = preview.sites.mirapri.files.names;
  const newName = current.sites.mirapri.files.names;
  assert.notEqual(oldName.url, newName.url, '更新后的不可变对象应使用不同指纹路径');
  assert.equal(digest(readFileSync(path.join(retainedDir, oldName.url))), oldName.sha256,
    '发布新清单时不得移除仍被旧客户端引用的对象');
  assert.equal(digest(readFileSync(path.join(retainedDir, newName.url))), newName.sha256);
  assert.throws(() => createV31RetainedStore([previewDir, nextPreviewDir], retainedDir),
    /必须为空/, '禁止覆盖旧的保留式发布快照');
  console.log('✅ V3.1 隔离去重、完整性、V3 回退及跨版本旧对象保留通过');
} finally {
  rmSync(root, { recursive: true, force: true });
}
