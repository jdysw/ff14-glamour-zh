const AUTHORED = '.post-title,.post-content,.post-author,.post-user-name,.post-box-hover p,' +
    '.post-thumbnail,.user-content,.user-description,.author-description,.comment-body,.comment-content,' +
    '.username,.nickname,.concept-title,.concept-description,[class*="userComment"],' +
    '[class*="creatorComment"],[data-user-content],[contenteditable]:not([contenteditable="false"])';

function isEndClosetAuthored(element) {
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

// Authored text must not become UI or an item merely by matching a dictionary.
export function isAuthoredContent(element, site) {
  if (!element) return false;
  if (element.closest('.post-item-information,.item-color-information,.item-image,a.eorzeadb_link')) return false;
  if (element.closest(AUTHORED)) return true;
  if (site === 'ronka') return !!element.closest('.post-subtitle-box a');
  if (site === 'endcloset') return isEndClosetAuthored(element);
  return site === 'miramiru' && isMiramiruAuthored(element);
}
