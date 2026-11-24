import config from './site-config.json' with { type: 'json' };
export { SITE_POLICIES, DATA_POLICIES, V3_FILE_TYPES, findSitePolicy, neededTables, _siteIndexes, onHost };

// 与发布顺序独立：保持客户端原有的 V3 文件读取顺序。
const V3_FILE_TYPES = Object.freeze(config.fileTypes);
const INDEX_FILES = { nameMap: 'names', itemHash: 'hash', ecidMap: 'ecid', koByZh: 'ko' };
const SITE_POLICIES = Object.freeze(config.sites.map(({ id, hosts, dataSite }) => {
  const files = Object.freeze(Object.keys(V3_FILE_TYPES).filter(name => config.datasets[dataSite ?? id].files.includes(name)));
  const tables = ['items', ...['series', 'acl'].filter(name => files.includes(name)), 'dict'];
  const indexes = Object.keys(INDEX_FILES).filter(index => files.includes(INDEX_FILES[index]));
  return { id, hosts, ...(dataSite ? { dataSite } : {}), tables, indexes, files };
}));
const DATA_POLICIES = Object.freeze(SITE_POLICIES.filter(site => !site.dataSite));

// 必须精确匹配主域或子域，不能让 evilmirapri.com 绕过宿主限制。
const onHost = (host, domain) => host === domain || host.endsWith('.' + domain);

// __zhxTestSite 与原站点注册表保持一致，仅供集成测试明确指定站点。
function findSitePolicy() {
  const forced = window.__zhxTestSite;
  if (forced) {
    const selected = SITE_POLICIES.find(policy => policy.id === forced);
    if (selected) return selected;
  }
  const host = typeof location === 'undefined' ? '' : location.hostname || '';
  return SITE_POLICIES.find(policy => policy.hosts.some(domain => onHost(host, domain))) || null;
}

function neededTables() {
  if (window.__zhxTestTables) return window.__zhxTestTables;
  return findSitePolicy()?.tables || [];
}

function _siteIndexes() {
  if (window.__zhxTestIndexes) return window.__zhxTestIndexes;
  return findSitePolicy()?.indexes || null;
}
