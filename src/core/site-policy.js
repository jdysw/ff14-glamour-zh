/* @phase15-module-order:core/site-policy */
export { SITE_POLICIES, DATA_POLICIES, findSitePolicy, neededTables, _siteIndexes, onHost };
// 站点数据需求与宿主匹配属于纯配置，不依赖翻译器、数据加载器或 DOM 适配器。
// 数据层通过本模块查询当前站点，避免反向引入启动适配器而形成循环依赖。
/* @zhixia:site-policy-start */
const SITE_POLICIES = Object.freeze([
  { id: 'mirapri', hosts: ['mirapri.com'], tables: ['items', 'dict'], indexes: ['nameMap', 'itemHash'] },
  { id: 'ec', hosts: ['eorzeacollection.com'], tables: ['items', 'dict'], indexes: ['nameMap', 'itemHash'] },
  { id: 'wiki', hosts: ['huijiwiki.com'], tables: ['items', 'dict'], indexes: ['ecidMap', 'koByZh'] },
  { id: 'fc', hosts: ['ff14-fc.com'], tables: ['items', 'series', 'dict'], indexes: ['nameMap', 'itemHash'] },
  { id: 'ronka', hosts: ['ronkacloset.com'], tables: ['items', 'dict'], indexes: ['nameMap'] },
  { id: 'collection', hosts: ['ffxivcollection.com'], tables: ['items', 'series', 'acl', 'dict'], indexes: ['nameMap'] },
  { id: 'endcloset', hosts: ['end-closet.com'], tables: ['items', 'dict'], indexes: ['nameMap'] },
  { id: 'miramiru', hosts: ['miramiru.co'], tables: ['items', 'dict'], indexes: ['nameMap', 'itemHash'] },
  { id: 'eden', hosts: ['mirapri.ff14eden.work'], dataSite: 'miramiru', tables: ['items', 'dict'], indexes: ['nameMap', 'itemHash'] },
]);
// Eden 的制作器使用多语装备名，复用 Miramiru 的现有多语索引与缓存。
// 应用站点与发布数据集分开，新增界面适配无需新增重复数据或改变现行清单。
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
/* @zhixia:site-policy-end */

