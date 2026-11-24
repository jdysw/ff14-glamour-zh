const AUTHORED = '.post-title,.post-content,.post-author,.post-user-name,.post-box-hover p,' +
    '.post-thumbnail,.user-content,.user-description,.author-description,.comment-body,.comment-content,' +
    '.username,.nickname,.concept-title,.concept-description,[class*="userComment"],' +
    '[class*="creatorComment"],[data-user-content],[contenteditable]:not([contenteditable="false"])';

function isEndClosetAuthored(element) {
  // Concept cards use creator titles even when the title matches an item name.
  const card = element.closest('.group.cursor-pointer');
  if (card?.querySelector('h3') && card.querySelector('img')) {
    if (element.closest('h3') || element.tagName === 'IMG') return true;
  }
  if (element.closest('.whitespace-pre-wrap,.whitespace-pre-line')) return true;
  const author = element.closest('button[title]');
  return !!author && /^(?:作者|작성자|Author)\s*[:：]/i.test(author.title)
    && element !== author && element !== author.firstElementChild;
}

function isMiramiruAuthored(element) {
  if (element.closest('a[href*="/users/"],a[href*="/tags/"],a[href*="/mirapuri/"]')) return true;
  if (/\/(?:mirapuri|users)\//.test(location.pathname)
    && element.closest('h1,main .whitespace-pre-wrap')) return true;
  if (element.closest('h3') || element.tagName === 'IMG') {
    for (let parent = element.parentElement, depth = 0; parent && depth < 3; parent = parent.parentElement, depth++) {
      if (parent.querySelector('a[href*="/mirapuri/"]')) return true;
    }
  }
  return false;
}

// EC detail and related-work links carry creator-owned names, even when
// those names happen to match a UI label or an actual equipment item.
export function isECAuthoredPath(path) {
  return /^\/(?:glamour|companion-glamour|creator)\/\d+(?:[/?#]|$)/u.test(path || '');
}

function isECContext() {
  const host = globalThis.location?.hostname;
  return !host || host === 'ffxiv.eorzeacollection.com' || globalThis.window?.__zhxTestSite === 'ec';
}

function ecLinkPath(element) {
  const href = element?.closest?.('a[href]')?.getAttribute?.('href') || '';
  return href.replace(/^https:\/\/ffxiv\.eorzeacollection\.com(?=\/)/iu, '');
}

// Native catalogue destinations retain their site links rather than becoming Wiki links.
export function isECSeriesLink(element) {
  return isECContext() && /^\/(?:gearset|accessories|facewear|fashion-accessory)\/[^/?#]+(?:[/?#]|$)/u.test(ecLinkPath(element));
}

function isECWorkDescription(element) {
  const heading = element.closest('div.box')?.previousElementSibling;
  if (!heading?.matches('div.divider, h2.minititle')) return false;
  // EC uses a plain box after the Description heading in both layouts.
  // The heading itself may already have been localized by an earlier pass.
  return /^(?:[—–-]\s*)?(?:Description|描述)(?:\s*[—–-])?$/u.test(heading.textContent.trim());
}

export function isECAuthoredContent(element) {
  if (!element?.closest || !isECContext()) return false;
  if (element.closest('.c-glamour-grid-item-content-title,.c-glamour-grid-item-content-author,[class*="s-glamour-description"],[class*="s-glamour-title"],[class*="s-companion-glamour-description"],[class*="s-companion-glamour-title"]')) return true;
  if (isECAuthoredPath(ecLinkPath(element))) return true;
  const path = globalThis.location?.pathname || '';
  if (/^\/creator\/\d+(?:\/|$)/u.test(path)) {
    // The main follower-list heading contains UI text; only the sidebar
    // contains the authored profile name, biography and portrait.
    return !!element.closest('aside :is(h1.title.has-negative-letter-spacing, p.content.has-text-light.mt-4.mb-2.pt-2, .image.is-relative img[alt])');
  }
  if (!isECAuthoredPath(path)) return false;
  return !!element.closest('h1.title.has-negative-letter-spacing') || isECWorkDescription(element);
}

// Authored text must not become UI or an item merely by matching a dictionary.
export function isAuthoredContent(element, site) {
  if (!element) return false;
  if (element.closest('.post-item-information,.item-color-information,.item-image,a.eorzeadb_link')) return false;
  if (element.closest(AUTHORED)) return true;
  if (site === 'ronka') return !!element.closest('.post-subtitle-box a, .post-image, a.post-sns');
  if (site === 'endcloset') return isEndClosetAuthored(element);
  if (site === 'ec') return isECAuthoredContent(element);
  return site === 'miramiru' && isMiramiruAuthored(element);
}
