// 共享候选必须以生产生成语义为依据，不得仅因文件类型相同便标记为重复。
import assert from 'node:assert/strict';
import { SHARED_CANDIDATE_GROUPS, checkSharedCandidates } from '../../tools/data/verify-shared-candidates.mjs';

const manifest = { sites: {} };
for (const [index, group] of SHARED_CANDIDATE_GROUPS.entries()) {
  for (const site of group.sites) {
    manifest.sites[site] ??= { files: {} };
    manifest.sites[site].files[group.type] = {
      url: site + '/' + group.type + '.tsv',
      sha256: (index + 1).toString(16).padStart(64, '0'),
      bytes: 100 + index,
    };
  }
}
const clone = () => structuredClone(manifest);
const result = checkSharedCandidates(manifest);
assert.equal(result.length, SHARED_CANDIDATE_GROUPS.length);
assert.deepEqual(result.map(group => group.type),
  SHARED_CANDIDATE_GROUPS.map(group => group.type));
for (const group of result) {
  assert.equal(group.reclaimableBytes, group.bytesPerCopy * (group.sites.length - 1));
}
for (const candidate of SHARED_CANDIDATE_GROUPS) {
  const altered = clone();
  const site = candidate.sites.at(-1);
  altered.sites[site].files[candidate.type].sha256 = 'f'.repeat(64);
  assert.throws(() => checkSharedCandidates(altered), /SHA 不同/,
    candidate.type + ' 文件摘要变化必须阻止共享');
}
{
  const altered = clone();
  altered.sites.collection.files.names.bytes += 1;
  assert.throws(() => checkSharedCandidates(altered), /字节长度不同/);
}
{
  const altered = clone();
  delete altered.sites.fc.files.hash;
  assert.throws(() => checkSharedCandidates(altered), /缺少共享候选资源/);
}
console.log('✅ 共享候选按文件类型、站点、SHA 与字节数校验，失败即拒绝');
