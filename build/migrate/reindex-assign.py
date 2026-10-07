#!/usr/bin/env python3
# reindex-assign.py —— 块索引重算工具（Phase 18 增补）
# 背景:
#   module-assign.json 按「顶层块索引」分配模块；源文件新增/删除顶层语句
#   （块）后旧索引整体错位 → 构建 ⑤ 步报「A3 遗漏行」。本工具按序列对齐
#   重算索引，替代手工平移。
# 用法:
#   python3 build/migrate/reindex-assign.py <旧源文件> <新源文件> \
#       [--add core/runtime:258,259,260] [--note "comment4 文本"] [--dry]
# 规则:
#   * equal       ：旧块 ≡ 新块，直接换新索引；
#   * replace 带内：① 全文 sha1 精确配对 → ② 首行/类型配对 → ③ 余量等量按位置配对；
#   * 旧块无对应   = 有块被删 → 报错退出（需人工处理，勿盲目继续）；
#   * 新块无对应   = 新增块 → 列清单；用 --add 模块:块号列表 归入模块（缺省则退出）；
#   * comment* 字段原样保留；--note 追加 commentN。
# 完成后须重跑构建链（至少 gen-modules + verify-modules 两步）确认 ⑤ 零遗漏。
import hashlib
import json
import os
import subprocess
import sys

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ASSIGN = os.path.join(BASE, 'build', 'migrate', 'module-assign.json')


def block_map(src_path):
    r = subprocess.run(['node', os.path.join(BASE, 'build', 'module-map.mjs'), src_path],
                       capture_output=True, text=True, cwd=BASE)
    if r.returncode != 0:
        sys.exit('module-map.mjs 失败:\n' + r.stderr)
    return json.loads(r.stdout)


def sigs(src_path, blocks):
    lines = open(src_path, encoding='utf-8').read().split('\n')
    out = []
    for b in blocks:
        text = '\n'.join(lines[b['start'] - 1:b['end']])
        out.append({
            'sig': hashlib.sha1(text.encode('utf-8')).hexdigest()[:20],
            'head': b['head'], 'type': b['type'], 'start': b['start'],
        })
    return out


def main():
    argv = sys.argv[1:]
    dry = '--dry' in argv
    add_spec = None
    note = None
    pos = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--add':
            add_spec = argv[i + 1]
            i += 2
            continue
        if a == '--note':
            note = argv[i + 1]
            i += 2
            continue
        if a == '--dry':
            i += 1
            continue
        pos.append(a)
        i += 1
    if len(pos) != 2:
        sys.exit('用法: reindex-assign.py <旧源文件> <新源文件> [--add 模块:块号,块号] [--note 注释] [--dry]')
    old_src, new_src = pos
    old_blocks, new_blocks = block_map(old_src), block_map(new_src)
    old_s, new_s = sigs(old_src, old_blocks), sigs(new_src, new_blocks)
    print(f'旧块数 {len(old_blocks)} / 新块数 {len(new_blocks)}')

    import difflib
    sm = difflib.SequenceMatcher(None, [b['sig'] for b in old_s], [b['sig'] for b in new_s], autojunk=False)
    mp = {}
    new_only = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            for k in range(i2 - i1):
                mp[i1 + k] = j1 + k
            continue
        olds = list(range(i1, i2))
        news = list(range(j1, j2))
        if tag == 'delete' or (tag == 'replace' and not news):
            sys.exit(f'旧块 {i1}:{i2} 未找到对应（被删除？）——需人工处理')
        if tag == 'insert' or (tag == 'replace' and not olds):
            new_only += news
            continue
        # replace：① 全文精确 ② 首行+类型 ③ 余量等量按位置
        for o in list(olds):
            for n in list(news):
                if old_s[o]['sig'] == new_s[n]['sig']:
                    mp[o] = n
                    olds.remove(o)
                    news.remove(n)
                    break
        for o in list(olds):
            for n in list(news):
                if old_s[o]['head'] == new_s[n]['head'] and old_s[o]['type'] == new_s[n]['type']:
                    mp[o] = n
                    olds.remove(o)
                    news.remove(n)
                    break
        if not olds:
            new_only += news
        elif len(olds) == len(news):
            for o, n in zip(olds, news):
                mp[o] = n
        else:
            sys.exit(f'replace 带 旧{i1}:{i2} ↔ 新{j1}:{j2} 余量不等（{len(olds)}↔{len(news)}）'
                     f'——需人工检查')

    # 断言：映射保序、满覆盖
    pairs = sorted(mp.items())
    assert all(pairs[k][0] < pairs[k + 1][0] and pairs[k][1] < pairs[k + 1][1]
               for k in range(len(pairs) - 1)), '映射非保序'
    mapped_new = set(mp.values())
    covered = set(range(len(new_blocks)))
    still_new = sorted(covered - mapped_new)
    assert still_new == sorted(new_only), f'未映射集合异常: {still_new} vs {new_only}'

    # 打印位移概况
    shifts = {}
    for o, n in pairs:
        shifts.setdefault(n - o, []).append(o)
    print('位移分布:')
    for d in sorted(shifts):
        rng = shifts[d]
        print(f'  Δ{d:+d}: {len(rng)} 块（旧 #{rng[0]}..#{rng[-1]}）')

    # --add 归入模块
    additions = {}
    if add_spec:
        for part in add_spec.split(';'):
            mod, nums = part.split(':')
            additions[mod] = [int(x) for x in nums.split(',') if x.strip()]
        req = set(sum(additions.values(), []))
        if req != set(still_new):
            sys.exit(f'--add 提供的 {sorted(req)} 与未映射新块 {still_new} 不一致')
    elif still_new:
        print('未映射的新块（需 --add 归入模块）:')
        for k in still_new:
            print(f'  new#{k} L{new_s[k]["start"]} {new_s[k]["head"][:90]}')
        sys.exit('请用 --add 指定归属后重跑')

    assign = json.load(open(ASSIGN, encoding='utf-8'))
    out = {}
    for mod, v in assign.items():
        if mod.startswith('comment'):
            out[mod] = v
            continue
        bad = [i for i in v if i not in mp]
        if bad:
            sys.exit(f'{mod} 含无法映射的旧索引 {bad}')
        newv = sorted(mp[i] for i in v)
        for x in additions.get(mod, []):
            if x not in newv:
                newv.append(x)
        newv.sort()
        out[mod] = newv
        if newv != v:
            print(f'{mod}: {len(v)} 块 → {len(newv)} 块  {v if len(v) <= 10 else "…"} → {newv if len(newv) <= 10 else "…"}')
    for mod, nums in additions.items():
        if mod not in out:
            sys.exit(f'--add 目标模块不存在: {mod}')
    if note:
        nums = [int(k[len('comment'):]) for k in out
                if k.startswith('comment') and k[len('comment'):].isdigit()]
        n = (max(nums) + 1) if nums else 1
        out[f'comment{n}'] = note

    if dry:
        print('（--dry：未写入）')
        return
    with open(ASSIGN, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(f'已写入 {ASSIGN}')


if __name__ == '__main__':
    main()
