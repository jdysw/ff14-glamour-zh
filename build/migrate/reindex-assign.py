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
#   * replace 带内：① 全文 sha256 精确配对 → ② 首行/类型配对 → ③ 余量等量按位置配对；
#   * 旧块无对应   = 有块被删 → 报错退出（需人工处理，勿盲目继续）；
#   * 新块无对应   = 新增块 → 列清单；用 --add 模块:块号列表 归入模块（缺省则退出）；
#   * comment* 字段原样保留；--note 追加 commentN。
# 完成后须重跑构建链（至少 gen-modules + verify-modules 两步）确认 ⑤ 零遗漏。
import difflib
import hashlib
import json
import os
import subprocess
import sys

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ASSIGN = os.path.join(BASE, 'build', 'migrate', 'module-assign.json')
USAGE = '用法: reindex-assign.py <旧源文件> <新源文件> [--add 模块:块号,块号] [--note 注释] [--dry]'


def parse_args(argv):
    """解析 CLI 参数 → (dry, add_spec, note, 位置参数列表)"""
    dry = False
    add_spec = None
    note = None
    pos = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--add':
            add_spec = argv[i + 1]
            i += 2
        elif a == '--note':
            note = argv[i + 1]
            i += 2
        elif a == '--dry':
            dry = True
            i += 1
        else:
            pos.append(a)
            i += 1
    return dry, add_spec, note, pos


def block_map(src_path):
    if not os.path.isfile(src_path):
        sys.exit(f'源文件不存在: {src_path}')
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
            'sig': hashlib.sha256(text.encode('utf-8')).hexdigest()[:20],
            'head': b['head'], 'type': b['type'], 'start': b['start'],
        })
    return out


def pair_replace_region(old_s, new_s, olds, news, mp):
    """replace 带内配对：① 全文精确 ② 首行+类型 ③ 余量等量按位置；返回未配对的新块索引"""
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
        return news
    if len(olds) == len(news):
        for o, n in zip(olds, news):
            mp[o] = n
        return []
    sys.exit(f'replace 带余量不等（{len(olds)}↔{len(news)}）——需人工检查')


def build_mapping(old_s, new_s):
    """序列对齐 → (旧→新索引映射, 未配对的新块索引列表)"""
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
        if not news:
            sys.exit(f'旧块 {i1}:{i2} 未找到对应（被删除？）——需人工处理')
        if not olds:
            new_only += news
            continue
        new_only += pair_replace_region(old_s, new_s, olds, news, mp)
    return mp, new_only


def verify_mapping(mp, new_only, n_new):
    """断言：映射保序、满覆盖 → (有序对, 仍未映射的新块)"""
    pairs = sorted(mp.items())
    assert all(pairs[k][0] < pairs[k + 1][0] and pairs[k][1] < pairs[k + 1][1]
               for k in range(len(pairs) - 1)), '映射非保序'
    still_new = sorted(set(range(n_new)) - set(mp.values()))
    assert still_new == sorted(new_only), f'未映射集合异常: {still_new} vs {new_only}'
    return pairs, still_new


def print_shifts(pairs):
    shifts = {}
    for o, n in pairs:
        shifts.setdefault(n - o, []).append(o)
    print('位移分布:')
    for d in sorted(shifts):
        rng = shifts[d]
        print(f'  Δ{d:+d}: {len(rng)} 块（旧 #{rng[0]}..#{rng[-1]}）')


def parse_additions(add_spec, still_new, new_s):
    """--add 归入模块；缺省但有未映射新块 → 列清单退出"""
    if not add_spec:
        if still_new:
            print('未映射的新块（需 --add 归入模块）:')
            for k in still_new:
                print(f'  new#{k} L{new_s[k]["start"]} {new_s[k]["head"][:90]}')
            sys.exit('请用 --add 指定归属后重跑')
        return {}
    additions = {}
    for part in add_spec.split(';'):
        mod, nums = part.split(':')
        additions[mod] = [int(x) for x in nums.split(',') if x.strip()]
    req = {x for v in additions.values() for x in v}
    if req != set(still_new):
        sys.exit(f'--add 提供的 {sorted(req)} 与未映射新块 {still_new} 不一致')
    return additions


def translate_assign(assign, mp, additions):
    """按映射翻译分配表；登记新增块归属"""
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
    for mod in additions:
        if mod not in out:
            sys.exit(f'--add 目标模块不存在: {mod}')
    return out


def append_note(out, note):
    nums = [int(k[len('comment'):]) for k in out
            if k.startswith('comment') and k[len('comment'):].isdigit()]
    n = (max(nums) + 1) if nums else 1
    out[f'comment{n}'] = note


def main():
    dry, add_spec, note, pos = parse_args(sys.argv[1:])
    if len(pos) != 2:
        sys.exit(USAGE)
    old_src, new_src = pos
    old_blocks, new_blocks = block_map(old_src), block_map(new_src)
    old_s, new_s = sigs(old_src, old_blocks), sigs(new_src, new_blocks)
    print(f'旧块数 {len(old_blocks)} / 新块数 {len(new_blocks)}')

    mp, new_only = build_mapping(old_s, new_s)
    pairs, still_new = verify_mapping(mp, new_only, len(new_blocks))
    print_shifts(pairs)

    additions = parse_additions(add_spec, still_new, new_s)
    assign = json.load(open(ASSIGN, encoding='utf-8'))
    out = translate_assign(assign, mp, additions)
    if note:
        append_note(out, note)

    if dry:
        print('（--dry：未写入）')
        return
    with open(ASSIGN, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(f'已写入 {ASSIGN}')


if __name__ == '__main__':
    main()
