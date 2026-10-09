// Based on nine real Mirapri pages in the Oct 9 manual DOM export.
// Exercise actual adapter functions and guard against translating user content.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dict = name => JSON.parse(fs.readFileSync(path.join(root,'dict',name),'utf8')).entries;
const DICT = { ...dict('dict-common.json'), ...dict('dict-main.json') };
const src = fs.readFileSync(path.join(root,'src/sites/mirapri.js'),'utf8')
  .split('\n').filter(line => !/^import |^export /.test(line)).join('\n');
const document = { title:'ファッションチェック | MIRAPRI SNAP', documentElement:{} };
const exposed = new Function('DICT','document','createObserver','safe','_markScan','localScope','NodeFilter',
  src + '\nreturn {tr,trNode,trEl,translatePage,translateMirapriTitle,startMirapri};')
  (DICT,document,()=>({disconnect(){}}),fn=>fn,()=>{},root=>root,
    {FILTER_REJECT:2,FILTER_ACCEPT:1,SHOW_TEXT:4,SHOW_ELEMENT:1});
function elem(tag,attrs={},authored=false) {
  const store={...attrs};
  return { nodeType:1,tagName:tag,dataset:{},
    getAttribute:key=>store[key]??null,
    setAttribute:(key,val)=>{store[key]=val;},
    closest:selector=>authored&&selector.includes('#gallery article')?{}:null,
    hasAttribute:key=>Object.hasOwn(store,key),
  };
}
const checks = [
 ['メールアドレス','电子邮箱'],
 ['お問い合わせ種別','咨询类型'],
 ['投稿された画像について','关于已发布的图片'],
 ['ガイドラインについて','关于投稿指南'],
 ['投稿時のルール','投稿规则'],
 ['管理人からのごあいさつ','管理员寄语'],
 ['通報機能について','关于举报功能'],
 ['Previous slide','上一张图片'],
 ['Next slide','下一张图片'],
];
for(const [raw,zh] of checks) assert.equal(exposed.tr(raw),zh,raw);
const guide = 'MIRAPRI SNAPは、ミラプリをより身近に楽しんでもらえることをコンセプトに作ったギャラリーサイトです。';
assert.match(exposed.tr(guide), /幻化作品展示网站/);
const about = '当サイトでは「Googleアナリティクス」を利用しています。このGoogleアナリティクスはトラフィックデータの収集のためにCookieを使用します。このトラフィックデータは匿名で収集されており、個人を特定するものではありません。この機能はCookieを無効にすることで収集を拒否することが出来ますので、お使いのブラウザの設定をご確認ください。';
assert.match(exposed.tr(about), /匿名数据/);
const nav = elem('A',{title:'投稿する','aria-label':'Next slide'});
exposed.trEl(nav);
assert.equal(nav.getAttribute('title'),'发布幻化');
assert.equal(nav.getAttribute('aria-label'),'下一张图片');
const action = elem('INPUT',{type:'submit',value:'送信内容を確認する'});
exposed.trEl(action);
assert.equal(action.getAttribute('value'),'确认提交内容');
const typed = elem('INPUT',{type:'text',value:'投稿された画像について',placeholder:'例) エクスカリバー'});
exposed.trEl(typed);
assert.equal(typed.getAttribute('value'),'投稿された画像について','do not modify user-entered field values');
assert.equal(typed.getAttribute('placeholder'),'例如：石中剑');
const post = elem('H2',{},true);
const title = {nodeType:3,nodeValue:'侍',parentElement:post};
exposed.trNode(title);
assert.equal(title.nodeValue,'侍','user-created titles must stay Japanese');
const thumb = elem('IMG',{alt:'投稿された画像について'},true);
exposed.trEl(thumb);
assert.equal(thumb.getAttribute('alt'),'投稿された画像について','post thumbnail alt is user content');
const fixed = elem('SPAN');
const label = {nodeType:3,nodeValue:'投稿する',parentElement:fixed};
exposed.trNode(label);
assert.equal(label.nodeValue,'发布幻化');
assert.equal(fixed.getAttribute('title'),null,'never synthesize original-language hover tooltip');
assert.equal(fixed.dataset.zhixiaSourceText,'投稿する','retain diagnostic source text');
document.title='ファッションチェック | MIRAPRI SNAP';
exposed.translateMirapriTitle();
assert.equal(document.title,'ファッションチェック | MIRAPRI SNAP');
document.title='白銀用スチパンミラプリ | MIRAPRI SNAP';
exposed.translateMirapriTitle();
assert.equal(document.title,'白銀用スチパンミラプリ | MIRAPRI SNAP');
console.log('✅ Mirapri manual audit: nine-page UI, authored content, attributes, tooltip regression');
