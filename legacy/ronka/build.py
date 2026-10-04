#!/usr/bin/env python3
# 组装 ronka userscript：数据 + 引擎 → dist/ronka-zh.user.js
import json, os, re, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, 'data')
SRC = os.path.join(ROOT, 'src')
DIST = os.path.join(ROOT, 'dist')
os.makedirs(DIST, exist_ok=True)

version = open(os.path.join(ROOT, 'VERSION')).read().strip()

ui = json.load(open(os.path.join(DATA, 'ui_map.json'), encoding='utf-8'))
items = json.load(open(os.path.join(DATA, 'item_map.json'), encoding='utf-8'))
stains = json.load(open(os.path.join(DATA, 'stain_final.json'), encoding='utf-8'))
ui_long = json.load(open(os.path.join(DATA, 'ui_long.json'), encoding='utf-8')) if os.path.exists(os.path.join(DATA, 'ui_long.json')) else {}

engine = open(os.path.join(SRC, 'engine.js'), encoding='utf-8').read()

def jdump(o):
    return json.dumps(o, ensure_ascii=False, separators=(',', ':'))

header = f'''// ==UserScript==
// @name         Ronka 穿搭集 汉化（韩服幻化站）
// @name:zh-CN   Ronka Lookbook 中文化
// @namespace    zhixia.ronka
// @version      {version}
// @description  lookbook.ronkacloset.com 全站汉化：界面文案 + 装备名（对接国服译名，27k 条）+ 染剂名。装备名经 ID→日文名→国服译名 链路生成。
// @author       栀夏
// @match        https://lookbook.ronkacloset.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
// 生成时间: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}
// 数据: UI {len(ui)} / 装备 {len(items)} / 染剂 {len(stains)}
'''

bundle = header + '\n'
bundle += 'var __UI__ = ' + jdump(ui) + ';\n'
bundle += 'var __ITEMS__ = ' + jdump(items) + ';\n'
bundle += 'var __STAINS__ = ' + jdump(stains) + ';\n'
bundle += 'var __UI_LONG__ = ' + jdump(ui_long) + ';\n'
bundle += engine

out = os.path.join(DIST, 'ronka-zh.user.js')
open(out, 'w', encoding='utf-8').write(bundle)
print(f'built: {out}')
print(f'size: {len(bundle.encode("utf-8"))} bytes')
print(f'ui={len(ui)} items={len(items)} stains={len(stains)} long={len(ui_long)}')
