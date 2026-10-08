// tests/helpers/clean-text.mjs — 现场文本收集（排除广告/脚本等「不扫描容器」）
// 与脚本扫描范围对齐（skip 选择器与 ACL_SKIP_SEL 等站层实现一致）：
//   script, style, noscript, textarea, ins, .adsbygoogle, [class*="ads-"], [id*="aswift"]
// 用途：live 测试的「残留检查」取值——AdSense 广告内容随时段随机变化，
//       纳入检查会产生假阳性（2026-10-08 实测：广告命中「ゲーム内アイテム」使 test-acl-1 假红）。
// 用法：const r = await c.eval(`(() => { const T = ${CLEAN_BODY_TEXT}; ... })()`);
export const CLEAN_BODY_TEXT = `(() => {
  const skipSel = 'script, style, noscript, textarea, ins, .adsbygoogle, [class*="ads-"], [id*="aswift"]';
  if (!document.body) return '';
  const parts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const el = n.parentElement;
    if (el && el.closest && el.closest(skipSel)) continue;
    parts.push(n.textContent);
  }
  return parts.join(' ');
})()`;
