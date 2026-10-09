// Storage wrappers cover classic synchronous GM APIs and Promise-based GM APIs.
import { readDist } from '../helpers/paths.mjs';

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
};
const eq = (name, actual, expected) => ok(name, actual === expected,
  'actual=' + JSON.stringify(actual) + ' expected=' + JSON.stringify(expected));

function slices(source, tag) {
  const a = '/* @zhixia:' + tag + '-start */';
  const b = '/* @zhixia:' + tag + '-end */';
  const out = [];
  let from = 0;
  while (true) {
    const i = source.indexOf(a, from);
    if (i < 0) break;
    const j = source.indexOf(b, i + a.length);
    if (j < 0) throw new Error('unclosed marker: ' + tag);
    out.push(source.slice(i, j + b.length));
    from = j + b.length;
  }
  return out;
}

const names = ['GM_getValue', 'GM_setValue', 'GM_listValues', 'GM_deleteValue', 'GM'];
function makeWorld(values) {
  const body = slices(readDist(), 'core-storage').join('\n');
  const ret = 'return { storeGetAsync, storeSetAsync, storeListAsync, storeDeleteAsync, storeSet };';
  return new Function(...names, body + '\n' + ret)(...names.map((n) => values[n]));
}

{
  const data = Object.create(null);
  const api = makeWorld({
    GM_getValue: (k, d) => data[k] === undefined ? d : data[k],
    GM_setValue: (k, v) => { data[k] = v; },
    GM_listValues: () => Object.keys(data),
    GM_deleteValue: (k) => { delete data[k]; },
  });
  eq('classic set persists', await api.storeSetAsync('x', '1'), true);
  eq('classic get reads', await api.storeGetAsync('x'), '1');
  eq('classic list enumerates', JSON.stringify(await api.storeListAsync()), JSON.stringify(['x']));
  eq('classic delete removes', await api.storeDeleteAsync('x'), true);
  eq('classic delete is visible', await api.storeGetAsync('x'), null);
}

{
  const data = Object.create(null);
  const api = makeWorld({
    GM: {
      getValue: async (k, d) => data[k] === undefined ? d : data[k],
      setValue: async (k, v) => { data[k] = v; },
      listValues: async () => Object.keys(data),
      deleteValue: async (k) => { delete data[k]; },
    },
  });
  eq('Promise GM set persists', await api.storeSetAsync('y', '2'), true);
  eq('Promise GM get reads', await api.storeGetAsync('y'), '2');
  eq('Promise GM list enumerates', JSON.stringify(await api.storeListAsync()), JSON.stringify(['y']));
  eq('Promise GM delete removes', await api.storeDeleteAsync('y'), true);
  eq('Promise GM delete is visible', await api.storeGetAsync('y'), null);
}

{
  const data = Object.create(null);
  const api = makeWorld({
    GM_getValue: (k, d) => data[k] === undefined ? d : data[k],
    GM_setValue: (k, v) => { data[k] = v; },
  });
  await api.storeSetAsync('legacy', 'old');
  eq('missing list API is explicit', await api.storeListAsync(), null);
  eq('missing delete API invalidates via empty value', await api.storeDeleteAsync('legacy'), true);
  eq('empty fallback is visible', await api.storeGetAsync('legacy'), '');
}

{
  const api = makeWorld({ GM: {
    setValue: async () => { throw new Error('write failed'); },
    listValues: async () => { throw new Error('list failed'); },
    deleteValue: async () => { throw new Error('delete failed'); },
  } });
  eq('rejected Promise write is reported', await api.storeSetAsync('bad', 'x'), false);
  eq('rejected Promise listing is reported', await api.storeListAsync(), null);
  eq('failed delete fallback stays failed', await api.storeDeleteAsync('bad'), false);
}

console.log('storage tests: ' + pass + '/' + (pass + fail) + ' passed');
process.exit(fail ? 1 : 0);
