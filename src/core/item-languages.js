import { dataGetIndex, dataGetStatus, resolveKo } from './data/data-manager.js';
import { cacheRegister } from './cache-primitives.js';

let revision = '';
let names = new Map();
cacheRegister('itemLanguages', 'derived', () => { revision = ''; names.clear(); }, () => names.size);
export function itemNames(zh) {
  const status = dataGetStatus();
  const next = status.generation + ':' + status.version;
  if (revision !== next) {
    revision = next;
    names = new Map();
    for (const [native, chinese] of Object.entries(dataGetIndex('nameMap') || {})) {
      const language = /[가-힣]/u.test(native) ? 'ko' : /[ぁ-ヺ\u3400-\u9fff]/u.test(native) ? 'ja' : 'en';
      let entry = names.get(chinese);
      if (!entry) { entry = {}; names.set(chinese, entry); }
      entry[language] ??= native;
    }
  }
  const entry = { ...(names.get(zh) || {}) };
  entry.ko ||= resolveKo(zh) || undefined;
  return entry;
}

export function miramiruLanguage() {
  const language = /^\/(en|ko)(?:\/|$)/.exec(location.pathname)?.[1]
    || document.documentElement.lang.split('-')[0];
  return ['en', 'ko'].includes(language) ? language : 'ja';
}
