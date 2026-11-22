const LANGUAGES = new Set(['en', 'ja', 'ko']);

function parseItemRow(line, languages, ids) {
  const fields = line.split('\t');
  const [id, zh] = fields;
  const [glam, slot] = fields.slice(-2);
  if (fields.length !== languages.length + 4 || !/^(?:\d+|-)$/.test(id)
    || !zh || !/^[01]$/.test(glam) || !/^[0-5]$/.test(slot)) return null;
  const itemId = id === '-' ? null : Number(id);
  if (itemId !== null && (!Number.isSafeInteger(itemId) || itemId < 1 || ids.has(itemId))) return null;
  if (itemId !== null) ids.add(itemId);
  return { id: itemId, zh, names: Object.fromEntries(languages.map((lang, index) => [lang, fields[index + 2]])),
    glam, slot: Number(slot) };
}

function parseItemRows(lines, languages) {
  const rows = [];
  const ids = new Set();
  for (const line of lines) {
    if (!line) continue;
    const row = parseItemRow(line, languages, ids);
    if (!row) return null;
    rows.push(row);
  }
  return rows;
}

function addEnglishDyeAliases(rows, nativeNames, put) {
  for (const row of rows) {
    const native = row.names.en;
    if (!native.endsWith(' Dye')) continue;
    const color = native.slice(0, -4);
    if (!nativeNames.has(color)) put(color, row, 5);
  }
}

// Preserve the original language and row order of the legacy V3 projection.
function projectItemRows(rows, languages) {
  const names = Object.create(null), glam = Object.create(null), slots = Object.create(null);
  const put = (native, row, slot) => {
    if (!native || Object.hasOwn(names, native)) return;
    names[native] = row.zh;
    glam[native] = row.glam;
    slots[native] = slot;
  };
  for (const lang of languages) {
    const nativeNames = new Set();
    for (const row of rows) {
      const native = row.names[lang];
      if (native) nativeNames.add(native);
      put(native, row, row.slot);
    }
    if (lang === 'en') addEnglishDyeAliases(rows, nativeNames, put);
  }
  return { names, glam, slots, rows };
}

export function parseItemIds(text) {
  if (typeof text !== 'string') return null;
  const lines = text.split('\n');
  const languages = lines.shift().split('\t');
  if (!languages.every(lang => LANGUAGES.has(lang)) || new Set(languages).size !== languages.length) return null;
  const rows = parseItemRows(lines, languages);
  return rows?.length ? projectItemRows(rows, languages) : null;
}

export function dyeColorName(native) {
  const prefix = /^(?:カララント|염료)[:：]/u.exec(native)?.[0];
  if (prefix) return native.slice(prefix.length).trimStart();
  return native.endsWith(' Dye') ? native.slice(0, -4) : '';
}

function addDyeColorNames(add, lang, name, row) {
  if (!name || !row.zh.endsWith('染剂')) return;
  const color = dyeColorName(name);
  if (!color || color === name) return;
  add(lang, color, row);
  const compact = color.replace(/\s+/gu, '');
  if (lang === 'ko' && compact !== color) add(lang, compact, row);
}

// Index game identities separately from the compatibility projection so names can be ambiguous.
export function indexItemIds(rows) {
  const byId = new Map();
  const byLanguage = new Map(['zh', ...LANGUAGES].map(lang => [lang, new Map()]));
  function add(lang, name, row) {
    if (!name) return;
    const map = byLanguage.get(lang);
    const entries = map.get(name);
    if (entries) entries.push(row);
    else map.set(name, [row]);
  }
  for (const row of rows) {
    if (row.id === null) continue;
    byId.set(row.id, row);
    add('zh', row.zh, row);
    for (const [lang, name] of Object.entries(row.names)) {
      add(lang, name, row);
      addDyeColorNames(add, lang, name, row);
    }
  }
  return { byId, byLanguage };
}
