#!/usr/bin/env node
// 模拟器：在真实 dump HTML 上跑引擎的 translate 逻辑，输出未翻译残余
// 用法: node test/sim.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RONKA = '/tmp/ronka';

// ---- 注入数据 ----
globalThis.__UI__ = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ui_map.json'), 'utf-8'));
globalThis.__ITEMS__ = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/item_map.json'), 'utf-8'));
globalThis.__STAINS__ = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/stain_final.json'), 'utf-8'));
globalThis.__UI_LONG__ = fs.existsSync(path.join(ROOT, 'data/ui_long.json'))
  ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ui_long.json'), 'utf-8')) : {};

// ---- DOM 桩 ----
globalThis.document = {
  body: null,
  addEventListener() {},
  createTreeWalker() { return { nextNode: () => null }; },
  querySelectorAll() { return []; },
};
globalThis.window = globalThis;
globalThis.MutationObserver = class { observe() {} };
globalThis.NodeFilter = { SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 };

await import(path.join(ROOT, 'src/engine.js'));
const { translate } = globalThis.__ZHX_RONKA__;

// ---- 提取 dump 中的文本 ----
const files = process.argv.slice(2);
const defaultFiles = ['dom_home.html', 'dom_detail.html', 'dom_search_after_filter.html',
  'dom_editor.html', 'dom_editor_click2.html', 'dom_login_modal2.html', 'dom_home_full.html', 'about.html'];
const list = files.length ? files : defaultFiles;

const KR = /[\uac00-\ud7a3]/;
const residue = new Map(); // text -> [files]
let total = 0, done = 0;

for (const f of list) {
  const fp = f.startsWith('/') ? f : path.join(RONKA, f);
  if (!fs.existsSync(fp)) continue;
  let html = fs.readFileSync(fp, 'utf-8');
  // 大小写不敏感 + 循环删到不动点；未闭合标签一并删除（CodeQL 完整清理模式）
  let _prevHtml;
  do {
    _prevHtml = html;
    html = html.replace(/<script\b[\s\S]*?(?:<\/script\s*>|$)/gi, '').replace(/<style\b[\s\S]*?(?:<\/style\s*>|$)/gi, '');
  } while (html !== _prevHtml);
  // 文本节点
  const texts = new Set();
  for (const m of html.matchAll(/>([^<>]+)</g)) {
    const t = m[1].trim();
    if (t && KR.test(t)) texts.add(t);
  }
  // 属性
  for (const m of html.matchAll(/(?:placeholder|alt|title)="([^"]+)"/g)) {
    const t = m[1].trim();
    if (t && KR.test(t)) texts.add(t);
  }
  for (const t of texts) {
    total++;
    const tr = translate(t);
    if (tr !== null) { done++; continue; }
    if (!residue.has(t)) residue.set(t, []);
    const arr = residue.get(t);
    if (!arr.includes(f)) arr.push(f);
  }
}

console.log(`=== 模拟结果 ===`);
console.log(`文本节点总数(KR): ${total}, 已翻译: ${done}, 残余: ${residue.size} 种`);
console.log();
const sorted = [...residue.entries()].sort((a, b) => b[1].length - a[1].length || b[0].length - a[0].length);
for (const [t, files] of sorted) {
  console.log(`[${files.length}] ${t.slice(0, 130).replace(/\n/g, '\\n')}`);
}
