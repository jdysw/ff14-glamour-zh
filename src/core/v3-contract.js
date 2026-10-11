/* @phase15-module-order:core/v3-contract */
// V3 文件路径、元数据与站点需求的纯契约：不读取网络、存储或 DOM。
import { SITE_POLICIES } from './site-policy.js';
export { requiredV3Files, validV3FileMeta, validV3Manifest };

// 允许的文件类型必须与 Python 生成器 build/make-runtime-data.py 一致。
const V3_FILE_TYPES = Object.freeze({
  names: 'tsv', hash: 'tsv', alias: 'tsv', dup: 'tsv',
  ecid: 'tsv', ko: 'tsv', series: 'txt', acl: 'txt',
});
const MAX_V3_FILE_BYTES = 64 * 1024 * 1024;

function requiredV3Files(site) {
  const required = [];
  if (site?.indexes?.includes('nameMap')) required.push('names', 'alias', 'dup');
  if (site?.indexes?.includes('itemHash')) required.push('hash');
  if (site?.indexes?.includes('ecidMap')) required.push('ecid');
  if (site?.indexes?.includes('koByZh')) required.push('ko');
  if (site?.tables?.includes('series')) required.push('series');
  if (site?.tables?.includes('acl')) required.push('acl');
  return required;
}

// URL 必须是生成器输出的精确站点相对路径，禁止目录回退、查询参数和额外文件。
function validV3FileMeta(meta, expectedUrl) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
  if (meta.url !== expectedUrl || !/^[a-f0-9]{64}$/i.test(meta.sha256 || '')) return false;
  return meta.bytes === undefined || (Number.isSafeInteger(meta.bytes)
    && meta.bytes >= 0 && meta.bytes <= MAX_V3_FILE_BYTES);
}

function validV3Manifest(man) {
  if (man?.schema !== 3 || ![0, 1].includes(man.candidatePolicy)
    || !man.sites || typeof man.sites !== 'object' || Array.isArray(man.sites)) return false;
  const allowed = new Map(SITE_POLICIES.map(site => [site.id, site]));
  const sites = Object.entries(man.sites);
  if (!sites.length) return false;
  for (const [siteId, entry] of sites) {
    const site = allowed.get(siteId);
    if (!site || !entry?.files || typeof entry.files !== 'object'
      || Array.isArray(entry.files)) return false;
    const files = Object.entries(entry.files);
    if (!files.length) return false;
    for (const [name, meta] of files) {
      const extension = V3_FILE_TYPES[name];
      if (!extension || !validV3FileMeta(meta, siteId + '/' + name + '.' + extension)) return false;
    }
  }
  if (man.shared?.dict && !validV3FileMeta(man.shared.dict, 'dict.json')) return false;
  return true;
}
