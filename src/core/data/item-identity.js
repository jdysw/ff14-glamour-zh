const LANGUAGES = new Set(['en', 'ja', 'ko']);

// The legacy V3 projections are reconstructed in their original language/row order.
export function parseItemIds(text) {
  if (typeof text !== 'string') return null;
  const lines = text.split('\n');
  const languages = lines.shift().split('\t');
  if (!languages.every(lang => LANGUAGES.has(lang)) || new Set(languages).size !== languages.length) return null;
  const rows = [];
  const ids = new Set();
  for (const line of lines) {
    if (!line) continue;
    const fields = line.split('\t');
    const [id, zh] = fields;
    const [glam, slot] = fields.slice(-2);
    if (fields.length !== languages.length + 4 || !/^(?:\d+|-)$/.test(id)
      || !zh || !/^[01]$/.test(glam) || !/^[0-5]$/.test(slot)) return null;
    const itemId = id === '-' ? null : Number(id);
    if (itemId !== null && (!Number.isSafeInteger(itemId) || itemId < 1 || ids.has(itemId))) return null;
    if (itemId !== null) ids.add(itemId);
    rows.push({ id: itemId, zh,
      names: Object.fromEntries(languages.map((lang, index) => [lang, fields[index + 2]])),
      glam, slot: Number(slot) });
  }
  if (!rows.length) return null;
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
    if (lang === 'en') for (const row of rows) {
      const native = row.names.en;
      if (native.endsWith(' Dye') && !nativeNames.has(native.slice(0, -4))) put(native.slice(0, -4), row, 5);
    }
  }
  return { names, glam, slots, rows };
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
      if (row.zh.endsWith('染剂') && name) {
        const color = lang === 'en' && name.endsWith(' Dye') ? name.slice(0, -4)
          : /^(?:カララント|염료)[:：]\s*(.+)$/u.exec(name)?.[1];
        if (color && color !== name) {
          add(lang, color, row);
          const compact = color.replace(/\s+/gu, '');
          if (lang === 'ko' && compact !== color) add(lang, compact, row);
        }
      }
    }
  }
  return { byId, byLanguage };
}
