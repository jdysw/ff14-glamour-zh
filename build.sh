#!/usr/bin/env bash
# Phase 16 一键构建：词典注入 → 单文件源语法 → 模块化链（块切分 → 接口 → 顺序契约 → Rollup）→ 静态验收（顺序 / 锚点 / wiring）→ 词典校验（源 + 远程产物）
set -euo pipefail
cd "$(dirname "$0")"

PYTHON_BIN="${PYTHON_BIN:-python3}"
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi

CACHE_DIR="${ZHX_BUILD_CACHE:-.cache/build}"
MODULES_V1="$CACHE_DIR/modules-v1"
MODULES_V2="$CACHE_DIR/modules-v2"
BLOCK_MAP="$CACHE_DIR/block-map.json"
OUT="${ZHX_OUT:-dist/ff14-glamour-zh.greasyfork.user.js}"

rm -rf "$CACHE_DIR"
mkdir -p "$CACHE_DIR"

printf '%s\n' '① 词典注入（dict/*.json → src 模板）'
"$PYTHON_BIN" build/inject_dicts.py

printf '%s\n' '② 单文件源语法检查'
node --check src/ff14-glamour-zh.external.user.js

printf '%s\n' '③ AST 块地图'
node build/module-map.mjs > "$BLOCK_MAP"

printf '%s\n' '④ 按 module-assign.json 切分模块'
"$PYTHON_BIN" build/migrate/gen-modules.py "$MODULES_V1" "$BLOCK_MAP"

printf '%s\n' '⑤ 校验：零重复、零遗漏、逐模块保真'
"$PYTHON_BIN" build/migrate/verify-modules.py "$MODULES_V1" "$BLOCK_MAP"

printf '%s\n' '⑥ 生成 ESM import/export 接口'
node build/migrate/add-interfaces.mjs "$MODULES_V1" "$MODULES_V2"

printf '%s\n' '⑦ 应用并校验确定性模块顺序'
node build/migrate/order-modules.mjs "$MODULES_V2" build/module-order.json

printf '%s\n' '⑧ 安装生成模块到 src/'
rm -rf src/core src/sites
mkdir -p src/core src/sites
cp -rf "$MODULES_V2/core/." src/core/
cp -rf "$MODULES_V2/sites/." src/sites/
cp "$MODULES_V2/main.js" src/main.js

printf '%s\n' '⑨ 全部源模块语法检查'
node --check src/main.js
while IFS= read -r -d '' f; do node --check "$f"; done < <(find src/core src/sites -type f -name '*.js' -print0 | sort -z)

printf '%s\n' '⑩ Rollup 构建'
mkdir -p "$(dirname "$OUT")"
ZHX_OUT="$OUT" npx --no-install rollup -c build/rollup.config.mjs

printf '%s\n' '⑪ 验证最终产物的模块顺序'
node build/migrate/verify-build-order.mjs "$OUT" build/module-order.json

printf '%s\n' '⑫ 锚点健康扫描'
"$PYTHON_BIN" artifacts/anchor-scan.py "$OUT"

printf '%s\n' '⑬ ESM wiring 静态检查'
node build/migrate/analyze-wiring.mjs src

printf '%s\n' '⑭ 词典校验（src 内词典 vs dict/*.json 源）'
node build/verify_dicts.js src/ff14-glamour-zh.external.user.js

printf '%s\n' '⑮ 远程词库产物（dict/*.json → dict.json；数据站发布物）'
"$PYTHON_BIN" build/make_dict_json.py --out "$CACHE_DIR/dict.json"

printf '%s\n' '⑯ 词典单一源核验（src 内嵌 ≡ 远程产物）'
node build/verify_dicts.js src/ff14-glamour-zh.external.user.js --dict-json "$CACHE_DIR/dict.json"

printf '\n%s\n' "✅ Phase 16 构建验收完成：$OUT"
