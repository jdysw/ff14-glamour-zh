// The template owns static metadata; site-config.json owns match scope.
import fs from 'node:fs';
import config from '../../src/core/site-config.json' with { type: 'json' };

const template = new URL('./userscript-header.txt', import.meta.url);
const marker = '// @site-matches';

export function siteMatchLines(sites = config.sites) {
  return sites.flatMap(site => site.matches.map(match => '// @match        ' + match));
}

export function renderUserscriptHeader(source = fs.readFileSync(template, 'utf8')) {
  const parts = source.split(marker);
  if (parts.length !== 2) throw new Error('Userscript header must have one @site-matches marker');
  const lineEnd = source.includes('\r\n') ? '\r\n' : '\n';
  return parts[0] + siteMatchLines().join(lineEnd) + parts[1];
}
