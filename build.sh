#!/bin/bash
# 一键构建：词典注入 → 语法检查 → 词典校验 → GF 发布件
set -e
cd "$(dirname "$0")"

echo "① 词典注入（dict/*.json → src/ 模板）"
python3 build/inject_dicts.py

echo "② 语法检查"
node --check src/ff14-glamour-zh.external.user.js

echo "③ 词典校验（src 内词典 vs dict/*.json 源）"
node build/verify_dicts.js src/ff14-glamour-zh.external.user.js

echo "④ GF 发布件（数据外置版 → dist/ff14-glamour-zh.greasyfork.user.js）"
mkdir -p dist
cp src/ff14-glamour-zh.external.user.js dist/ff14-glamour-zh.greasyfork.user.js
node --check dist/ff14-glamour-zh.greasyfork.user.js

# ⑤ 同步到 workspace（可选：仅当目标目录存在时；作者本地 HTTP 更新服务用，CI/贡献者环境自动跳过）
WS="${ZHX_WORKSPACE:-$HOME/workspace}"
if [ -d "$WS" ]; then
  cp dist/ff14-glamour-zh.greasyfork.user.js "$WS/ff14-glamour-zh.user.js"
  cp src/ff14-glamour-zh.external.user.js "$WS/ff14-glamour-zh.external.user.js"
fi

echo "✅ 构建完成：$(stat -c%s dist/ff14-glamour-zh.greasyfork.user.js) B（GF 版）"
