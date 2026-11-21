import { readWikiReadingSettings } from '../core/wiki-reading-settings.js';

const excluded = [
  'script', 'style', 'pre', 'code', 'kbd', 'samp', 'textarea', 'input',
  'select', '[contenteditable]:not([contenteditable="false"])',
  '.mw-editsection', '.toc', '#toc', '.zhixia-reverse-block',
].join(', ');

const listSection = /列表|一览|名单|清单|目录|参考|外部链接|关联条目|相关条目|掉落|奖励|攻略|流程|步骤/u;
const storySection = /^(?:简介|概述)$|剧情|故事|生平|早年|经历|背景|事迹/u;
const narrativeOpening = /^(?:他(?!人)|[她它]|随后|此后|后来|当时|最终(?!幻想)|不久|于是|从此|次日|与此同时)(?=\p{Script=Han})/u;
const sentenceEnding = /[。！？…][」』”’）】》〉]*$/u;
const itemLabel = /^[^，。！？…：:\n]{1,16}[：:]/u;
const eventVerb = /离开|归来|离去|返[回城]|回[到来去家]|抵达|重逢|相遇|失踪|遇袭|获救|去世|醒来|倒下|解散|得知|发现|决定|加入|留下|出发|告别|沉默|走了|死了|来了|变了|平息|失散|再会|被捕|坦言|揭开|逃离/u;
const instructionOpening = /^(?:请|点击|选择|前往|返回|完成|领取|提交|购买|使用|查看|击败|收集|调查|确保|务必|建议)/u;
const timeClause = /^[^，,。！？；：\n]{2,48}(?:[前后时]|之际|期间)[，,]\s*/u;
const convertedParagraph = 'data-ff14-wiki-prose';

function fitWikiFigures() {
  const figureStyleId = 'ff14-wiki-responsive-figures';
  if (!document.getElementById(figureStyleId)) {
    const style = document.createElement('style');
    style.id = figureStyleId;
    style.textContent = `
      @media (max-width: 767px) {
        #mw-content-text table:has(> tbody:only-child > tr:only-child > td:only-child > .thumb:only-child > .thumbinner) {
          width: 100%;
          max-width: 100%;
          table-layout: fixed;
        }
        #mw-content-text .thumbinner {
          box-sizing: border-box;
          max-width: 100%;
        }
        #mw-content-text .thumbimage {
          max-width: 100%;
          height: auto;
        }
      }
    `;
    document.head.append(style);
  }
}

function styleWikiHeadings() {
  const styleId = 'ff14-wiki-heading-style';
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    #firstHeading > h1, h1#firstHeading,
    #wiki-body #mw-content-text > h2,
    #wiki-body #mw-content-text :where(.mw-parser-output, .mw-parser-output > .mw-heading) > h2 {
      --zhx-chinese-font: "Noto Serif CJK SC", "Source Han Serif SC", "Songti SC", "Noto Serif SC", SimSun, serif;
      font-family: var(--zhx-chinese-font);
      font-weight: 600;
    }
    #firstHeading > h1, h1#firstHeading {
      font-size: clamp(2rem, 1.65rem + 1.1vw, 2.5rem);
      line-height: 1.18;
      letter-spacing: .025em;
    }
    #wiki-body #mw-content-text > h2,
    #wiki-body #mw-content-text :where(.mw-parser-output, .mw-parser-output > .mw-heading) > h2 {
      padding-block: clamp(20px, 2vw, 30px) 4px;
      border-block-end: none;
      color: inherit;
      color: color-mix(in srgb, currentColor 76%, #b88b54);
      font-size: clamp(1.375rem, 1.25rem + .3vw, 1.5rem);
      line-height: 1.35;
      letter-spacing: .045em;
    }
    #wiki-body #mw-content-text > h3,
    #wiki-body #mw-content-text :where(.mw-parser-output, .mw-parser-output > .mw-heading) > h3 {
      padding-block: 12px 5px;
      color: inherit;
      font-size: clamp(1.0625rem, 1rem + .2vw, 1.1875rem);
      font-weight: 600;
      line-height: 1.4;
    }
    #wiki-body #mw-content-text > h3::before,
    #wiki-body #mw-content-text :where(.mw-parser-output, .mw-parser-output > .mw-heading) > h3::before {
      content: none;
    }
    #wiki-body #mw-content-text > :is(h2,h3) > .mw-headline,
    #wiki-body #mw-content-text :where(.mw-parser-output, .mw-parser-output > .mw-heading) > :is(h2,h3) > .mw-headline {
      font-size: inherit;
      font-weight: inherit;
    }
  `;
  document.head.append(style);
}

function plainItemText(item) {
  if (item.tagName !== 'LI' || item.attributes.length ||
    item.querySelector('ul, ol, dl, p, div, table, blockquote, figure, pre, hr')) {
    return '';
  }

  const sentence = item.innerText.trim();
  const soleLink = item.querySelector('a:only-child');
  if (itemLabel.test(sentence) || sentence === soleLink?.innerText.trim()) {
    return '';
  }
  return sentence;
}

function mainClause(text) {
  return text.replace(timeClause, '');
}

function isNarrativeFragment(clause) {
  if (clause.length < 3 || instructionOpening.test(clause)) return false;
  const verb = eventVerb.exec(clause);
  return narrativeOpening.test(clause) || (verb !== null && verb.index > 0);
}

function isCompleteSentence(text) {
  return text.length >= 4 && sentenceEnding.test(text);
}

function isNarrativeParagraph(element) {
  if (element?.tagName !== 'P' || element.hasAttribute(convertedParagraph)) return false;
  const text = element.innerText.trim();
  return isCompleteSentence(text) && !itemLabel.test(text) &&
    (text.length >= 24 || isNarrativeFragment(mainClause(text)));
}

function convertWikiProse(article) {
  const headings = [];
  const headingSelector = 'h1, h2, h3, h4, h5, h6';
  for (const child of [...article.children]) {
    const heading = child.matches('.mw-heading') ? child.querySelector(headingSelector) : child;
    if (heading?.matches(headingSelector)) {
      const level = Number(heading.tagName[1]);
      headings.length = level;
      headings[level] = (heading.querySelector('.mw-headline') || heading).innerText.trim();
      continue;
    }

    if (child.tagName !== 'UL' || child.attributes.length || child.closest(excluded) ||
      headings.some(title => listSection.test(title))) {
      continue;
    }

    const intro = child.previousElementSibling;
    if (intro?.tagName === 'P' && /[：:]$/u.test(intro.innerText.trim())) continue;

    const items = [...child.children];
    const texts = items.map(plainItemText);
    const clauses = texts.map(mainClause);
    const narrative = clauses.map(isNarrativeFragment);
    const fullProse = texts.map((text, index) => isCompleteSentence(text) &&
      !instructionOpening.test(clauses[index]) && text.length >= 24);
    const hasContext = headings.some(title => storySection.test(title)) ||
      isNarrativeParagraph(intro) || isNarrativeParagraph(child.nextElementSibling) ||
      texts.some((text, index) => fullProse[index] ||
        (narrative[index] && isCompleteSentence(text)));
    if (!hasContext) continue;

    // A mixed list requires narrative wording in each item we convert.
    const allProse = texts.every((_, index) => narrative[index] || fullProse[index]);
    const convert = narrative.map((isNarrative, index) => isNarrative || (allProse && fullProse[index]));
    if (!convert.some(Boolean)) continue;

    const replacement = document.createDocumentFragment();
    let remainingList = null;
    for (const [index, item] of items.entries()) {
      if (convert[index]) {
        const paragraph = document.createElement('p');
        paragraph.setAttribute(convertedParagraph, '');
        paragraph.append(...item.childNodes);
        replacement.append(paragraph);
        remainingList = null;
        continue;
      }
      if (!remainingList) {
        remainingList = document.createElement('ul');
        remainingList.setAttribute('data-ff14-wiki-remainder', '');
        replacement.append(remainingList);
      }
      remainingList.append(item);
    }
    child.replaceWith(replacement);
  }
}

function replaceWikiQuotes(article) {
  const text = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
  for (let node = text.nextNode(); node; node = text.nextNode()) {
    if (/[“”]/u.test(node.data) && !node.parentElement.closest(excluded)) {
      node.data = node.data.replaceAll('“', '「').replaceAll('”', '」');
    }
  }
}

function indentWikiParagraphs(article) {
  const existingIndent = /^[\t\n\r ]*[\u3000\u00A0\u2002\u2003]/u;
  const numberedStep = /^(?:[①-⑳㉑-㉟㊱-㊿]|[（(][0-9０-９一二三四五六七八九十]+[）)]|[0-9０-９]{1,3}(?:[、)）]|[.．](?![0-9０-９]))|[一二三四五六七八九十]+、)/u;
  const parallelTexts = new Set();
  for (const content of article.querySelectorAll('.tab-content')) {
    const tabs = content.previousElementSibling;
    if (!tabs?.matches('.nav-tabs')) continue;
    const labels = [...tabs.querySelectorAll('[role="tab"]')].map(tab => tab.textContent.trim());
    if (labels.some(label => /原文$/u.test(label)) && labels.some(label => /(?:译本|译文|直译)$/u.test(label))) {
      parallelTexts.add(content);
    }
  }

  const needsIndent = new Map();
  for (const paragraph of article.querySelectorAll('p')) {
    if (paragraph.closest(excluded + ', .boss-guide, .gallerytext, .thumbcaption, figcaption') ||
        parallelTexts.has(paragraph.closest('.tab-content'))) continue;
    const visibleText = paragraph.innerText;
    if (!visibleText.trim() || existingIndent.test(visibleText) || numberedStep.test(visibleText.trimStart()) ||
        Number.parseFloat(getComputedStyle(paragraph).textIndent) !== 0) continue;

    const hasBreak = !!paragraph.querySelector('br');
    let indentEachLine = hasBreak && /^[\t ]*\n/u.test(visibleText);
    if (hasBreak && visibleText.trim().includes('\n')) {
      const lines = visibleText.split('\n').filter(line => line.trim());
      // Authors sometimes use breaks between prose paragraphs. Preserve short
      // lines, instructions and other blocks whose visual alignment is intentional.
      if (!lines.every(line => line.trim().length >= 24 && /[。！？]/u.test(line) &&
          !itemLabel.test(line.trim()) && !numberedStep.test(line.trimStart()))) continue;
      indentEachLine = !lines.some(line => existingIndent.test(line));
    }
    needsIndent.set(paragraph, indentEachLine && CSS.supports('text-indent', '2em each-line') ? '2em each-line' : '2em');
  }

  if (!needsIndent.size) return;
  const indentStyleId = 'ff14-wiki-paragraph-indent';
  const indentMarker = 'data-ff14-wiki-indent';
  if (!document.getElementById(indentStyleId)) {
    const style = document.createElement('style');
    style.id = indentStyleId;
    // Reset inherited indentation without overriding a component's own styles.
    style.textContent = `
      :where(#mw-content-text p[${indentMarker}] > *) { text-indent: 0; }
      #mw-content-text > p[${indentMarker}] + ul:not([class], [id], [role], [style]),
      #mw-content-text .mw-parser-output > p[${indentMarker}] + ul:not([class], [id], [role], [style]) {
        margin-inline-start: 2em;
      }
    `;
    document.head.append(style);
  }
  for (const [paragraph, indent] of needsIndent) {
    paragraph.setAttribute(indentMarker, '');
    paragraph.style.textIndent = indent;
  }
}

export async function applyWikiReading() {
  const action = new URLSearchParams(location.search).get('action');
  if (action && action !== 'view') return;

  const content = document.getElementById('mw-content-text');
  if (!content) return;
  const article = content.querySelector('.mw-parser-output') || content;

  fitWikiFigures();
  styleWikiHeadings();
  const { proseLists, quotes, indent } = await readWikiReadingSettings();
  if (proseLists) convertWikiProse(article);
  if (quotes) replaceWikiQuotes(article);
  if (indent) indentWikiParagraphs(article);
}
