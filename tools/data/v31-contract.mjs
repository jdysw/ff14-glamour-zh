// V3.1 内容寻址预览契约：仅服务隔离验证，不参与现有生产脚本构建。
// V3 的有效性与路径安全仍由原有 v3-contract 独立维护。
import { SITE_POLICIES } from '../../src/core/site-policy.js';
import { requiredV3Files } from '../../src/core/v3-contract.js';

export const V31_SCHEMA = 31;
export const V31_MAX_BYTES = 25 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/;
const EXTENSIONS = Object.freeze({
  names: 'tsv', hash: 'tsv', alias: 'tsv', dup: 'tsv',
  ecid: 'tsv', ko: 'tsv', series: 'txt', acl: 'txt', dict: 'json',
});
const plainObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (obj, keys) => plainObject(obj)
  && Object.keys(obj).length === keys.length
  && keys.every(key => Object.hasOwn(obj, key));

export function v31ObjectUrl(sha256, extension) {
  if (typeof sha256 !== 'string' || !SHA256.test(sha256)
    || !['tsv', 'txt', 'json'].includes(extension)) return null;
  return 'objects/' + sha256.slice(0, 2) + '/' + sha256 + '.' + extension;
}

export function v31FileMeta(legacyMeta, name) {
  const ext = EXTENSIONS[name];
  const url = ext && v31ObjectUrl(legacyMeta?.sha256, ext);
  if (!url || !Number.isSafeInteger(legacyMeta?.bytes)
    || legacyMeta.bytes < 0 || legacyMeta.bytes > V31_MAX_BYTES) return null;
  return { url, sha256: legacyMeta.sha256, bytes: legacyMeta.bytes };
}

function validV31FileMeta(meta, name) {
  if (!exactKeys(meta, ['url', 'sha256', 'bytes'])) return false;
  const expected = v31FileMeta(meta, name);
  return !!expected && meta.url === expected.url;
}

export function validV31Manifest(manifest) {
  if (!exactKeys(manifest, ['schema', 'source', 'sites', 'shared'])
    || manifest.schema !== V31_SCHEMA
    || !exactKeys(manifest.source, ['version', 'manifestSha256'])
    || !/^[a-f0-9]{12}$/.test(manifest.source.version)
    || !SHA256.test(manifest.source.manifestSha256)
    || !plainObject(manifest.sites)) return false;
  const siteNames = SITE_POLICIES.map(site => site.id);
  if (!exactKeys(manifest.sites, siteNames)) return false;
  for (const site of SITE_POLICIES) {
    const entry = manifest.sites[site.id];
    const expected = requiredV3Files(site);
    if (!exactKeys(entry, ['files']) || !exactKeys(entry.files, expected)) return false;
    if (!expected.every(name => validV31FileMeta(entry.files[name], name))) return false;
  }
  return exactKeys(manifest.shared, ['dict'])
    && validV31FileMeta(manifest.shared.dict, 'dict');
}

export function v31GetFile(manifest, siteId, name) {
  if (!validV31Manifest(manifest)) return null;
  if (name === 'dict') return manifest.shared.dict;
  return manifest.sites[siteId]?.files?.[name] ?? null;
}
