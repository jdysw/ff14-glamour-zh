# inject_dicts.py —— 从 dict/*.json 生成词典 JS 块并回填模板（v2：common 复用）
# 用法: python3 inject_dicts.py [目标模板路径]
# 输出格式：
#   const DICT_COMMON = {...};                             ← 通用层（注入一次，四站共享）
#   const DICT  = Object.assign({}, DICT_COMMON, {...});   ← 站层（覆盖 common）
#   （DICT_EC / DICT_FC / DICT_RONKA 同理）
import re, json, sys, os

BASE = '/home/ubuntu/zhixia-glamour'
DICT_DIR = os.path.join(BASE, 'dict')
TARGET = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, 'src/ff14-glamour-zh.external.user.js')

# (变量名, 文件名, kind, 是否站点层)
FILES = [
    ('DICT_COMMON', 'dict-common.json', 'kv', False),
    ('DICT',        'dict-main.json',   'kv', True),
    ('DICT_EC',     'dict-ec.json',     'kv', True),
    ('DICT_FC',     'dict-fc.json',     'kv', True),
    ('DICT_RONKA',  'dict-ronka.json',  'kv', True),
    ('DICT_ACL',    'dict-acl.json',    'kv', True),
]

SITE_PREFIX = 'Object.assign({}, DICT_COMMON, '

def js_str(x):
    """JS 单引号字符串转义（含换行/制表等控制字符）"""
    x = x.replace('\\', '\\\\').replace("'", "\\'")
    x = x.replace('\r', '\\r').replace('\n', '\\n').replace('\t', '\\t')
    return "'" + x + "'"

def gen_kv(entries, indent='    '):
    lines = ['{']
    for k, v in entries.items():
        lines.append(indent + js_str(k) + ': ' + js_str(v) + ',')
    lines.append('  }')
    return '\n'.join(lines)

def gen_arr(entries, indent='    '):
    lines = ['[']
    for it in entries:
        if it.get('type') == 's':
            lines.append(indent + js_str(it['v']) + ',')
        else:
            lines.append(indent + it['v'] + ',')
    lines.append('  ]')
    return '\n'.join(lines)

def find_block(s, name):
    """定位 `const NAME = {...};` 或 `const NAME = Object.assign({}, DICT_COMMON, {...});`
    返回 (stmt_start, stmt_end, had_prefix)；未找到返回 None。"""
    m = re.search(r'\n  const ' + re.escape(name) + r' = (Object\.assign\(\{\}, DICT_COMMON, )?([\{\[])\n', s)
    if not m:
        return None
    stmt_start = m.start() + 1  # 行首（跳过 \n）
    had_prefix = bool(m.group(1))
    open_ch = m.group(2)
    close_ch = '}' if open_ch == '{' else ']'
    depth = 1
    i = m.end()  # 位于开括号之后
    while i < len(s) and depth > 0:
        c = s[i]
        if c == open_ch: depth += 1
        elif c == close_ch: depth -= 1
        elif c == "'":
            i += 1
            while i < len(s) and s[i] != "'":
                if s[i] == '\\': i += 1
                i += 1
        elif c == '/' and i+1 < len(s) and s[i+1] == '/':
            while i < len(s) and s[i] != '\n': i += 1
        elif c == '/' and i+1 < len(s) and s[i+1] == '*':
            i = s.find('*/', i) + 1
        i += 1
    j = i  # 闭合符之后；吞掉尾部残留 `;` / `)`（多次跑后可能残留 `}););` 形态），保留换行/缩进
    while j < len(s) and s[j] in ';)':
        j += 1
    return (stmt_start, j, had_prefix)

s = open(TARGET, encoding='utf-8').read()

# 0) 确保 DICT_COMMON 块存在（首次插入到 `const DICT = ` 之前）
if find_block(s, 'DICT_COMMON') is None:
    data = json.load(open(os.path.join(DICT_DIR, 'dict-common.json'), encoding='utf-8'))
    new_block = '  const DICT_COMMON = ' + gen_kv(data['entries']) + ';\n\n'
    anchor = re.search(r'\n  const DICT = ', s)
    assert anchor, '未找到 const DICT 块（无法插入 DICT_COMMON）'
    pos = anchor.start() + 1
    s = s[:pos] + new_block + s[pos:]
    print('DICT_COMMON    插入 %d 条（新块）' % len(data['entries']))

total = 0
for name, fn, kind, is_site in FILES:
    fp = os.path.join(DICT_DIR, fn)
    if not os.path.exists(fp):
        print(name, 'JSON 缺失，跳过'); continue
    data = json.load(open(fp, encoding='utf-8'))
    entries = data['entries']
    body = gen_kv(entries) if kind == 'kv' else gen_arr(entries)
    new_stmt = '  const ' + name + ' = ' + (SITE_PREFIX if is_site else '') + body + (');' if is_site else ';')
    r = find_block(s, name)
    if not r:
        print(name, '块未找到'); continue
    start, end, _ = r
    s = s[:start] + new_stmt + s[end:]
    n = len(entries)
    total += n
    print('%-12s 注入 %d 条%s' % (name, n, '（Object.assign 站层）' if is_site else '（共享层）'))

open(TARGET, 'w', encoding='utf-8').write(s)
print('总条目:', total)
print('写入', TARGET, os.path.getsize(TARGET), 'B')
