import assert from 'node:assert/strict';
import { newPage, closePage } from '../helpers/cdp.mjs';
import { beginBrowserCoverage, endBrowserCoverage } from '../helpers/browser-coverage.mjs';
import { fixtureUrl, readDist } from '../helpers/paths.mjs';

const port = Number(process.env.ZHX_CDP_PORT || 9223);
const page = await newPage(port, fixtureUrl('wiki-nonitem.html'));
const { cdp } = page;
const bundle = readDist();

try {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__zhxTestSite = 'wiki';
    window.__wikiSettingsMenu = new Map();
    window.GM_registerMenuCommand = (label, callback) => window.__wikiSettingsMenu.set(label, callback);
    window.GM_getValue = (key, fallback) => sessionStorage.getItem(key) ?? fallback;
    window.GM_setValue = (key, value) => sessionStorage.setItem(key, value);
    window.GM_xmlhttpRequest = request => request.onerror?.({});
    document.addEventListener('DOMContentLoaded', () => {
      document.body.innerHTML = \`
        <div id="wiki-body">
        <header id="firstHeading"><h1>词条标题</h1></header>
        <main id="mw-content-text"><div class="mw-parser-output">
        <style>
          #wiki-body h2 { border-bottom: none; color: brown; padding-top: 50px; }
          .mw-parser-output h3::before { content: '■'; }
        </style>
        <h2>剧情</h2>
        <p id="plain">“正文”</p>
        <ul><li>她离开了</li><li>前往营地</li></ul>
        <style>.mw-parser-output ul { margin-inline-start: 1.6em; padding-inline-start: 0; }</style>
        <h2>列表对齐</h2>
        <p id="list-intro">下面列出三种极限槽规则。</p>
        <ul><li>四人以下队伍</li><li>满编队伍<ul id="nested-list"><li>副本条件</li></ul></li></ul>
        <h3 id="standalone-heading">独立列表</h3>
        <ul><li>道具名称</li></ul>
        <div class="boss-guide"><h3 id="skill-heading">技能说明</h3><p id="skill">“攻击”<br>“电磁力”</p></div>
        <h2>宝石兽的叫声</h2>
        <p id="cries">咕咕<small>摩杜纳小红的叫声</small><br>吱吱<br>呜。<br></p>
        <p id="method">听到宝石兽叫声的方法：<br><small>①携宝石兽从高处摔落。</small></p>
        <p id="numbered"><small>②召唤/收回你的宝石兽/宝石兽坐骑。</small></p>
        <p id="decimal">6.35 版本中的宝石兽仍然可以协助作战。</p>
        <p id="trailing-break">普通段落。<br></p>
        <p id="inline">正文含有<span id="item-link" style="display:inline-block"><span id="item-name" style="display:inline-block">水晶砂</span></span>和<span id="authored-indent" style="display:inline-block;text-indent:5px">硬灵性岩</span>。</p>
        <h2>阿尔菲诺的宝石兽进化史</h2>
        <p id="evolution"><a href="#summon">阿尔菲诺</a>所召唤出的宝石兽与常见的宝石兽有着明显的不同。<br>在伊修加德遭遇袭击时他第一次召唤出了自己的红宝石兽。(使用技能「利爪」)<br></p>
        <p id="leading-break"><br>空行之后的普通正文。</p>
        <ul class="nav nav-tabs" role="tablist"><li><a role="tab">创世神话文艺译本</a></li><li><a role="tab">日文原文</a></li></ul>
        <div class="tab-content"><div class="tab-pane"><br><i>初时未见有光暗之分，世界混沌。</i>
          <p id="myth-line"><i>混沌之中首现阿尔基克，始作时刻。</i></p>
          <p id="myth-after-break"><br><i>昼夜交替不知几何，混沌之中再现神明。</i></p>
        </div><div class="tab-pane" hidden><p id="myth-original">はじめに光も闇もなく。</p></div></div>
        <ul class="nav nav-tabs" role="tablist"><li><a role="tab">详细介绍</a></li><li><a role="tab">相关信息</a></li></ul>
        <div class="tab-content"><div class="tab-pane"><p id="normal-tab">普通标签页的正文。</p></div></div>
        <ul class="gallery"><li class="gallerybox"><div><div class="gallerytext"><p id="gallery-caption"><span>版本 5.0</span>的宝石兽攻击动作</p></div></div></li></ul>
        <table style="width:100%"><tr><td><div class="thumb"><div class="thumbinner" style="width:502px">
          <img class="thumbimage" width="500" height="281" alt="">
          <div class="thumbcaption"><p id="thumb-caption">宝石兽的图片说明</p></div>
        </div></div></td></tr></table>
        </div></main></div>
      \`;
    }, { once: true });
    ${bundle}
  ` });

  async function refreshAndRead() {
    await cdp.send('Page.reload', { ignoreCache: true });
    await cdp.waitFor("document.readyState === 'complete' && !!document.querySelector('#ff14-wiki-responsive-figures')");
    return cdp.eval(`({
      quotes: document.querySelector('#plain').textContent,
      indent: document.querySelector('#plain').style.textIndent,
      prose: document.querySelector('[data-ff14-wiki-prose]')?.textContent ?? null,
      list: document.querySelector('.mw-parser-output ul').textContent,
      skillIndent: document.querySelector('#skill').style.textIndent,
      criesIndent: document.querySelector('#cries').style.textIndent,
      methodIndent: document.querySelector('#method').style.textIndent,
      trailingBreakIndent: document.querySelector('#trailing-break').style.textIndent,
      inlineParagraphIndent: document.querySelector('#inline').style.textIndent,
      evolutionIndent: document.querySelector('#evolution').style.textIndent,
      leadingBreakIndent: document.querySelector('#leading-break').style.textIndent,
      mythIndents: ['myth-line', 'myth-after-break', 'myth-original'].map(id => document.getElementById(id).style.textIndent),
      normalTabIndent: document.querySelector('#normal-tab').style.textIndent,
      introList: getComputedStyle(document.querySelector('#list-intro').nextElementSibling).marginInlineStart,
      nestedList: getComputedStyle(document.querySelector('#nested-list')).marginInlineStart,
      independentList: getComputedStyle(document.querySelector('#standalone-heading').nextElementSibling).marginInlineStart,
      navigationList: getComputedStyle(document.querySelector('.nav-tabs')).marginInlineStart,
      galleryList: getComputedStyle(document.querySelector('.gallery')).marginInlineStart,
      titleWeights: ['#firstHeading h1', '.mw-parser-output > h2', '#standalone-heading'].map(selector =>
        getComputedStyle(document.querySelector(selector)).fontWeight),
      headingMarkers: ['#standalone-heading', '#skill-heading'].map(selector =>
        getComputedStyle(document.querySelector(selector), '::before').content),
      h2Border: getComputedStyle(document.querySelector('.mw-parser-output > h2')).borderBottomWidth,
      decimalIndent: document.querySelector('#decimal').style.textIndent,
      preservedIndents: ['numbered', 'gallery-caption', 'thumb-caption'].map(id => document.getElementById(id).style.textIndent),
      itemIndents: ['item-link', 'item-name', 'authored-indent'].map(id => getComputedStyle(document.getElementById(id)).textIndent),
      figureFits: document.querySelector('table').getBoundingClientRect().right <= innerWidth,
    })`);
  }

  const supportsEachLine = await cdp.eval("CSS.supports('text-indent', '2em each-line')");
  const defaults = {
    quotes: '「正文」', indent: '2em', prose: '她离开了',
    list: '前往营地', skillIndent: '', criesIndent: '', methodIndent: '',
    trailingBreakIndent: '2em', figureFits: true,
    inlineParagraphIndent: '2em', itemIndents: ['0px', '0px', '5px'],
    evolutionIndent: supportsEachLine ? '2em each-line' : '2em',
    leadingBreakIndent: supportsEachLine ? '2em each-line' : '2em',
    mythIndents: ['', '', ''], normalTabIndent: '2em',
    introList: '32px', nestedList: '25.6px', independentList: '25.6px',
    navigationList: '25.6px', galleryList: '25.6px',
    titleWeights: ['700', '700', '650'], headingMarkers: ['none', '"■"'], h2Border: '1px',
    decimalIndent: '2em', preservedIndents: ['', '', ''],
  };
  assert.deepEqual(await refreshAndRead(), defaults);

  for (const [key, expected] of [
    ['quotes', { ...defaults, quotes: '“正文”' }],
    ['indent', { ...defaults, indent: '', trailingBreakIndent: '', inlineParagraphIndent: '', evolutionIndent: '', leadingBreakIndent: '', normalTabIndent: '', introList: '25.6px', decimalIndent: '' }],
    ['proseLists', { ...defaults, prose: null, list: '她离开了前往营地' }],
  ]) {
    await cdp.eval("window.__wikiSettingsMenu.get('Wiki 阅读排版设置')()");
    assert.equal(await cdp.eval("document.querySelectorAll('#zhx-tools-panel input[type=checkbox]').length"), 3);
    await cdp.callFn(`function (key) {
      const panel = document.querySelector('#zhx-tools-panel');
      for (const input of panel.querySelectorAll('input')) input.checked = input.name !== key;
      [...panel.querySelectorAll('button')].find(button => button.textContent === '保存设置').click();
    }`, [key]);
    await cdp.waitFor("document.querySelector('#zhx-tools-panel [role=status]').textContent.includes('设置已保存')");
    // Chromium drops compiled scripts on reload, so save the current execution first.
    await endBrowserCoverage(cdp, `${page.target.id}-${key}`);
    await beginBrowserCoverage(cdp);
    assert.deepEqual(await refreshAndRead(), expected, key);
  }
  console.log('PASS Wiki 阅读排版默认开启、分别关闭、刷新后持久化，窄屏宽图始终适配');
} finally {
  await closePage(port, page.target.id);
}
