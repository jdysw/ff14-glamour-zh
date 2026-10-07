#!/usr/bin/env python3
# 扫描产物中 @zhixia 锚点的 start/end 配对健康度。
# 用法：python3 artifacts/anchor-scan.py [dist文件]
import re
import sys
from collections import defaultdict
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
target = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else repo / 'dist' / 'ff14-glamour-zh.greasyfork.user.js'
s = target.read_text(encoding='utf-8')
anchors = [(m.start(), m.group(1), m.group(2)) for m in re.finditer(r'/\* @zhixia:([a-zA-Z-]+?)-(start|end) \*/', s)]
seq = defaultdict(list)
for pos, tag, kind in anchors:
    seq[tag].append((pos, kind))

def lineno(pos):
    return s.count('\n', 0, pos) + 1


try:
    display_target = target.relative_to(repo)
except ValueError:
    display_target = target
print(f'文件：{display_target}')
print(f'共 {len(anchors)} 个锚点，{len(seq)} 个 tag')
print()
bad = []
for tag, lst in sorted(seq.items()):
    depth = 0
    ok = True
    details = []
    for pos, kind in lst:
        details.append(f'{kind}@{lineno(pos)}')
        if kind == 'start':
            depth += 1
        else:
            depth -= 1
            if depth < 0:
                ok = False
                break
    if depth != 0:
        ok = False
    print(('OK  ' if ok else 'BAD '), f'{tag:30s}', ' '.join(details))
    if not ok:
        bad.append(tag)

print()
print(f'BAD tags ({len(bad)}): {bad}')
sys.exit(0 if not bad else 1)
