import fs from 'node:fs';
const dir = new URL('.', import.meta.url);
const header = `// ==UserScript==
// @name         FF14 七站汉化覆盖审计 V1.1
// @namespace    https://github.com/jdysw/ff14-glamour-zh
// @version      1.2.0
// @description  汉化覆盖审计 + 自愿开启中文搜索事件、候选与请求诊断；仅本地导出，不上传。
// @match        https://mirapri.com/*
// @match        https://ffxiv.eorzeacollection.com/*
// @match        https://ff14-fc.com/*
// @match        https://lookbook.ronkacloset.com/*
// @match        https://www.ffxivcollection.com/*
// @match        https://weapon.ffxivcollection.com/*
// @match        https://end-closet.com/*
// @match        https://ff14.huijiwiki.com/*
// @noframes
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==
`;
const core=fs.readFileSync(new URL('audit-core.js',dir),'utf8');
const search=fs.readFileSync(new URL('search-diagnostics.js',dir),'utf8');
const runtime=fs.readFileSync(new URL('audit-runtime.js',dir),'utf8');
fs.writeFileSync(new URL('FF14-Coverage-Audit-V1.1.user.js',dir),header+'\n'+core+'\n'+search+'\n'+runtime,'utf8');
