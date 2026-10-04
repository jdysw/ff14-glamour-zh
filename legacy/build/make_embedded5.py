import os, re

EXT = '/home/ubuntu/zhixia-glamour/src/ff14-glamour-zh.external.user.js'
OUT = '/home/ubuntu/zhixia-glamour/dist/ff14-glamour-zh.user.js'

s = open(EXT, encoding='utf-8').read()
main = open('/home/ubuntu/zhixia-glamour/data/ff14-main.txt', encoding='utf-8').read()
dyes = open('/home/ubuntu/zhixia-glamour/data/ff14-dyes2.txt', encoding='utf-8').read()
ecid = open('/home/ubuntu/zhixia-glamour/data/ff14-ecid.txt', encoding='utf-8').read()
jp2zh = open('/home/ubuntu/zhixia-glamour/data/ff14-jp2zh.txt', encoding='utf-8').read()
series = open('/home/ubuntu/zhixia-glamour/data/ff14-series.txt', encoding='utf-8').read()
ronka = open('/home/ubuntu/zhixia-glamour/data/ronka-items.txt', encoding='utf-8').read()
acl_cfc = open('/home/ubuntu/zhixia-glamour/data/acl-cfc.txt', encoding='utf-8').read()

esc = main.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
esc_d = dyes.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
esc_e = ecid.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
esc_j = jp2zh.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
esc_s = series.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
esc_r = ronka.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
esc_a = acl_cfc.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')

START = "  /* @zhixia:data-layer-start */"
END = "  /* @zhixia:data-layer-end */"
i = s.index(START)
j = s.index(END) + len(END)

block = (
    "  /* @zhixia:data-layer-start */\n"
    "  /* ── 内嵌数据版：数据表打包在本脚本内（由 build/make_embedded5.py 生成，勿手改）──\n"
    "     数据来源同外置版（zhixia-data.pages.dev）；本版不发起任何网络请求。 */\n"
    "  const DATA_REMOTE = false;\n\n"
    "  // 主表：\"hash|国服中文名|英文名\"（无 hash 的首字段留空）\n"
    "  const ITEM_DB_TEXT = \"" + esc + "\";\n\n"
    "  // 染剂表：\"e|英文名|中文名\" 或 \"j|日文名|中文名\"\n"
    "  const NAME_TEXT = \"" + esc_d + "\";\n\n"
    "  // EC 装备 ID 表：\"中文名|EC_ID\"（离线采集，27628 条）\n"
    "  const EC_TEXT = \"\\n\" + \"" + esc_e + "\";\n\n"
    "  // 日文名表：\"日文名|中文名\"（ff14-fc.com 等日文站用）\n"
    "  const JP2ZH_TEXT = \"\\n\" + \"" + esc_j + "\";\n\n"
    "  const SERIES_TEXT = \"\\n\" + \"" + esc_s + "\";\n\n"
    "  const RONKA_ITEM_TEXT = \"\\n\" + \"" + esc_r + "\";\n\n"
    "  const ACL_CFC_TEXT = \"\\n\" + \"" + esc_a + "\";\n\n"
    "  let itemHash = null;   // hash -> 中文名（EC / mirapri 用）\n"
    "  let nameMap = null;    // 英文名 / 日文名 -> 中文名（EC / mirapri 用）\n\n"
    "  // 单条查找：不建表，直接在主表里定位「|中文名|」那一行，约 0.7ms。\n"
    "  // wiki 页只查当前物品，走这条路可以完全避开整表解析（200ms 级阻塞）。\n"
    "  function lookupEnByZh(zh) {\n"
    "    if (!zh || typeof ITEM_DB_TEXT !== 'string' || !ITEM_DB_TEXT) return null;\n"
    "    const key = '|' + zh + '|';\n"
    "    const at = ITEM_DB_TEXT.indexOf(key);\n"
    "    if (at < 0) return null;\n"
    "    const s = at + key.length;\n"
    "    const e = ITEM_DB_TEXT.indexOf('\\n', s);\n"
    "    const v = ITEM_DB_TEXT.slice(s, e < 0 ? undefined : e);\n"
    "    return v || null;\n"
    "  }\n\n"
    "  // EC ID 单条查找：在 EC_TEXT 里定位「中文名|EC_ID」行（表短，直接 indexOf）\n"
    "  // 查不到（EC 未收录）返回 null -> EC 按钮隐藏，页面流畅。\n"
    "  function lookupEcIdByZh(zh) {\n"
    "    if (!zh || typeof EC_TEXT !== 'string' || !EC_TEXT) return null;\n"
    "    const key = '\\n' + zh + '|';\n"
    "    const at = EC_TEXT.indexOf(key);\n"
    "    if (at < 0) return null;\n"
    "    const s = at + 1 + zh.length + 1;\n"
    "    const e = EC_TEXT.indexOf('\\n', s);\n"
    "    const v = EC_TEXT.slice(s, e < 0 ? undefined : e).trim();\n"
    "    return /^\\d+$/.test(v) ? v : null;\n"
    "  }\n"
    "  function buildTables() {\n"
    "    itemHash = {}; nameMap = {};\n"
    "    const lines = ITEM_DB_TEXT.split('\\n');\n"
    "    for (let i = 0; i < lines.length; i++) {\n"
    "      const p = lines[i].split('|');\n"
    "      if (p.length < 3) continue;\n"
    "      if (p[0]) itemHash[p[0]] = p[1];\n"
    "      if (p[2]) nameMap[p[2]] = p[1];\n"
    "    }\n"
    "    const dl = NAME_TEXT.split('\\n');\n"
    "    for (let i = 0; i < dl.length; i++) {\n"
    "      const p = dl[i].split('|');\n"
    "      if (p.length >= 3 && p[1]) nameMap[p[1]] = p[2];\n"
    "    }\n"
    "  }\n\n"
    "  let tablesBuilt = false;\n"
    "  function itemDbReady(cb) {\n"
    "    if (tablesBuilt) { cb(); return; }\n"
    "    const go = () => { if (!tablesBuilt) { buildTables(); tablesBuilt = true; try { _fireTablesReady(); } catch (e) {} } cb(); };\n"
    "    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 2500 });\n"
    "    else setTimeout(go, 400);\n"
    "  }\n"
    "  /* @zhixia:data-layer-end */\n"
)

out = s[:i] + block + s[j:]

# 内嵌版不发起网络请求：剥离脚本管理器授权与外部域名白名单行（GF 外置版专用）
out = re.sub(r'^// @grant.*\n', '', out, flags=re.M)
out = re.sub(r'^// @connect.*\n', '', out, flags=re.M)

open(OUT, 'w', encoding='utf-8').write(out)

print('内嵌版已生成：%.2f MB → %s' % (os.path.getsize(OUT) / 1024 / 1024, OUT))
