// Static pages identified by the user's 1.3.0 audit. No account operations.
import assert from 'node:assert/strict';
import { newPage, closePage, sleep } from '../helpers/cdp.mjs';
import { readDist } from '../helpers/paths.mjs';

const port=Number(process.env.ZHX_CDP_PORT||9223);
const cases=[
  ['about',['高级筛选','从截图识别装备','发现你的','与全世界分享']],
  ['faq',['常见问题','这是官方服务吗？','关于服务']],
  ['collection',['徽章','头像框','心意支持徽章']],
  ['statistics',['Miramiru 统计','热门装备前十名']],
  ['news',['网站正式上线公告','阅读更多 →']],
];
for(const [route,expected] of cases){
  const page=await newPage(port,'https://miramiru.co/en/'+route);
  const c=page.cdp;
  try{
    let ready=false;
    for(let i=0;i<50;i++){
      ready=await c.eval('!!document.querySelector("main h1")');
      if(ready)break;
      await sleep(300);
    }
    assert.ok(ready,route+' page loaded');
    await c.callFn('function(source){(0,eval)(source);}',[readDist()]);
    await sleep(1400);
    const text=await c.eval('document.querySelector("main").innerText');
    for(const phrase of expected)assert.ok(text.includes(phrase),route+': '+phrase);
    assert.ok(!text.includes('Miramiru Statistics'));
    console.log('PASS live audited static page: '+route);
  }finally{await closePage(port,page.target.id)}
}
