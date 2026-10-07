/* @phase15-module-order:sites/eorzea-collection */
/* @phase15-order-link:sites/eorzea-collection<-core/dictionary */
import { DICT_EC } from '../core/dictionary.js';
import { _zhixiaTitleKeep } from '../core/dom.js';
import { trEC } from '../core/item-resolver.js';
import { observeLocal } from '../core/observer.js';
import { safe } from '../core/runtime.js';
import { EC_ITEM_SKIP_SEL } from '../core/targets.js';
import { SKIP_TAGS } from './mirapri.js';
export { EC_PIECE_TILES, EC_SKIP_SEL, PATTERNS_EC, bindECPieceTiles, ecBusy, startEC, translateECAttrs, translateECPage, trimECNode };


  // EC 上会变动的文本（数量、时间、页数…）
  const PATTERNS_EC = [
    // 面饰页动态文案
    [/^—\s{0,8}Previous\s{1,8}(.{1,200}?)\s{0,8}—$/, (m0, x) => '— 上一个' + (DICT_EC[x] || x) + ' —'],
    [/^—\s{0,8}Next\s{1,8}(.{1,200}?)\s{0,8}—$/, (m0, x) => '— 下一个' + (DICT_EC[x] || x) + ' —'],
    // 分类标题 em-dash 包裹（— Weapon — 等）+ Shader 前缀（v1.14.2）
    [/^[—–-]\s{0,8}(.{1,200}?)\s{0,8}[—–-]$/, (m0, x) => '— ' + (DICT_EC[x] || x) + ' —'],
    [/^Shader:\s{0,8}(.{1,200})$/i, (m0, x) => '滤镜：' + (DICT_EC[x] || x)],
    // 首页统计 + 版本页动态句 + Patron 挑战名（v1.14.7）
    [/^([\d,]+) glamours have already been submitted by the community!?$/, (m0, n) => '社区已提交 ' + n + ' 套幻化！'],
    [/^PvP Series (\d+) has begun$/, (m0, n) => 'PvP 第 ' + n + ' 赛季已开始'],
    [/^(.*?)Verycold$/, (m0, p) => p + '凛冬'],
    [/^(.*?)Living Canvas$/, (m0, p) => p + '活画布'],
    [/^(.*?)Into the Void$/, (m0, p) => p + '入虚空'],
    [/^(.*?)Master of Beasts$/, (m0, p) => p + '万兽之王'],
    [/^(.*?)The Glamourer's Tale$/, (m0, p) => p + '幻化师传说'],
    // gearset 套装名：系列+职能（Phantom Vision Fending → 幻境意象御敌套装）（v1.14.5）
    [/^(Phantom Vision|Vana'dielian|Praemagitek)\s+(Fending|Maiming|Striking|Scouting|Aiming|Casting|Healing)$/, (m0, a, b) => (DICT_EC[a] || a) + (DICT_EC[b] || b) + '套装'],
    // Latest Patch - 7.5 版本选项（v1.14.5）
    [/^Latest Patch(\s*-\s*[\d.]+)?$/, (m0, v) => '最新版本' + (v || '')],
    [/^MORE\s{1,8}(.{1,200})$/, (m0, x) => '更多' + (DICT_EC[x] || x)],
    [/^GLAMOURS USING THIS\s{1,8}(.{1,200})$/, (m0, x) => '使用此' + (DICT_EC[x] || x) + '的幻化'],
    [/^PvP Series (\d+) - awarded at Level (\d+)$/, 'PvP 第 $1 赛季 - 等级 $2 奖励'],
    // 版本号标题：Patch 7.5 - Into the Mist -> 版本 7.5 - Into the Mist
    [/^Patch\s{1,8}([\d.]{1,20})(.{0,200})$/i, '版本 $1$2'],
    // 日期中文化：Oct 2nd, 2026 -> 2026年10月2日；Oct 2, 2026 -> 2026年10月2日
    [/\b([A-Z][a-z]{2})[a-z]{0,20}\.?\s{1,8}(\d{1,2})(?:st|nd|rd|th)?,\s{0,8}(\d{4})\b/g,
      (m0, mo, d, y) => { const n = ({ Jan: '1', Feb: '2', Mar: '3', Apr: '4', May: '5', Jun: '6', Jul: '7', Aug: '8', Sep: '9', Oct: '10', Nov: '11', Dec: '12' })[mo]; return n ? y + '年' + n + '月' + String(d) + '日' : m0; }],
    // 时间中文化：3:00 PM -> 15:00；12:30 AM -> 00:30
    [/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/gi,
      (m0, h, mi, ap) => {
        let hh = Number.parseInt(h, 10) % 12;
        if (/pm/i.test(ap)) hh += 12;
        return (hh < 10 ? '0' + hh : String(hh)) + ':' + mi;
      }],
    [/^([\d,]+) glamours? have already been submitted by the community\.?$/i, '社区已提交 $1 个幻化'],
    [/^([\d,]+) chocobos? have already been glamoured by the community!?$/i, '社区已幻化 $1 只陆行鸟！'],
    [/^Patch ([\d.]+) Update$/i, '版本 $1 更新'],
    [/^— Latest Lodestone News —$/, '— 最新 Lodestone 新闻 —'],
    [/^— Latest Updates —$/, '— 最新更新 —'],
    [/Showing\s+([\d,]+)\s*-\s*([\d,]+)\s+of\s+([\d,]+)/g, '显示 $1–$2 / 共 $3 条'],
    [/^([\d,]+)\s+glamours?\s+found$/i, '找到 $1 套幻化'],
    [/^([\d,]+)\s+results?$/i, '共 $1 条结果'],
    [/^(\d+)\s+Loves?$/i, '$1 点赞'],
    [/^(\d+)\s+Comments?$/i, '$1 评论'],
    [/^(\d+)\s+Views?$/i, '$1 浏览'],
    [/^Page\s+(\d+)$/i, '第 $1 页'],
    [/^Submitted\s+(\d+)\s+years?\s+ago$/i, '$1 年前投稿'],
    [/^Submitted\s+(\d+)\s+months?\s+ago$/i, '$1 个月前投稿'],
    [/^Submitted\s+(\d+)\s+days?\s+ago$/i, '$1 天前投稿'],
    [/^(\d+)\s+years?\s+ago$/i, '$1 年前'],
    [/^(\d+)\s+months?\s+ago$/i, '$1 个月前'],
    [/^(\d+)\s+days?\s+ago$/i, '$1 天前'],
    [/^(\d+)\s+hours?\s+ago$/i, '$1 小时前'],
    [/^Up to\s{1,8}(.{1,200})$/i, '$1 以下'],
    [/^Loading\s*\.\.\.$/i, '加载中…'],
    [/^MORE GLAMOURS BY\s{1,8}(.{1,200})$/i, '该作者的更多幻化'],
    [/^All from\s{1,8}(.{1,200})$/i, '来自 $1 的全部'],
    [/^([\d,]+)\s+glamours?$/i, '$1 套幻化'],
    [/^Showing\s+([\d,]+)\s+of\s+([\d,]+)$/i, '显示 $1 / 共 $2 条'],
    [/^(Au Ra|Hyur|Elezen|Miqo'te|Lalafell|Roegadyn|Viera|Hrothgar)\s+Female$/i,
      (m, r) => (DICT_EC[r] || r) + '女性'],
    [/^(Au Ra|Hyur|Elezen|Miqo'te|Lalafell|Roegadyn|Viera|Hrothgar)\s+Male$/i,
      (m, r) => (DICT_EC[r] || r) + '男性'],
  ];

  // 用户产出的内容：绝不翻译
  const EC_SKIP_SEL = [
    '.c-glamour-grid-item-content-title',
    '.c-glamour-grid-item-content-author',
    '[class*="s-glamour-description"]',
    '[class*="s-glamour-title"]',
    '[class*="c-comment"]',
    '[class*="s-comment"]',
    '[contenteditable="true"]',
  ].join(',');

  function trimECNode(node) {
    const raw = node.nodeValue;
    if (!raw?.trim()) return;
    const p = node.parentElement;
    if (p?.closest?.(EC_SKIP_SEL)) return;
    // 装备名 / 卡片文本归物品链（zhApply*）处理：文本链避让，否则文本被抢先翻成
    // 中文后物品链会因「原文不再匹配」跳过，导致链接改写 / 包装 / 标记不生效
    if (p?.closest?.(EC_ITEM_SKIP_SEL)) return;
    const next = trEC(raw);
    if (next !== raw) {
      if (p && !p.title) { p.title = raw.trim(); _zhixiaTitleKeep.add(p); }
      node.nodeValue = next;
    }
  }

  let ecBusy = false; // NOSONAR — 页面扫描期间的重入保护状态

  function translateECAttrs(rootArg) {
    const attrRoot = rootArg?.querySelectorAll ? rootArg : document;
    ['alt', 'aria-label'].forEach((attr) => {
      attrRoot.querySelectorAll('[' + attr + ']').forEach((el) => {
        const flag = 'zhixiaA' + (attr === 'alt' ? 'lt' : 'Lbl');
        if (el.dataset[flag]) return;
        const v = el.getAttribute(attr);
        if (!v || v.length < 2 || v.length > 90) return;
        const nv = trEC(v);
        if (nv !== v) {
          el.setAttribute(attr, nv);
          el.dataset[flag] = '1';
        }
      });
    });
    document.querySelectorAll('[title]').forEach((el) => {
      if (_zhixiaTitleKeep.has(el)) return;
      if (el.dataset.zhixiaTitleDone) return;
      const v = el.getAttribute('title');
      if (!v || v.length < 2 || v.length > 90) return;
      const nv = trEC(v);
      if (nv !== v) {
        el.setAttribute('title', nv);
        el.dataset.zhixiaTitleDone = '1';
      }
    });
  }

  function translateECPage(rootArg) {
    if (ecBusy) return;
    ecBusy = true;
    try {
      const root = rootArg || document.body || document.documentElement;
      if (!root) return;
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode: (n) => {
          if (n.nodeType === 1) {
            if (SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
            // 选择器级剪枝：忽略区域整棵子树不再进入（v1.11.1，借 github-chinese FILTER_REJECT）
            if (n.closest?.(EC_SKIP_SEL)) return NodeFilter.FILTER_REJECT;
            // 同 trimECNode：物品链管辖的子树（装备名 / 卡片）不在文本链处理
            if (n.closest?.(EC_ITEM_SKIP_SEL)) return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const batch = [];
      while (w.nextNode()) batch.push(w.currentNode);
      for (const n of batch) {
        if (n.nodeType === 3) trimECNode(n);
        else if (n.tagName === 'INPUT') {
          const ph = n.getAttribute('placeholder');
          if (ph) { const nn = trEC(ph); if (nn !== ph) n.setAttribute('placeholder', nn); }
        }
      }
      translateECAttrs();
    } finally {
      ecBusy = false;
    }
  }

  // v1.14.7：Gearsets 下拉部位导航图（PNG 文字烧录）→ 图上叠中文
  const EC_PIECE_TILES = {
    'banner-entire-set.png': '整套',
    'banner-head-piece.png': '头部',
    'banner-body-piece.png': '身体',
    'banner-hands-piece.png': '手部',
    'banner-legs-piece.png': '腿部',
    'banner-feet-piece.png': '脚部',
    'banner-accessories.png': '饰品',
    'banner-ear-piece.png': '耳部',
    'banner-neck-piece.png': '颈部',
    'banner-wrist-piece.png': '腕部',
    'banner-ring-piece.png': '手指',
  };
  function bindECPieceTiles() {
    let changed = false;
    document.querySelectorAll('a > img[src*="/pages/header/banner-"]').forEach((img) => {
      const a = img.parentElement;
      if (!a || a.dataset.zhixiaPiece) return;
      const m = /banner-[\w-]+\.png/.exec(img.getAttribute('src') || '');
      const zh = m && EC_PIECE_TILES[m[0]];
      if (!zh) return;
      a.dataset.zhixiaPiece = '1';
      changed = true;
      a.style.position = a.style.position || 'relative';
      a.style.display = a.style.display || 'block';
      a.style.overflow = 'hidden';
      const sp = document.createElement('span');
      sp.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:inline-flex;align-items:center;justify-content:center;padding:4px 14px;background:rgba(18,10,12,.62);backdrop-filter:blur(5px) saturate(1.2);-webkit-backdrop-filter:blur(5px) saturate(1.2);border:1px solid rgba(255,255,255,.28);border-radius:8px;font-weight:900;font-size:15px;letter-spacing:3px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.8),0 0 10px rgba(0,0,0,.5);pointer-events:none;z-index:2;white-space:nowrap;';
      sp.textContent = zh;
      a.appendChild(sp);
    });
    return changed;
  }

  function startEC() {
    safe(translateECPage, 'EC 全扫')();
    safe(bindECPieceTiles, 'EC 部位图')();
    observeLocal((nodes) => {
      for (const n of nodes) safe(translateECPage, 'EC 局部')(n);
      safe(bindECPieceTiles, 'EC 部位图')();
    }, 300);
    // 数据就绪补扫由 Site Adapter 统一登记（见 SITE_REGISTRY 的 onDataReady）
  }
