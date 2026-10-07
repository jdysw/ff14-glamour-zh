/* @phase15-module-order:core/translator */
/* @phase15-order-link:core/translator<-core/site-registry */
import './site-registry.js';
import { trEC } from './item-resolver.js';
import { translateECAttrs, trimECNode } from '../sites/eorzea-collection.js';
import { _wowFCInput, trFC, trimFCNode } from '../sites/ff14-fc.js';
import { trACL, trimACLNode } from '../sites/ffxiv-collection.js';
import { tr, trEl, trNode } from '../sites/mirapri.js';
import { trRonka, trimRonkaNode } from '../sites/ronka.js';
export { ATTR_TRANSLATORS, NODE_TRANSLATORS, TEXT_TRANSLATORS, translateAttributes, translateNode, translateText };


  /* @zhixia:core-translator-start */
  /* ── Core Translator（v1.4 Phase 5）：翻译统一接口层——按 profile（站点 id）
       分发到各站翻译器；本层不改变任何翻译结果（各站函数原样调用）。Phase 15
       模块化构建时，本区段将原样抽出为 src/core/translator.js。 */
  const TEXT_TRANSLATORS = {
    mirapri: (text) => tr(text),
    ec: (text) => trEC(text),
    fc: (text) => trFC(text),
    ronka: (text) => trRonka(text),
    acl: (text) => trACL(text),
  };
  const NODE_TRANSLATORS = {
    mirapri: (node) => trNode(node),
    ec: (node) => trimECNode(node),
    fc: (node) => trimFCNode(node),
    ronka: (node) => trimRonkaNode(node),
    acl: (node) => trimACLNode(node),
  };
  // 属性翻译：ec 为「以该元素为根的子树扫描」语义（translateECAttrs 既有行为）、
  // fc/mirapri 为单元素（placeholder / value）；acl、ronka 无独立实现（不注册）。
  const ATTR_TRANSLATORS = {
    mirapri: (el) => trEl(el),
    ec: (el) => translateECAttrs(el),
    fc: (el) => _wowFCInput(el),
  };
  function translateText(text, profile) { const f = TEXT_TRANSLATORS[profile]; return f ? f(text) : text; }   // NOSONAR —— 接口层：tests/unit 经 dist 区段装配调用（冻结契约）；生产路径暂不直呼
  function translateNode(node, profile) { const f = NODE_TRANSLATORS[profile]; if (f) f(node); }   // NOSONAR —— 接口层：tests/unit 经 dist 区段装配调用（冻结契约）；生产路径暂不直呼
  function translateAttributes(element, profile) { const f = ATTR_TRANSLATORS[profile]; if (f) f(element); }   // NOSONAR —— 接口层：tests/unit 经 dist 区段装配调用（冻结契约）；生产路径暂不直呼
  /* @zhixia:core-translator-end */
