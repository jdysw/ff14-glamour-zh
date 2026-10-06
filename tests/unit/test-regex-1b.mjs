// 1B 正则行为验证：有界化后的新形态与语义预期
let pass = 0, fail = 0;
const t = (name, actual, expected) => {
  if (actual === expected) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}\n     得到: ${JSON.stringify(actual)}\n     期望: ${JSON.stringify(expected)}`); }
};

// ── 月份（S5843 化简版）──
const monthRe = /\b([A-Z][a-z]{2})[a-z]{0,20}\.?\s{1,8}(\d{1,2})(?:st|nd|rd|th)?,\s{0,8}(\d{4})\b/g;
const monFn = (m0, mo, d, y) => { const n = ({ Jan: '1', Feb: '2', Mar: '3', Apr: '4', May: '5', Jun: '6', Jul: '7', Aug: '8', Sep: '9', Oct: '10', Nov: '11', Dec: '12' })[mo]; return n ? y + '年' + n + '月' + String(d) + '日' : m0; };
t('Oct 2nd, 2026', 'Oct 2nd, 2026'.replace(monthRe, monFn), '2026年10月2日');
t('Oct 2, 2026', 'Oct 2, 2026'.replace(monthRe, monFn), '2026年10月2日');
t('January 15, 2025', 'January 15, 2025'.replace(monthRe, monFn), '2025年1月15日');
t('Dec. 31, 2024', 'Dec. 31, 2024'.replace(monthRe, monFn), '2024年12月31日');
t('非月份不误伤 Test 12, 2024', 'Test 12, 2024'.replace(monthRe, monFn), 'Test 12, 2024');
t('句中日期', 'Posted Jun 3rd, 2022 by'.replace(monthRe, monFn), 'Posted 2022年6月3日 by');

// ── Patch 标题 ──
t('Patch 7.5 - Into the Mist', 'Patch 7.5 - Into the Mist'.replace(/^Patch\s{1,8}([\d.]{1,20})(.{0,200})$/i, '版本 $1$2'), '版本 7.5 - Into the Mist');

// ── MORE / Up / All ──
t('MORE Glamours', 'MORE Glamours'.replace(/^MORE\s{1,8}(.{1,200})$/, (m0, x) => '更多' + x), '更多Glamours');
t('Up to 100', 'Up to 100'.replace(/^Up to\s{1,8}(.{1,200})$/i, '$1 以下'), '100 以下');
t('All from Bob', 'All from Bob'.replace(/^All from\s{1,8}(.{1,200})$/i, '来自 $1 的全部'), '来自 Bob 的全部');
t('MORE GLAMOURS BY Xen', 'MORE GLAMOURS BY Xen'.replace(/^MORE GLAMOURS BY\s{1,8}(.{1,200})$/i, '该作者的更多幻化'), '该作者的更多幻化');

// ── Previous/Next/分类标题/Shader ──
t('— Previous Foo —', '— Previous Foo —'.replace(/^—\s{0,8}Previous\s{1,8}(.{1,200}?)\s{0,8}—$/, (m0, x) => '— 上一个' + x + ' —'), '— 上一个Foo —');
t('— Next Bar —', '— Next Bar —'.replace(/^—\s{0,8}Next\s{1,8}(.{1,200}?)\s{0,8}—$/, (m0, x) => '— 下一个' + x + ' —'), '— 下一个Bar —');
t('— Weapon —', '— Weapon —'.replace(/^[—–-]\s{0,8}(.{1,200}?)\s{0,8}[—–-]$/, (m0, x) => '— ' + x + ' —'), '— Weapon —');
t('Shader: Standard', 'Shader: Standard'.replace(/^Shader:\s{0,8}(.{1,200})$/i, (m0, x) => '滤镜：' + x), '滤镜：Standard');

// ── 染剂（4208/4380 新形态）──
const dyeRe = /^([\u25EF\u2B24\u25CB\u25CF])\s{0,8}(.{1,200})$/;
const dm = dyeRe.exec('⬤ Ink Blue');
t('染剂 ⬤ Ink Blue', dm && dm[2].trim(), 'Ink Blue');
const dm2 = dyeRe.exec('○ Undyed');
t('染剂 ○ Undyed', dm2 && dm2[2].trim(), 'Undyed');

// ── ACL_DECOR_TAIL ──
t('ACL tail 剥离', '名称★★※ '.replace(/[\s\u00a0※◆■□●○▲△☆★]{1,64}$/, ''), '名称');
t('ACL tail 无装饰', '名称'.replace(/[\s\u00a0※◆■□●○▲△☆★]{1,64}$/, ''), '名称');

console.log(`\n${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
