// decor-regex-test.mjs — 验证 FC_DECOR 正则加 u 后的装饰剥离行为
const H = /^[\s|｜<＜≪«◀◁▷●○★☆🎉✨👗💍🛡💬]+/u;
const T = /[\s|｜>＞≫»▶▽◆■□●○★☆♪！!。、…😊✨🎉]{1,64}$/u;

const cases = [
  ['🎉装备名', '装备名'],
  ['装备名✨', '装备名'],
  ['👗【FF14】测试', '【FF14】测试'],
  ['普通文本', '普通文本'],
  ['🛡新装备😊', '新装备'],
  ['≫ 夜桜上衣', '≫ 夜桜上衣'], // ≫ 不在 HEAD 字符集（设计如此：右向符号归 TAIL），此行验证不误剥
  ['夜桜上衣 ≫', '夜桜上衣'],
  ['▷ 装备名', '装备名'], // ▷ 在 HEAD 字符集
  ['夜桜上衣 »', '夜桜上衣'],
  ['✨✨多装饰✨✨', '多装饰'],
];

let pass = 0, fail = 0;
for (const [input, want] of cases) {
  const got = input.replace(H, '').replace(T, '').trim();
  if (got === want) { pass++; console.log(`  ✅ ${JSON.stringify(input)} → ${JSON.stringify(got)}`); }
  else { fail++; console.log(`  ❌ ${JSON.stringify(input)} → ${JSON.stringify(got)}（期望 ${JSON.stringify(want)}）`); }
}
console.log(`\n${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
