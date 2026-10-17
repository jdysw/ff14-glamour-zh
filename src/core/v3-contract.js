/* @phase15-module-order:core/v3-contract */
// V3 文件路径、元数据与站点需求的纯契约：不读取网络、存储或 DOM。
import { DATA_POLICIES } from './site-policy.js';
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
  return Number.isSafeInteger(meta.bytes)
    && meta.bytes >= 0 && meta.bytes <= MAX_V3_FILE_BYTES;
}

// 单站只允许生成器约定的全部文件，不能增删或替换为其他文件类型。
function validV3SiteFiles(siteId, entry, policy) {
  if (!entry?.files || typeof entry.files !== 'object' || Array.isArray(entry.files)) return false;
  const required = new Set(requiredV3Files(policy));
  const files = Object.entries(entry.files);
  if (files.length !== required.size) return false;
  return files.every(([name, meta]) => {
    const extension = V3_FILE_TYPES[name];
    return required.has(name) && !!extension
      && validV3FileMeta(meta, siteId + '/' + name + '.' + extension);
  });
}

// 当前清单必须声明唯一共享词典及完整文件元数据。
function validV3Shared(shared) {
  if (!shared || typeof shared !== 'object' || Array.isArray(shared)) return false;
  const keys = Object.keys(shared);
  return keys.length === 1 && keys[0] === 'dict'
    && validV3FileMeta(shared.dict, 'dict.json');
}

function validV3Manifest(man) {
  if (man?.schema !== 3 || man.candidatePolicy !== 1
    || !man.sites || typeof man.sites !== 'object' || Array.isArray(man.sites)) return false;
  const policies = new Map(DATA_POLICIES.map(site => [site.id, site]));
  const entries = Object.entries(man.sites);
  if (!entries.length) return false;
  return entries.every(([siteId, entry]) => {
    const policy = policies.get(siteId);
    return !!policy && validV3SiteFiles(siteId, entry, policy);
  }) && validV3Shared(man.shared);
}
