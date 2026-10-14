// Small companion installation for testing fonts alongside an existing release.
// Uses the actual shared implementation and requests no remote data or fonts.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ensureChineseFont} from '../src/core/dom.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const matches=fs.readFileSync(path.join(root,'build/userscript-header.txt'),'utf8').split(/\r?\n/).filter(line=>line.startsWith('// @match '));
if(!matches.length)throw new Error('No supported sites in userscript header');
const source=`// ==UserScript==
// @name         FF14 中文字体统一 · 测试版
// @namespace    https://github.com/jdysw/ff14-glamour-zh/font-test
// @version      ${version}
// @description  所有支持站点优先使用简体中文字体。仅调整字体，可与现有汉化脚本并用；不请求数据或字体，不修改缓存。
${matches.join('\n')}
// @run-at       document-idle
// @noframes
// @grant        none
// ==/UserScript==
(${ensureChineseFont.toString()})();
`;
const file=path.join(root,'dist',`ff14-chinese-font-${version}-test.user.js`);
fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,source);
console.log('Font companion userscript: '+file);
