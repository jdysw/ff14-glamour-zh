# 提取模板中的 5 个词典块 → dict/*.json
import re, json, shutil, os

SRC = '/home/ubuntu/zhixia-glamour/src/ff14-glamour-zh.external.user.js'
DICT_DIR = '/home/ubuntu/zhixia-glamour/dict'

# 备份
shutil.copy(SRC, SRC + '.bak-dictsplit')
s = open(SRC, encoding='utf-8').read()

def find_block(s, name):
    """定位 const <name> = { 或 [ 到匹配的 }; 或 ];，返回 (start, end, body)"""
    m = re.search(r'\n  const ' + re.escape(name) + r' = ([\{\[])\n', s)
    if not m:
        return None
    open_ch = m.group(1)
    close_ch = '}' if open_ch == '{' else ']'
    start = m.start() + 1  # 跳过前导换行
    # 从 m.end() 开始数括号平衡
    depth = 1
    i = m.end()
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
    body = s[m.end():i-1]  # 不含外层括号
    return (start, end, body, open_ch, close_ch)

def unescape_js(x):
    """完整反转义 JS 字符串：\\x -> \\x, \\uXXXX -> 字符, 其余转义字符"""
    x = x.replace('\\\\', '\x00')          # 双反斜杠先占位
    x = x.replace("\\'", "'").replace('\\"', '"')
    x = x.replace('\\n', '\n').replace('\\t', '\t')
    x = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), x)
    x = x.replace('\x00', '\\')
    return x

def parse_kv_dict(body):
    """解析 { 'k': 'v', ... } —— 逐行"""
    pairs = {}
    # 逐行扫描（保留顺序）
    for line in body.split('\n'):
        t = line.strip()
        if not t or t.startswith('//'):
            continue
        mm = re.match(r'''^(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*,?\s*$''', t)
        if mm:
            k = (mm.group(1) if mm.group(1) is not None else mm.group(2)) or ''
            v = (mm.group(3) if mm.group(3) is not None else mm.group(4)) or ''
            pairs[unescape_js(k)] = unescape_js(v)
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
        mm = re.match(r"^'((?:[^'\\]|\\.)*)'\s*,?\s*$", t)
        if mm:
            items.append({'type': 's', 'v': mm.group(1).replace("\\'", "'").replace('\\\\', '\\')})
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
