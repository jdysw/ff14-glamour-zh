# 提取模板中的词典块 → dict/*.json（历史工具；词典权威源现为 dict/*.json）
import re, json, shutil, os

SRC = '/home/ubuntu/zhixia-glamour/src/ff14-glamour-zh.external.user.js'
DICT_DIR = '/home/ubuntu/zhixia-glamour/dict'

# 备份
shutil.copy(SRC, SRC + '.bak-dictsplit')
s = open(SRC, encoding='utf-8').read()

def find_block(s, name):
    """定位 const <name> = { 或 [ 到匹配的 }; 或 ];，返回 (start, end, body)"""
    m = re.search(r'\n  const ' + re.escape(name) + r' = ', s)
    if not m:
        return None
    # 跳过历史前缀 `Object.assign({}, DICT_COMMON, `（旧模板形态）
    _pfx = 'Object.assign({}, DICT_COMMON, '
    off = len(_pfx) if s[m.end():].startswith(_pfx) else 0
    open_ch = s[m.end() + off]
    if open_ch not in '{[':
        return None
    close_ch = '}' if open_ch == '{' else ']'
    start = m.start() + 1  # 跳过前导换行
    # 从开括号之后开始数括号平衡
    depth = 1
    i = m.end() + off + 1
    while i < len(s) and depth > 0:
        c = s[i]
        if c == open_ch: depth += 1
        elif c == close_ch: depth -= 1
        elif c == "'":
            # 跳过字符串
            i += 1
            while i < len(s) and s[i] != "'":
                if s[i] == '\\': i += 1
                i += 1
        elif c == '/' and i+1 < len(s) and s[i+1] == '/':
            while i < len(s) and s[i] != '\n': i += 1
        elif c == '/' and i+1 < len(s) and s[i+1] == '*':
            i = s.find('*/', i) + 1
        i += 1
    end = i  # 指向 close_ch 之后
    body = s[m.end() + off + 1:i-1]  # 不含外层括号
    return (start, end, body, open_ch, close_ch)

def scan_js_string(s, i):
    """从 s[i]（引号处）扫描到闭合引号，返回 (内容, 下一位置) 或 None（受控扫描，不执行代码）。"""
    q = s[i]
    if q not in ("'", '"'):
        return None
    i += 1
    out = []
    while i < len(s):
        c = s[i]
        if c == '\\':
            n = s[i + 1] if i + 1 < len(s) else ''
            if n == 'n':
                out.append('\n')
            elif n == 'r':
                out.append('\r')
            elif n == 't':
                out.append('\t')
            elif n == 'u' and i + 5 < len(s):
                try:
                    out.append(chr(int(s[i + 2:i + 6], 16)))
                except ValueError:
                    out.append(n)
                i += 6
                continue
            else:
                out.append(n)
            i += 2
            continue
        if c == q:
            return (''.join(out), i + 1)
        out.append(c)
        i += 1
    return None

def _skip_tail(t, j, allow_comma=True):
    """j 起跳过空白/可选尾逗号；返回新位置，或 None（存在多余内容）。"""
    while j < len(t) and t[j] in ' \t':
        j += 1
    if allow_comma and j < len(t) and t[j] == ',':
        j += 1
        while j < len(t) and t[j] in ' \t':
            j += 1
    if j != len(t):
        return None
    return j

def parse_kv_line(t):
    """解析单行 'k': 'v',（单/双引号）→ (k, v) 或 None。"""
    r1 = scan_js_string(t, 0)
    if not r1:
        return None
    k, i = r1
    while i < len(t) and t[i] in ' \t':
        i += 1
    if i >= len(t) or t[i] != ':':
        return None
    i += 1
    while i < len(t) and t[i] in ' \t':
        i += 1
    r2 = scan_js_string(t, i)
    if not r2:
        return None
    v, j = r2
    if _skip_tail(t, j) is None:
        return None
    return (k, v)

def parse_kv_dict(body):
    """解析 { 'k': 'v', ... } —— 逐行（受控扫描）"""
    pairs = {}
    # 逐行扫描（保留顺序）
    for line in body.split('\n'):
        t = line.strip()
        if not t or t.startswith('//') or t.startswith('{') or t.startswith('}') or t.startswith('...'):
            continue
        kv = parse_kv_line(t)
        if kv:
            pairs[kv[0]] = kv[1]
            continue
        print('  未解析行:', t[:90])
    return pairs

def parse_array(body):
    """解析 [ 'x', /re/, ... ] —— 逐行，保留注释里的类型标记"""
    items = []
    for line in body.split('\n'):
        t = line.strip()
        if not t or t.startswith('//'):
            continue
        # 字符串项
        if t.startswith("'"):
            r = scan_js_string(t, 0)
            if r and _skip_tail(t, r[1]) is not None:
                items.append({'type': 's', 'v': r[0]})
                continue
        # /regex/, 'replacement', flags 形式（保守：整行保存）
        items.append({'type': 'raw', 'v': t.rstrip(',')})
    return items

os.makedirs(DICT_DIR, exist_ok=True)
result = {}
for name, kind in [('DICT', 'kv'), ('DICT_EC', 'kv'), ('DICT_FC', 'kv')]:
    r = find_block(s, name)
    if not r:
        print(name, '未找到'); continue
    start, end, body, oc, cc = r
    if kind == 'kv':
        data = parse_kv_dict(body)
        out = {'kind': 'kv', 'entries': data}
    else:
        data = parse_array(body)
        out = {'kind': 'arr', 'entries': data}
    result[name] = out
    print('%-12s %s 条  (原文 %d 字符)' % (name, len(data), end - start))

# 写 JSON
mapping = {'DICT': 'dict-main.json', 'DICT_EC': 'dict-ec.json', 'DICT_FC': 'dict-fc.json'}
for name, out in result.items():
    fp = os.path.join(DICT_DIR, mapping[name])
    with open(fp, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print('写出', fp, os.path.getsize(fp), 'B')

# 保存块位置信息（供后续替换）
_bl = {}
for n in ['DICT', 'DICT_EC', 'DICT_FC']:
    r2 = find_block(s, n)
    if r2:
        _bl[n] = {'start': r2[0], 'end': r2[1]}
with open(os.path.join(DICT_DIR, '_blocks.json'), 'w', encoding='utf-8') as f:
    json.dump(_bl, f)
print('完成')
