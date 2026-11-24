import { webcrypto } from 'node:crypto';
import { DATA_BASE_V3 } from '../../src/core/constants.js';

let worldId = 0;

// Tests in one process activate only one GM world at a time. Finish a world's
// background requests before activating the next one.
export async function makeV3Runtime({
  download = async () => { throw new Error('network unavailable'); },
  store = new Map(),
  site = 'mirapri',
  tables,
  cryptoProvider = webcrypto,
  listValues = () => [...store.keys()],
  writeValue = (key, value) => { store.set(key, value); },
} = {}) {
  const requests = [];
  const writes = [];
  const deletes = [];
  const errors = [];
  function activate() {
    globalThis.window = { __zhxTestSite: site, __zhxTestTables: tables, __zhxErrs: errors };
    Object.defineProperty(globalThis, 'crypto', { configurable: true, writable: true, value: cryptoProvider });
    globalThis.GM_getValue = (key, fallback) => store.get(key) ?? fallback;
    globalThis.GM_setValue = (key, value) => { writes.push(key); return writeValue(key, value); };
    globalThis.GM_listValues = listValues;
    globalThis.GM_deleteValue = key => { deletes.push(key); store.delete(key); };
    globalThis.GM_xmlhttpRequest = ({url, headers, timeout, onload, onerror}) => {
      const normalized = new URL(url);
      const refresh = normalized.searchParams.get('_zhx_refresh');
      normalized.searchParams.delete('_zhx_refresh');
      const path = normalized.href.slice(DATA_BASE_V3.length);
      requests.push({ path, refresh, headers, timeout });
      Promise.resolve().then(() => download(normalized.href)).then(
        responseText => onload({ status: 200, responseText }), onerror,
      );
    };
  }
  activate();
  const api = await import('../../src/core/data/data-manager.js?v3-world=' + ++worldId);
  return { api, store, requests, writes, deletes, errors, activate };
}
