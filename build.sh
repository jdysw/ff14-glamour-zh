#!/bin/bash
# 一键构建：词典注入 → 内嵌生成 → 语法检查 → 词典一致性 → 同步 workspace
set -e
cd /home/ubuntu/zhixia-glamour

echo "① 词典注入（dict/*.json → src/ 模板）"
python3 build/inject_dicts.py

echo "② 内嵌生成（src/ + data/ → dist/）"
python3 build/make_embedded5.py

echo "③ 语法检查"
node --check dist/ff14-glamour-zh.user.js

echo "④ 词典一致性（src vs dist）"
node build/verify_dicts.js src/ff14-glamour-zh.external.user.js dist/ff14-glamour-zh.user.js

echo "④b GF 发布件（外置数据版 → dist/ff14-glamour-zh.greasyfork.user.js）"
cp src/ff14-glamour-zh.external.user.js dist/ff14-glamour-zh.greasyfork.user.js
node --check dist/ff14-glamour-zh.greasyfork.user.js

echo "⑤ 同步到 workspace（HTTP 更新服务目录）"
cp dist/ff14-glamour-zh.user.js /home/ubuntu/workspace/ff14-glamour-zh.user.js
cp src/ff14-glamour-zh.external.user.js /home/ubuntu/workspace/ff14-glamour-zh.external.user.js

echo "✅ 构建完成：$(stat -c%s dist/ff14-glamour-zh.user.js) B"
echo "   推送安装：ssh … schtasks /Run /TN TMUpd2"
