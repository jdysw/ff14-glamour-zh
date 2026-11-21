import assert from 'node:assert/strict';
import { newPage, closePage } from '../helpers/cdp.mjs';
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
        <main id="mw-content-text"><div class="mw-parser-output">
        <h2>剧情</h2>
        <p id="plain">“正文”</p>
        <ul><li>她离开了</li><li>前往营地</li></ul>
        <div class="boss-guide"><p id="skill">“攻击”<br>“电磁力”</p></div>
        <table style="width:100%"><tr><td><div class="thumb"><div class="thumbinner" style="width:502px">
          <img class="thumbimage" width="500" height="281" alt="">
        </div></div></td></tr></table>
        </div></main>
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
      figureFits: document.querySelector('table').getBoundingClientRect().right <= innerWidth,
    })`);
  }

  const defaults = {
    quotes: '「正文」', indent: '2em', prose: '她离开了',
    list: '前往营地', skillIndent: '', figureFits: true,
  };
  assert.deepEqual(await refreshAndRead(), defaults);

  for (const [key, expected] of [
    ['quotes', { ...defaults, quotes: '“正文”' }],
    ['indent', { ...defaults, indent: '' }],
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
    assert.deepEqual(await refreshAndRead(), expected, key);
  }
  console.log('PASS Wiki 阅读排版默认开启、分别关闭、刷新后持久化，窄屏宽图始终适配');
} finally {
  await closePage(port, page.target.id);
}
