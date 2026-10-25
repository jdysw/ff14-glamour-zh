// 词典结构的纯契约，由数据发布器与浏览器运行时共享。
export { RUNTIME_DICT_LAYERS, validRuntimeDictionary };

const RUNTIME_DICT_LAYERS = Object.freeze(['common', 'main', 'ec', 'fc', 'ronka', 'acl', 'endcloset', 'miramiru']);
const ALLOWED_LAYERS = new Set(RUNTIME_DICT_LAYERS);
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// 只接收当前八层词典，缺层的历史缓存与数据包均不再加载。
function validRuntimeDictionary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const layers = Object.keys(value);
  if (layers.length !== RUNTIME_DICT_LAYERS.length) return false;
  for (const layer of layers) {
    if (!ALLOWED_LAYERS.has(layer)) return false;
    const entries = value[layer];
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return false;
    for (const [key, translation] of Object.entries(entries)) {
      // Object.assign 不能接受来自远程 JSON 的原型特殊键。
      if (FORBIDDEN_KEYS.has(key) || typeof translation !== 'string') return false;
    }
  }
  return RUNTIME_DICT_LAYERS.every(layer => Object.hasOwn(value, layer));
}
