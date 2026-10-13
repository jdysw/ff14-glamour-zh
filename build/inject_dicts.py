# inject_dicts.py —— 从 dict/*.json 生成词典 JS 块并写入 canonical module（v3：common 复用 + 对象展开形态）
# 用法: python3 inject_dicts.py [目标 JS 路径]
# 输出格式：
#   const DICT_COMMON = {...};              ← 通用层（注入一次，站点共享）
#   const DICT  = { ...DICT_COMMON, {...} };← 站层（覆盖 common，使用对象展开）
#   （DICT_EC / DICT_FC / DICT_RONKA 同理）
# dict/*.json 为词典唯一权威源——本脚本每次构建全量覆盖 src/core/dictionary.js 中的七个词典块
# 生成七个词典块，并在每块上方维护一行「⚠️ 自动生成」标识（存在即更新、缺失即插入，
# 幂等；对块与标识的任何手改都会被下一次构建覆盖）。
import re, json, sys, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 仓库根（脚本相对，去机器绑定）
DICT_DIR = os.path.join(BASE, 'dict')
def _guard(p):
    """仅允许仓库内目标路径（防路径穿越）。"""
    rp = os.path.realpath(p)
    if rp != BASE and not rp.startswith(BASE + os.sep):
        raise SystemExit(f'目标路径越界（仅允许仓库内）: {p}')
    return rp

TARGET = _guard(sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, 'src/core/dictionary.js'))

# (变量名, 文件名, 是否站点层)
FILES = [
    ('DICT_COMMON', 'dict-common.json', False),
    ('DICT',        'dict-main.json',   True),
    ('DICT_EC',     'dict-ec.json',     True),
    ('DICT_FC',     'dict-fc.json',     True),
    ('DICT_RONKA',  'dict-ronka.json',  True),
    ('DICT_ACL',    'dict-acl.json',    True),
    ('DICT_ENDCLOSET', 'dict-endcloset.json', True),
]

def js_str(x):
    """JS 单引号字符串转义（含换行/制表等控制字符）"""
    x = x.replace('\\', '\\\\').replace("'", "\\'")
    x = x.replace('\r', '\\r').replace('\n', '\\n').replace('\t', '\\t')
    return "'" + x + "'"

def gen_kv(entries, indent='    ', spread=False):
    lines = ['{ ...DICT_COMMON,' if spread else '{']
    for k, v in entries.items():
        lines.append(indent + js_str(k) + ': ' + js_str(v) + ',')
    lines.append('  }')
    return '\n'.join(lines)

def _skip_str(s, i):
    """i 指向 ' 处；跳过字符串（含转义）；返回闭合引号的位置。"""
    i += 1
    while i < len(s) and s[i] != "'":
        if s[i] == '\\':
            i += 1
        i += 1
    return i


def _scan_block(s, i, open_ch, close_ch):
    """从 i（开括号之后）扫描到配平；返回闭合括号之后的位置。"""
    depth = 1
    while i < len(s) and depth > 0:
        c = s[i]
        if c == open_ch:
            depth += 1
        elif c == close_ch:
            depth -= 1
        elif c == "'":
            i = _skip_str(s, i)
        elif c == '/' and i + 1 < len(s) and s[i + 1] == '/':
            while i < len(s) and s[i] != '\n':
                i += 1
        elif c == '/' and i + 1 < len(s) and s[i + 1] == '*':
            i = s.find('*/', i) + 1
        i += 1
    return i


def find_block(s, name):
    """定位生成器拥有的 `const NAME = {...};` 对象块。
    返回 (stmt_start, stmt_end)；未找到返回 None。"""
    m = re.search(r'\n  const ' + re.escape(name) + r' = \{', s)
    if not m:
        return None
    stmt_start = m.start() + 1  # 行首（跳过 \n）
    j = _scan_block(s, m.end(), '{', '}')  # 闭合符之后
    if j < len(s) and s[j] == ';':
        j += 1
    return (stmt_start, j)


def banner_line(fn):
    """词典块上方的「自动生成」标识行（Phase 16）。"""
    return '  // ⚠️ 自动生成（dict/%s → build/inject_dicts.py）：勿手改本块；改词请改 JSON 后重新构建' % fn


def ensure_banner(s, name, fn):
    """在词典块上方维护标识行：已有则校正为现行文本，缺失则插入；幂等。"""
    r = find_block(s, name)
    if not r:
        return s
    start = r[0]
    want = banner_line(fn)
    pe = start - 1                      # 上一行的终止符 '\n'
    if pe > 0 and s[pe] == '\n':
        ps = s.rfind('\n', 0, pe) + 1   # 上一行行首
        prev = s[ps:pe]
        if re.match(r'^\s*// ⚠️ 自动生成.*inject_dicts\.py', prev):
            if prev == want:
                return s
            return s[:ps] + want + s[pe:]
    return s[:start] + want + '\n' + s[start:]

s = open(TARGET, encoding='utf-8').read()

total = 0
for name, fn, is_site in FILES:
    fp = os.path.join(DICT_DIR, fn)
    data = json.load(open(fp, encoding='utf-8'))
    entries = data['entries']
    body = gen_kv(entries, spread=is_site)
    new_stmt = '  const ' + name + ' = ' + body + ';'
    r = find_block(s, name)
    if not r:
        raise SystemExit(name + ': 缺少 canonical 词典对象块')
    start, end = r
    s = s[:start] + new_stmt + s[end:]
    s = ensure_banner(s, name, fn)
    n = len(entries)
    total += n
    print('%-12s 注入 %d 条%s' % (name, n, '（展开站层）' if is_site else '（共享层）'))

open(TARGET, 'w', encoding='utf-8').write(s)
print('总条目:', total)
print('写入', TARGET, os.path.getsize(TARGET), 'B')
