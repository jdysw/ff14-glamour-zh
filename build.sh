#!/usr/bin/env bash
# Phase 22 一键构建：版本同步 → 词典生成 → 模块源码校验 → 语法检查 → Rollup
# → 产物结构 / 锚点 / wiring 验收 → 词典校验 → 版本一致性。
# src/main.js + src/core/*.js + src/sites/*.js 是唯一代码源码；Legacy 单文件源不再参与构建。
set -euo pipefail
cd "$(dirname "$0")"

PYTHON_BIN="${PYTHON_BIN:-python3}"
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi

CACHE_DIR="${ZHX_BUILD_CACHE:-.cache/build}"
OUT="${ZHX_OUT:-dist/ff14-glamour-zh.greasyfork.user.js}"

rm -rf "$CACHE_DIR"
mkdir -p "$CACHE_DIR"

printf '%s\n' '⓪ 版本同步（package.json → userscript-header.txt）'
node build/version.mjs

printf '%s\n' '① 词典生成（dict/*.json → src/core/dictionary.js）'
"$PYTHON_BIN" build/inject_dicts.py src/core/dictionary.js

printf '%s\n' '② 模块源码布局校验（唯一源码入口 / 禁止 Legacy 单文件源）'
node build/verify-module-source.mjs

printf '%s\n' '③ 全部模块语法检查'
node --check src/main.js
while IFS= read -r -d '' f; do node --check "$f"; done < <(find src/core src/sites -type f -name '*.js' -print0 | sort -z)

printf '%s\n' '④ Rollup 构建（src/main.js → userscript）'
mkdir -p "$(dirname "$OUT")"
ZHX_OUT="$OUT" npx --no-install rollup -c build/rollup.config.mjs

printf '%s\n' '⑤ 验证最终产物的模块顺序'
node build/migrate/verify-build-order.mjs "$OUT" build/module-order.json

printf '%s\n' '⑥ 锚点健康扫描'
"$PYTHON_BIN" build/verify-anchors.py "$OUT"

printf '%s\n' '⑦ ESM wiring 静态检查'
node build/migrate/analyze-wiring.mjs src

printf '%s\n' '⑧ 词典校验（src/core/dictionary.js vs dict/*.json 源）'
node build/verify_dicts.js src/core/dictionary.js

printf '%s\n' '⑨ 远程词库产物（dict/*.json → dict.json；数据站发布物）'
"$PYTHON_BIN" build/make_dict_json.py --out "$CACHE_DIR/dict.json"

printf '%s\n' '⑩ 词典单一源核验（src/core/dictionary.js ≡ 远程产物）'
node build/verify_dicts.js src/core/dictionary.js --dict-json "$CACHE_DIR/dict.json"

printf '%s\n' '⑪ 版本一致性校验（package.json ≡ header ≡ dist）'
node build/version.mjs --check

printf '\n%s\n' "✅ Phase 22 构建验收完成：$OUT"
