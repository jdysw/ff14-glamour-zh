#!/usr/bin/env node
// Build a separate EC-only Tampermonkey preview from this branch's actual Rollup bundle.
// The body is not rewritten: only userscript metadata is scoped for testing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = path.resolve('dist/ff14-glamour-zh.greasyfork.user.js');
const target = path.resolve('preview/ff14-glamour-zh-pr44-ec-test.user.js');
const original = fs.readFileSync(source, 'utf8');
const endMarker = '// ==/UserScript==';
assert.ok(original.startsWith('// ==UserScript==\n'), 'Expected Rollup userscript header');
const end = original.indexOf(endMarker);
assert.ok(end > 0 && original.indexOf(endMarker, end + 1) === -1, 'Expected exactly one metadata header');
const initialHeader = original.slice(0, end + endMarker.length);
const body = original.slice(end + endMarker.length);
const branch = 'feat/ec-gearsets-auto-translate-143';
const root = 'https://raw.githubusercontent.com/jdysw/ff14-glamour-zh/' + branch;
const rawLink = root + '/preview/ff14-glamour-zh-pr44-ec-test.user.js';
const run = Number(process.env.GITHUB_RUN_NUMBER || 1);
assert.ok(Number.isSafeInteger(run) && run > 0, 'Invalid workflow run number');
const version = '1.4.3.44.' + (7 + run);
const sha = process.env.GITHUB_SHA || 'local-build';
function replaceLine(header, key, content) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('^// @' + escaped + '[ \\t]+.*$', 'm');
  assert.ok(re.test(header), 'Missing @' + key);
  return header.replace(re, '// @' + key.padEnd(12) + ' ' + content);
}
let header = initialHeader;
header = replaceLine(header, 'name', 'FF14 幻化站中文化 · PR44 EC 测试版');
header = replaceLine(header, 'namespace', 'https://github.com/jdysw/ff14-glamour-zh/preview/pr44');
header = replaceLine(header, 'version', version);
header = replaceLine(header, 'description',
  'PR44 最新代码 EC 测试版：套装与饰品汉化、中文智能搜索、鸟甲/面饰、各装备部位筛选。测试前禁用正式版及旧测试版。');
const matches = header.match(/^\/\/ @match[ \\t]+.*$/gm) || [];
assert.ok(matches.some(line => /^\/\/ @match[ \t]+https:\/\/ffxiv\.eorzeacollection\.com\/\*$/.test(line)),
  'Original bundle must explicitly match the exact EC hostname and path');
header = header.replace(/^\/\/ @match[ \\t]+.*(?:\n|$)/gm, '');
header = header.replace('// @run-at', [
  '// @match        https://ffxiv.eorzeacollection.com/*',
  '// @downloadURL  ' + rawLink,
  '// @updateURL    ' + rawLink,
  '// @tag          PR44-TEST-ONLY',
  '// @run-at',
].join('\n'));
assert.equal((header.match(/^\/\/ @match/gm) || []).length, 1, 'Preview must target EC only');
assert.ok(header.includes('GM_xmlhttpRequest') && header.includes('@connect'), 'Required permissions missing');
assert.ok(body.includes('(function ()') && body.includes("'use strict'"), 'Expected original Rollup IIFE body');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, header + '\n\n// PR44 source commit: ' + sha + '\n' + body);
console.log('EC preview: ' + target + '; version=' + version + '; source=' + sha);
