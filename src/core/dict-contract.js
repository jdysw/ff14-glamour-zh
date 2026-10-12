/* @phase15-module-order:core/dict-contract */
// 词典结构的纯契约，由数据发布器与浏览器运行时共享。
export { RUNTIME_DICT_LAYERS, validRuntimeDictionary };

const RUNTIME_DICT_LAYERS = Object.freeze(['common', 'main', 'ec', 'fc', 'ronka', 'acl', 'endcloset']);
const ALLOWED_LAYERS = new Set(RUNTIME_DICT_LAYERS);
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// 历史缓存允许仅包含部分层；新发布的数据包必须提供完整七层。
function validRuntimeDictionary(value, requireAll = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const layers = Object.keys(value);
  if (!layers.length || (requireAll && layers.length !== RUNTIME_DICT_LAYERS.length)) return false;
  for (const layer of layers) {
    if (!ALLOWED_LAYERS.has(layer)) return false;
    const entries = value[layer];
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return false;
    for (const [key, translation] of Object.entries(entries)) {
      // Object.assign 不能接受来自远程 JSON 的原型特殊键。
      if (FORBIDDEN_KEYS.has(key) || typeof translation !== 'string') return false;
    }
  }
  return !requireAll || RUNTIME_DICT_LAYERS.every(layer => Object.hasOwn(value, layer));
}
