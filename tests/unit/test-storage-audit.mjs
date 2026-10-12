// 使用真实发布契约构造七站产物，确保基准结果不会误算字节与重复率。
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { SITE_POLICIES } from '../../src/core/site-policy.js';
import { RUNTIME_DICT_LAYERS } from '../../src/core/dict-contract.js';
import { requiredV3Files } from '../../src/core/v3-contract.js';
import { auditStorage } from '../../tools/data/audit-storage.mjs';

const directory = mkdtempSync(path.join(os.tmpdir(), 'zhx-storage-audit-'));
const digest = value => createHash('sha256').update(value).digest('hex');
try {
  const sites = {};
  let physicalFileCount = 0;
  for (const policy of SITE_POLICIES) {
    const files = {};
    for (const name of requiredV3Files(policy)) {
      const suffix = name === 'series' || name === 'acl' ? 'txt' : 'tsv';
      const relative = policy.id + '/' + name + '.' + suffix;
      // alias 跨站一致，其余类型构造不同内容，以检测精确 SHA 去重。
      const data = name === 'alias' ? '共通别名\\t译文\\n' : policy.id + '/' + name + '\\t译文\\n';
      const bytes = Buffer.from(data.replaceAll('\\t', '\t').replaceAll('\\n', '\n'), 'utf8');
      mkdirSync(path.dirname(path.join(directory, relative)), { recursive: true });
      writeFileSync(path.join(directory, relative), bytes);
      files[name] = { url: relative, bytes: bytes.length, sha256: digest(bytes) };
      physicalFileCount++;
    }
    sites[policy.id] = { files };
  }
  const dictionary = Object.fromEntries(RUNTIME_DICT_LAYERS.map(layer => [layer, {}]));
  const dict = Buffer.from(JSON.stringify(dictionary), 'utf8');
  writeFileSync(path.join(directory, 'dict.json'), dict);
  const manifest = {
    schema: 3, candidatePolicy: 1, version: '123456abcdef',
    sites, shared: { dict: { url: 'dict.json', bytes: dict.length, sha256: digest(dict) } },
  };
  writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
  const report = auditStorage(directory);
  assert.equal(report.total.files, physicalFileCount + 1);
  // 根据真实站点策略派生预期：Wiki 等站点可能不需要 alias，不能硬编码七份。
  const aliasSites = SITE_POLICIES.filter(policy => requiredV3Files(policy).includes('alias'));
  assert.ok(aliasSites.length > 1, '测试夹具必须具有跨站重复资源');
  assert.equal(report.total.files - report.total.uniqueBlobs, aliasSites.length - 1,
    '重复内容计数必须与站点声明的文件需求相符');
  assert.equal(report.duplicates.length, 1);
  assert.equal(report.duplicates[0].copies, aliasSites.length);
  assert.deepEqual(report.duplicates[0].paths.sort(),
    aliasSites.map(policy => policy.id + '/alias.tsv').sort());
  assert.equal(report.duplicates[0].reclaimableBytes,
    report.duplicates[0].bytesPerCopy * (aliasSites.length - 1));
  assert.equal(report.total.rawBytes - report.total.uniqueRawBytes,
    report.total.duplicateRawBytes);
  assert.ok(report.total.brotliBytes > 0 && report.total.gzipBytes > 0);
  assert.deepEqual(report, auditStorage(directory), '相同输入应生成完全确定的基准');
  console.log('✅ V3 七站文件存储基准、重复字节与结果可复现性通过');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
