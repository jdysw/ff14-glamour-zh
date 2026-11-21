import { storeGetAsync, storeSetAsync } from './data/storage.js';

const SETTINGS_KEY = 'zhx.wiki.reading';

export const WIKI_READING_OPTIONS = Object.freeze({
  quotes: '直角引号',
  indent: '正文首行缩进',
  proseLists: '剧情列表转段落',
});

function normalize(options) {
  return Object.fromEntries(Object.keys(WIKI_READING_OPTIONS).map(key => [key, options?.[key] !== false]));
}

export async function readWikiReadingSettings() {
  const saved = await storeGetAsync(SETTINGS_KEY);
  try { return normalize(JSON.parse(saved)); }
  catch { return normalize(null); }
}

export function saveWikiReadingSettings(options) {
  return storeSetAsync(SETTINGS_KEY, JSON.stringify(normalize(options)));
}
