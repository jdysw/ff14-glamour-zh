// ==UserScript==
// @name         FF14 幻化站中文化 · PR44 EC 测试版
// @namespace    https://github.com/jdysw/ff14-glamour-zh/preview/pr44
// @version      1.4.3.44.9
// @description  PR44 最新代码 EC 测试版：套装与饰品汉化、中文智能搜索、鸟甲/面饰、各装备部位筛选。测试前禁用正式版及旧测试版。
// @author       zhixia
// @license      GPL-3.0
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.listValues
// @grant        GM.deleteValue
// @connect      zhixia-data.pages.dev
// @match        https://ffxiv.eorzeacollection.com/*
// @downloadURL  https://raw.githubusercontent.com/jdysw/ff14-glamour-zh/feat/ec-gearsets-auto-translate-143/preview/ff14-glamour-zh-pr44-ec-test.user.js
// @updateURL    https://raw.githubusercontent.com/jdysw/ff14-glamour-zh/feat/ec-gearsets-auto-translate-143/preview/ff14-glamour-zh-pr44-ec-test.user.js
// @tag          PR44-TEST-ONLY
// @run-at       document-idle
// @noframes
// ==/UserScript==

// PR44 source commit: bd0a6fb4f8822665571c2921c08eb7a6556df04d


(function () {
  'use strict';

  /* @phase15-module-order:core/runtime */

    /* @zhixia:core-runtime-start */
    /* ── Core Runtime（v1.4 Phase 4）：脚本注入时刻（运行探测用；未启用时零
         开销）。本模块共 2 处标记区段（段2 = 错误边界 safe，见下文）；Phase 15
         模块化构建时，本区段将原样抽出为 src/core/runtime.js。 */
    // 运行探测（URL 带 zhx_probe 参数时启用）用：脚本注入时刻；未启用时零开销
    const __zhxBootAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    // Phase 19：测量用单调时钟（performance 缺失时回退 Date.now；供处理统计与时间线共用）
    function _perfNow() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
    /* @zhixia:core-runtime-end */

    function lookupZh(a, name) {
      const h = (a?.getAttribute('href')) || '';
      const m = h.match(/lodestone\/playguide\/db\/item\/([0-9a-f]+)/i);
      return resolve({ hash: m?.[1], name }, { latinFallback: true });   // hash → 名称 → 外文名兜底（等价原逻辑）
    }

    /* ── 通用工具层（工程做法借鉴 maboloshi/github-chinese）───────────── */

    /* @zhixia:core-runtime-start */
    /* ── Core Runtime（段2/2）：错误边界——包住关键函数，单点出错不拖垮整批
         翻译；Phase 18 起统一经 _zhxErr 记录（降低静默失败；Probe 开启时同时
         保留到 __zhxErrs 供诊断）。Phase 15 随段1 一同抽出为 src/core/runtime.js。 */
    // 错误记录：有界缓冲（常驻、极小）+ console.warn；Probe 开启后同时镜像 __zhxErrs
    const ERR_LOG_CAP = 20;
    const _errLog = [];
    function _zhxErr(where, e) {
      try {
        const msg = String(where || 'safe') + '：' + String((e && (e.message || e)) || 'e').slice(0, 100);
        if (_errLog.length < ERR_LOG_CAP) _errLog.push(msg);
        if (Array.isArray(window.__zhxErrs) && window.__zhxErrs.length < ERR_LOG_CAP) window.__zhxErrs.push(msg);
      } catch (_e) { /* 忽略：记录缓冲失败不影响警告输出 */ }
      try { console.warn((where || 'safe') + '：', e); } catch (_e) { /* 忽略：控制台不可用时静默 */ }
    }
    // 错误边界：包住关键函数，单点出错不拖垮整批翻译
    function safe(fn, tag) {
      return function () {
        try { return fn.apply(this, arguments); }
        catch (e) { _zhxErr(tag || fn.name || 'safe', e); }
      };
    }

    /* @zhixia:core-runtime-end */

  /* @phase15-module-order:core/dictionary */
  /* @phase15-order-link:core/dictionary<-core/runtime */


    /* =====================================================================
     * 第一部分：mirapri.com 界面汉化
     * ===================================================================== */

    // 日文 → 中文（精确匹配整段文本）
    // ⚠️ 自动生成（dict/dict-common.json → build/inject_dicts.py）：勿手改本块；改词请改 JSON 后重新构建
    const DICT_COMMON = {
      'ABOUT': '关于',
      'ACCESSORIES': '配饰',
      'ACCESSORY': '配饰',
      'ALLIANCE RAID': '团队任务',
      'About': '关于',
      'Account': '账号',
      'Achievement Reward': '成就奖励',
      'Advertisement': '广告',
      'Alchemist': '炼金术士',
      'All': '全部',
      'All Classes': '所有职业',
      'All-time': '全部时间',
      'Apply': '应用',
      'Armorer': '铸甲匠',
      'Astrologian': '占星术士',
      'Au Ra': '敖龙族',
      'Awarded from quests': '任务奖励',
      'BRACELETS': '手镯',
      'Back': '返回',
      'Bard': '吟游诗人',
      'Battle': '战斗',
      'Beastmaster': '驯兽师',
      'Black': '黑',
      'Black Mage': '黑魔法师',
      'Blacksmith': '锻铁匠',
      'Blue': '蓝',
      'Blue Mage': '青魔法师',
      'Blues': '蓝色系',
      'Bookmark': '收藏',
      'Botanist': '园艺工',
      'Bracelets': '手镯',
      'Brown': '棕',
      'Browns': '棕色系',
      'CLASS': '职能',
      'Cancel': '取消',
      'Carpenter': '刻木匠',
      'Casual': '休闲',
      'Character': '角色',
      'Check it out': '查看详情',
      'Chocobo': '陆行鸟',
      'Class': '职能',
      'Classes': '职能',
      'Close': '关闭',
      'Collection': '收藏',
      'Combat': '战斗',
      'Comments': '评论',
      'Confirm': '确认',
      'Contact': '联系我们',
      'Crafter': '能工巧匠',
      'Crafters': '能工巧匠',
      'Creator': '作者',
      'Culinarian': '烹调师',
      'DATE SUBMITTED': '投稿日期',
      'DUNGEON': '副本',
      'Dancer': '舞者',
      'Dark Knight': '暗黑骑士',
      'Date Submitted': '投稿日期',
      'Dawntrail': '黄金的遗产',
      'Disciples of Magic': '魔法导师',
      'Disciples of War': '战斗精英',
      'Disciples of the Hand': '能工巧匠',
      'Disciples of the Land': '大地使者',
      'Dragoon': '龙骑士',
      'Dye': '染色',
      'Dyeable': '可染色',
      'Dyes': '染剂',
      'EAR PIECES': '耳饰',
      'EARRINGS': '耳饰',
      'Earrings': '耳饰',
      'Elezen': '精灵族',
      'Endwalker': '晓月之终途',
      'Eorzea': '艾欧泽亚',
      'Equipment': '装备',
      'Equippable By': '可装备职业',
      'Exchange': '兑换',
      'FASHION': '时尚配饰',
      'FAV': '收藏',
      'FILTER': '筛选',
      'Fashion': '时尚配饰',
      'Fashion Accessories': '时尚配饰',
      'Fashionable': '时尚',
      'Favorite': '收藏',
      'Female': '女性',
      'Filter': '筛选',
      'Filters': '筛选',
      'Fisher': '捕鱼人',
      'GENDER': '性别',
      'Gatherer': '大地使者',
      'Gatherers': '大地使者',
      'Gear': '装备',
      'Gearset': '套装',
      'Gearsets': '套装',
      'Gender': '性别',
      'Glamour': '幻化',
      'Glamours': '幻化',
      'Goggles': '护目镜',
      'Goldsmith': '雕金匠',
      'Gray': '灰',
      'Green': '绿',
      'Greens': '绿色系',
      'Grey': '灰',
      'Gunbreaker': '绝枪战士',
      'HOME': '首页',
      'Heavensward': '苍穹之禁城',
      'Highlander': '高地之民',
      'How to obtain': '获取方式',
      'Hrothgar': '硌狮族',
      'Hyur': '人族',
      'ID': '副本装备',
      'ITEMレベル': '物品品级',
      'Item Level': '物品品级',
      'JOB': '职业',
      'JOIN': '注册',
      'Job': '职业',
      'Jobs': '职业',
      'KEYWORD': '关键词',
      'LOGIN': '登录',
      'Lalafell': '拉拉菲尔族',
      'Leatherworker': '制革匠',
      'Level': '等级',
      'Levels': '等级',
      'Load More': '加载更多',
      'Login': '登录',
      'Logout': '登出',
      'Love': '点赞',
      'Machinist': '机工士',
      'Male': '男性',
      'Midlander': '中原之民',
      'Miner': '采矿工',
      'Miqo\'te': '猫魅族',
      'Mogstation': '商城',
      'Monk': '武僧',
      'NECKLACE': '项链',
      'Name': '名称',
      'Necklace': '项链',
      'Newest': '最新',
      'Next': '下一页',
      'Ninja': '忍者',
      'OTHER': '其他',
      'Outfit': '套装',
      'PVP': 'PvP',
      'Paladin': '骑士',
      'Parts': '部位',
      'Pictomancer': '绘灵法师',
      'Preview': '预览',
      'Previous': '上一页',
      'Privacy Policy': '隐私政策',
      'Profile': '个人资料',
      'Purple': '紫',
      'Purples': '紫色系',
      'PvP': 'PvP',
      'QUESTS': '任务',
      'Quest Reward': '任务奖励',
      'RACE': '种族',
      'RING': '戒指',
      'Race': '种族',
      'Races': '种族',
      'Raid Gear': '副本装备',
      'Reaper': '钐镰客',
      'Red': '红',
      'Red Mage': '赤魔法师',
      'Reds': '红色系',
      'Register': '注册',
      'Reset': '重置',
      'Ring': '戒指',
      'Roegadyn': '鲁加族',
      'SEARCH': '搜索',
      'SORT': '排序',
      'Sage': '贤者',
      'Samurai': '武士',
      'Save': '保存',
      'Scholar': '学者',
      'Search': '搜索',
      'Seasonal': '季节活动',
      'Seasonal Event': '季节活动',
      'See More': '查看更多',
      'Server': '服务器',
      'Settings': '设置',
      'Share': '分享',
      'Sign In': '登录',
      'Sign Up': '注册',
      'Sign in': '登录',
      'Sign up': '注册',
      'Stormblood': '红莲之狂潮',
      'Submit': '投稿',
      'Submitted': '投稿',
      'Summoner': '召唤师',
      'TAG': '标签',
      'TAGS': '标签',
      'Tags': '标签',
      'This Month': '本月',
      'This Week': '本周',
      'Today': '今天',
      'Undyeable': '不可染色',
      'Viera': '维埃拉族',
      'View More': '查看更多',
      'Viper': '蝰蛇剑士',
      'WEAPON': '武器',
      'Warrior': '战士',
      'Weapon': '武器',
      'Wearable by': '可装备职业',
      'White': '白',
      'White Mage': '白魔法师',
      'Yellows': '黄色系',
      'おしゃれ': '时尚',
      'お名前': '名称',
      'お問い合わせ': '联系我们',
      'お気に入り': '收藏',
      'すべて': '全部',
      'その他': '其他',
      'で詳細を表示': '查看详情',
      'もっと見る': '查看更多',
      'アイテムレベル': '物品品级',
      'アウラ': '敖龙族',
      'アカウント': '账号',
      'アクセサリー': '配饰',
      'アチーブメント報酬': '成就奖励',
      'アライアンスレイド': '团队任务',
      'インスタンス': '副本',
      'ウェポン': '武器',
      'エオルゼア': '艾欧泽亚',
      'エレゼン': '精灵族',
      'オフの日': '休闲',
      'カララント': '染剂',
      'ガンブレイカー': '绝枪战士',
      'キャスター': '法系',
      'キャラクター': '角色',
      'キャンセル': '取消',
      'キーワード': '关键词',
      'ギャザラー': '大地使者',
      'クエスト': '任务',
      'クエスト報酬': '任务奖励',
      'クラス': '职业',
      'クラフター': '能工巧匠',
      'クラフター製作': '制作',
      'クラフト': '制作',
      'コメント': '评论',
      'ゴーグル': '护目镜',
      'サイトについて': '关于本站',
      'シェア': '分享',
      'シーズナル': '季节活动',
      'シーズナル・イベント': '季节活动',
      'ジョブ': '职业',
      'ジョブ・クラス': '职业',
      'スポンサーリンク': '赞助商链接',
      'セット': '套装',
      'ソーサラー': '魔法导师',
      'タグ': '标签',
      'タンク': '防护',
      'ダンジョン': '副本',
      'チョコボ': '陆行鸟',
      'ツイート': '分享到 X',
      'デジョン': '返回',
      'デフォルト': '默认',
      'トップページ': '首页',
      'ナイト': '骑士',
      'ネックレス': '项链',
      'ハイランダー': '高地之民',
      'バイザー': '护目镜',
      'バトル': '战斗',
      'ヒューラン': '人族',
      'ヒーラー': '治疗',
      'ピクトマンサー': '绘灵法师',
      'ファイター': '战斗精英',
      'ファッション': '时尚',
      'ファッションアクセ': '时尚配饰',
      'ブレスレット': '手镯',
      'プライバシーポリシー': '隐私政策',
      'プロフィール': '个人资料',
      'ホーム': '首页',
      'ミコッテ': '猫魅族',
      'ミッドランダー': '中原之民',
      'ミラプリ': '幻化',
      'モグステーション': '商城',
      'モンク': '武僧',
      'ララフェル': '拉拉菲尔族',
      'リセット': '重置',
      'リセットする': '重置',
      'リング': '戒指',
      'リーパー': '钐镰客',
      'ルガディン': '鲁加族',
      'レイド': '团队任务',
      'レベル': '等级',
      'ログアウト': '登出',
      'ログイン': '登录',
      'ロスガル': '硌狮族',
      'ロール': '职能',
      'ワールド': '服务器',
      'ヴァイパー': '蝰蛇剑士',
      'ヴィエラ': '维埃拉族',
      '並べ替え': '排序',
      '交換': '兑换',
      '今日': '今天',
      '作者': '作者',
      '侍': '武士',
      '入手方法': '获取方式',
      '全て': '全部',
      '全期間': '全部时间',
      '前のページ': '上一页',
      '前へ': '上一页',
      '前へ戻る': '返回',
      '占星術師': '占星术士',
      '召喚士': '召唤师',
      '吟遊詩人': '吟游诗人',
      '園芸師': '园艺工',
      '女性': '女性',
      '学者': '学者',
      '彫金師': '雕金匠',
      '忍者': '忍者',
      '性別': '性别',
      '戦士': '战士',
      '戻る': '返回',
      '手防具': '手部防具',
      '投稿する': '投稿',
      '投稿日': '投稿日期',
      '指輪': '戒指',
      '採掘師': '采矿工',
      '新着順': '最新',
      '新規登録': '注册',
      '暁月のフィナーレ': '晓月之终途',
      '暗黒騎士': '暗黑骑士',
      '月間': '本月',
      '木工師': '刻木匠',
      '染色': '染色',
      '染色不可': '不可染色',
      '染色可能': '可染色',
      '検索': '搜索',
      '検索する': '搜索',
      '機工士': '机工士',
      '次のページ': '下一页',
      '次へ': '下一页',
      '武器': '武器',
      '漁師': '捕鱼人',
      '甲冑師': '铸甲匠',
      '男性': '男性',
      '画像': '图片',
      '白魔道士': '白魔法师',
      '確認': '确认',
      '種族': '种族',
      '竜騎士': '龙骑士',
      '紅蓮のリベレーター': '红莲之狂潮',
      '紫系': '紫色系',
      '絞り込み': '筛选',
      '緑系': '绿色系',
      '耳': '耳饰',
      '耳飾り': '耳饰',
      '胴防具': '身体防具',
      '脚防具': '腿部防具',
      '腕輪': '手镯',
      '茶系': '棕色系',
      '蒼天のイシュガルド': '苍穹之禁城',
      '裁縫師': '裁衣匠',
      '装備': '装备',
      '装備可能ジョブ': '可装备职业',
      '装備品': '装备',
      '製作': '制作',
      '設定': '设置',
      '詳しく見る': '查看详情',
      '詳細を表示': '查看详情',
      '詳細を見る': '查看详情',
      '調理師': '烹调师',
      '賢者': '贤者',
      '赤系': '红色系',
      '赤魔道士': '赤魔法师',
      '足防具': '脚部防具',
      '踊り子': '舞者',
      '適用': '应用',
      '適用する': '应用',
      '部位': '部位',
      '錬金術師': '炼金术士',
      '鍛冶師': '锻铁匠',
      '閉じる': '关闭',
      '青系': '蓝色系',
      '青魔道士': '青魔法师',
      '革細工師': '制革匠',
      '頭防具': '头部防具',
      '首飾り': '项链',
      '魔獣使い': '驯兽师',
      '鯖': '服务器',
      '黄系': '黄色系',
      '黄金のレガシー': '黄金的遗产',
      '黒魔道士': '黑魔法师',
      '갈색': '棕',
      '건브레이커': '绝枪战士',
      '검은색': '黑',
      '고원 휴런': '高地之民',
      '공유하기': '分享',
      '기공사': '机工士',
      '기타': '其他',
      '나이트': '骑士',
      '남성': '男性',
      '닌자': '忍者',
      '다리 방어구': '腿部防具',
      '라라펠': '拉拉菲尔族',
      '로스가르': '硌狮族',
      '루가딘': '鲁加族',
      '리퍼': '钐镰客',
      '마술사': '法系',
      '머리 방어구': '头部防具',
      '모든 클래스': '所有职业',
      '몸통 방어구': '身体防具',
      '몽크': '武僧',
      '무도가': '舞者',
      '미리보기': '预览',
      '미코테': '猫魅族',
      '바이퍼': '蝰蛇剑士',
      '발 방어구': '脚部防具',
      '백마도사': '白魔法师',
      '보라색': '紫',
      '부위': '部位',
      '비에라': '维埃拉族',
      '빨간색': '红',
      '사무라이': '武士',
      '성별': '性别',
      '소환사': '召唤师',
      '손 방어구': '手部防具',
      '수호자': '防护',
      '아우라': '敖龙族',
      '암흑기사': '暗黑骑士',
      '엘레젠': '精灵族',
      '여성': '女性',
      '용기사': '龙骑士',
      '음유시인': '吟游诗人',
      '이미지': '图片',
      '장비': '装备',
      '저장': '保存',
      '저장하기': '保存',
      '적마도사': '赤魔法师',
      '전사': '战士',
      '전체': '全部',
      '점성술사': '占星术士',
      '정렬': '排序',
      '제작자': '制作',
      '종족': '种族',
      '좋아요': '点赞',
      '중원 휴런': '中原之民',
      '직업': '职业',
      '청마도사': '青魔法师',
      '초기화': '重置',
      '초록색': '绿',
      '최신순': '最新',
      '취소': '取消',
      '치유사': '治疗',
      '파란색': '蓝',
      '픽토맨서': '绘灵法师',
      '학자': '学者',
      '현자': '贤者',
      '확인': '确认',
      '회색': '灰',
      '회원가입': '注册',
      '흑마도사': '黑魔法师',
      '흰색': '白',
    };

    // ⚠️ 自动生成（dict/dict-main.json → build/inject_dicts.py）：勿手改本块；改词请改 JSON 后重新构建
    const DICT = { ...DICT_COMMON,
      'ファッションチェック': '时尚品鉴',
      '投稿ガイドライン': '投稿指南',
      '新規会員登録': '注册新会员',
      'COLOR': '颜色',
      '期間指定なし': '不限时间',
      '週間': '本周',
      '並び順指定なし': '默认排序',
      'イイ数が多い順': '按点赞数',
      'PV数が多い順': '按浏览量',
      '新しい順': '最新优先',
      '古い順': '最早优先',
      '未分類': '未分类',
      '剣術士': '剑术师',
      '斧術士': '斧术师',
      '槍術士': '枪术师',
      '格闘士': '格斗家',
      '弓術士': '弓箭手',
      '呪術士': '咒术师',
      '巴術士': '秘术师',
      '幻術士': '幻术师',
      '双剣士': '双剑师',
      'バディチョコボ': '搭档陆行鸟',
      'フォレスター': '森林之民',
      'シェーダー': '黑影之民',
      'サンシーカー': '逐日之民',
      'ムーンキーパー': '护月之民',
      'プレーンフォーク': '平原之民',
      'デューンフォーク': '沙漠之民',
      'ゼーヴォルフ': '北洋之民',
      'ローエンガルデ': '红焰之民',
      'アウラ・レン': '晨曦之民',
      'アウラ・ゼラ': '暮晖之民',
      'ヴィナ・ヴィエラ': '山林之民',
      'ラヴァ・ヴィエラ': '密林之民',
      'ヘリオン': '掠日之民',
      'ロスト': '迷踪之民',
      '白・黒系': '白黑系',
      'ブックマークのみ': '仅收藏',
      'このミラプリ･･･イイ！': '这个幻化…不错！',
      'このミラプリ…イイ！': '这个幻化…不错！',
      'ブックマークに追加する！': '加入收藏！',
      'ブックマークから削除する': '取消收藏',
      '投稿の編集': '编辑投稿',
      'この装備品で検索': '用这件装备搜索',
      'LINEで送る': '发送到 LINE',
      'はてブ': 'Hatena 书签',
      '前のミラプリ': '上一个幻化',
      '次のミラプリ': '下一个幻化',
      'この投稿を通報する': '举报这条投稿',
      'OTHER POSTS': '其他投稿',
      'Photo by': '摄影：',
      'コメントする': '发表评论',
      'コメントを書き込む': '写评论',
      'ログインしてコメントする': '登录后评论',
      '返信': '回复',
      'イイ！': '赞！',
      'タグで絞り込む': '按标签筛选',
      'イイ！ミラプリ投稿フォーム': '幻化投稿表单',
      'タイトル': '标题',
      '正面全身': '正面全身',
      'サブ画像 1枚目': '副图 1',
      'サブ画像 2枚目': '副图 2',
      'サブ画像 3枚目': '副图 3',
      'コピーライト': '版权水印',
      '装備品名': '装备名称',
      'URL': 'URL',
      '編集用パスワード': '编辑密码',
      '編集用パスワード(確認)': '确认编辑密码',
      'クッキー': 'Cookie',
      'クッキーを保存する': '保存 Cookie',
      '全身を切り取る': '裁切全身',
      '正方形': '正方形',
      '長方形': '长方形',
      '注意!': '注意！',
      '装備品を検索して、追加してください。': '请搜索装备并添加。',
      '追加したい装備品を検索': '搜索要添加的装备',
      'この条件で検索': '按此条件搜索',
      '画像にコピーライトを表示する': '在图片上显示版权水印',
      '運営ブログ': '运营博客',
      'ミラプリを投稿': '发布幻化',
      'Twitterでログイン': '用 X (Twitter) 登录',
      '検索メニューを閉じる': '关闭搜索菜单',
      '検索メニューを開く': '打开搜索菜单',
      '投稿を送信中...': '正在提交…',
      '投稿を送信中…': '正在提交…',
      '画像のアップロード処理を行っています。': '正在上传图片。',
      'しばらくお待ちください。': '请稍候。',
      'この内容で投稿する': '按此内容投稿',
      'GSファッションチェックのタグを追加': '添加「GS 时尚品鉴」标签',
      '(サンプルのような画像)': '（像示例那样的图片）',
      '※Enterキー、スペースキー、またはカンマ(,)で区切ることができます。': '※可用 Enter 键、空格键或逗号(,)分隔。',
      '※このタグをつけた投稿は': '※带有该标签的投稿可在「',
      '」ページ': '」页面',
      'から閲覧することができます。ネタバレ防止のためトップページには表示されません。': '中查看。为防止剧透，不会显示在首页。',
      '※高得点装備の投稿を強制するものではありません。予想や自己流の答えなどファッションチェックのお題に沿った投稿をお願いいたします。': '※并非强制投稿高分装备。请围绕时尚品鉴的题目投稿，可以是预测或自己的搭配。',
      '※ファッションチェックについては': '※关于时尚品鉴，请参考「',
      'Lodestoneの4.2パッチノート記事': 'Lodestone 的 4.2 版本更新说明',
      '」をご参照ください。': '」。',
      'をご参照ください。': '。',
      '※正面全身画像は投稿の一覧ページに表示される画像です。身体全体が写っているものをあげてください。': '※正面全身图会显示在投稿列表页。请上传拍到全身的图片。',
      '※「画像の明るさレベル」は画像全体の明るさを0〜100で数値化したもので、25以上が見やすい画像の目安です。': '※「图片亮度等级」是把整张图的亮度量化为 0〜100 的数值，25 以上是较易观看的参考值。',
      '※3MB以内、横320ピクセル、縦320ピクセル以上のサイズの画像(JPG,PNG形式)を選択してください。': '※请选择 3MB 以内、宽 320 像素、高 320 像素以上的 JPG／PNG 图片。',
      '※画像の左下に「Copyright (C) SQUARE ENIX CO., LTD. All Rights Reserved.」が表示されます。': '※会在图片左下角显示「Copyright (C) SQUARE ENIX CO., LTD. All Rights Reserved.」。',
      '※装備品は2〜26箇所まで追加できます。': '※装备最多可添加 2〜26 处。',
      '※こだわった点など': '※比如你特别讲究的地方',
      '※各種twitterやLodestoneのURLなど': '※各种 X (Twitter) 或 Lodestone 链接等',
      '※投稿を修正・削除する場合に必要になるパスワードです。': '※修改或删除投稿时所需的密码。',
      '※4~32文字以内で入力しください': '※请输入 4〜32 个字符',
      '※チェックを入れると、お名前等がブラウザに記録されます。次回投稿時に入力が省けます。': '※勾选后，名称等会记录在浏览器中，下次投稿时无需再次输入。',
      '«　前のミラプリ': '«　上一个幻化',
      '次のミラプリ　»': '下一个幻化　»',
      'メールアドレス': '电子邮箱',
      'お問い合わせ種別': '咨询类型',
      'お問い合わせ内容': '咨询内容',
      '投稿された画像について': '关于已发布的图片',
      '送信内容を確認する': '确认提交内容',
      '投稿する': '发布幻化',
      '検索する': '搜索',
      'ログイン': '登录',
      'お名前': '姓名',
      'サイトについて': '关于本站',
      'お問い合わせ': '联系我们',
      'その他': '其他',
      'ホーム': '首页',
      'KEYWORD': '关键词',
      'SORT': '排序',
      'GENDER': '性别',
      'CLASS': '职能',
      'ファイター': '战斗精英',
      'ソーサラー': '魔法导师',
      'クラフター': '能工巧匠',
      'ギャザラー': '大地使者',
      'MIRAPRISNAP（ミラプリスナップ）': 'MIRAPRI SNAP',
      'Previous slide': '上一张图片',
      'Next slide': '下一张图片',
      '例) エクスカリバー': '例如：石中剑',
      'ガイドラインについて': '关于投稿指南',
      'MIRAPRI SNAPは、ミラプリをより身近に楽しんでもらえることをコンセプトに作ったギャラリーサイトです。': 'MIRAPRI SNAP 是一个幻化作品展示网站，希望让大家更轻松地享受幻化的乐趣。',
      '皆さんが自由に、楽しくサイトを利用してもらえることが管理人にとって一番嬉しいことなのですが、': '作为网站管理员，我最希望大家能够自由、愉快地使用本站。',
      'より多くの方がミラプリギャラリーサイトとして気軽に利用できるよう、': '为了让更多人能轻松地使用这个幻化作品展示网站，',
      'そしてミラプリをより楽しいものにしていきたいと思い、投稿にあたって一定のガイドラインを設けることにしました。': '也为了让幻化变得更加有趣，我们决定为投稿制定一些基本规则。',
      '投稿時のルール': '投稿规则',
      'ミラプリを投稿する際は、これらのことに注意して画像を選択、投稿してください。': '发布幻化作品时，请按照以下要求选择并上传图片。',
      '① 正面全身画像は全身が写っていて、ミラプリが分かりやすいものを選択！': '① 正面全身图应清晰展示整套幻化！',
      '正面全身画像はサイトのトップページに一覧で表示される大事な画像です。': '正面全身图是作品在首页列表中展示的重要图片。',
      'パッと見てどんな雰囲気の装備なのかが分かるよう、': '为了让人一眼看出这套装备的整体风格，',
      '全身がしっかり写っていて、尚且つエフェクトや加工等でミラプリが隠れてしまわないように注意': '请确保人物全身清晰可见，不要让特效或后期处理遮挡幻化，',
      'しましょう。 また、ミラプリギャラリーサイトとして利用していただきたいため、過度な加工や目立つテキストの配置を行った画像をメインに設定することはお控えください。': '并请尽量避免将过度修图或添加醒目文字的图片设为主图，以便大家正常欣赏幻化。',
      'また、': '此外，',
      '極端に横に長くトリミングする': '将图片裁切得过于狭长',
      'スキル等のエフェクトでミラプリが見えない': '技能等特效遮挡幻化',
      'ミラプリがメインではない': '幻化不是画面主体',
      '装備品を着用していない画像': '角色未穿戴装备的图片',
      'の投稿もお控えください。': '也请避免上传上述类型的图片。',
      '正面全身画像がこのガイドラインに沿わないと判断した場合、管理人の判断でサブ画像と入れ替えさせていただく場合があります。': '若正面全身图不符合上述要求，管理员可能酌情将其与副图交换。',
      '② サブ画像は、加工したものや演出SS、文字入れしたものなどもOK！': '② 副图可以使用修图作品、摆拍截图或添加文字的图片！',
      'サブ画像は詳細画面でのみ見ることができる画像ですので、加工したものや演出にこだわった画像を投稿しても問題ありません。': '副图只会出现在作品详情页，因此可以上传经过加工或精心布景的截图。',
      'ただし、ミラプリと関係がない画像、他人を不快にするような画像等をアップロードすることはやめましょう。': '不过，请勿上传与幻化无关或可能引起他人不适的图片。',
      '③ 他の人が参考にできるよう、装備情報はできるだけ多く入力！': '③ 尽可能填写完整的装备信息，方便其他玩家参考！',
      'このミラプリすごくイイ！自分も真似したい！と思った時に装備情報が全身きっちり登録されていると、非常に助かります。': '遇到喜欢、想要模仿的幻化时，完整的全身装备信息会很有帮助。',
      '必須項目はニ箇所となっていますが、皆さんの参考になるよう、ぜひ全身分の情報を登録してください！': '虽然必填项只有两处，但为了方便大家参考，还是请尽量填写全身装备信息！',
      '削除の対象となる行為': '可能导致内容被删除的行为',
      '以下のような投稿やコメントがあった場合、管理人の判断で削除される可能性があります。': '出现以下投稿或评论时，管理员可能酌情删除。',
      '正面全身画像にミラプリが全く見えない画像や、過度な加工を施した画像を設定している投稿。': '使用完全看不清幻化或过度加工的图片作为正面全身图的投稿。',
      'ミラプリとは関係のないと判断される投稿・コメント。': '被认定为与幻化无关的投稿或评论。',
      '他人を誹謗・中傷する、不快にするような投稿・コメント。': '诽谤、攻击他人或令人不适的投稿或评论。',
      '営利目的の恐れのある投稿・コメント。': '可能具有营利目的的投稿或评论。',
      '法律・条令に違反する恐れのある投稿・コメント。': '可能违反法律法规的投稿或评论。',
      'その他、「': '此外，违反《',
      'ファイナルファンタジーXIV 著作物利用許諾条件': '最终幻想 XIV 著作物使用许可条件',
      '」に違反するような投稿・コメント。': '》的投稿或评论。',
      '通報機能について': '关于举报功能',
      '上記のような投稿やコメントを見つけた場合、ユーザが管理人に通報できる機能を実装しました。': '如果发现上述投稿或评论，可以使用举报功能通知管理员。',
      'ページ下部にある「投稿を通報」リンクをクリックし、通報理由を添えて送信ボタンを押してください。': '点击页面底部的“举报投稿”链接，填写举报理由后点击发送。',
      'なお、通報された画像はすぐに削除されるわけではなく、通報件数が一定数に達した場合、管理人の判断で削除となります。': '被举报的图片不会立即删除；当举报达到一定数量后，管理员会判断是否删除。',
      'さいごに': '最后',
      'MIRAPRI SNAPを利用する方に気持ちよく使ってもらえるように、上記投稿ガイドラインを守っていただけると助かります！': '为了让每位使用 MIRAPRI SNAP 的玩家都能有良好的体验，请遵守上述投稿规则！',
      'ちなみにサイトでは過度な加工は禁止しましたが、私個人としては綺麗に加工された画像を眺めるのは大好きです。': '虽然本站不允许以过度加工的图片作为主图，但我本人其实很喜欢欣赏精美的修图作品。',
      '加工画像がアップロードできる場もあるといいかもしれませんね…！': '以后说不定也能增加一个专门上传修图作品的地方呢……！',
      'MIRAPRI SNAP（ミラプリスナップ）は': 'MIRAPRI SNAP（幻化截图分享站）是',
      'FF14のミラプリSS投稿・共有サイトです': '一个供 FF14 玩家投稿和分享幻化截图的网站。',
      'ミラプリとは、ファイナルファンタジーXIV内のオシャレを楽しむためのシステムです。': '幻化是《最终幻想 XIV》中让玩家自由搭配外观、享受穿搭乐趣的系统。',
      'ゲーム内で偶然見つけたミラプリをSSで撮ったり、SNSで参考になるコーディネートを探したり・・・。': '在游戏中拍下偶遇的好看幻化，或在社交平台上寻找值得参考的搭配……',
      'それでもいいけど、もっと簡単に探したい！もっとたくさん眺めたい！自分のミラプリもみんなに披露したい！！': '这样当然很好，但我们还想让寻找更方便、欣赏更多作品，也想向大家展示自己的幻化！',
      'そんな想いからこのサイトを作りました！皆さんいっぱい使って下さい！': '正是出于这样的想法，我们创建了这个网站。欢迎大家多多使用！',
      'いろんなジャンルで絞り込める！': '支持按多种类别筛选！',
      'お気に入りのミラプリを見つけよう！': '找到你喜欢的幻化吧！',
      'ジョブ・クラス・種族・色などで検索できる他、ユーザが自由にタグを設定することができます。「お花見」や「夏休み」「ハロウィン」などシーズナルイベント系のタグを付けてみたり、「褐色ミコッテ」「黒髪ララフェル」というような付け方もおもしろいですね！': '除了按职业、职能、种族和颜色搜索，用户还可以自由添加标签。既可以使用“赏花”“暑假”“万圣节”等季节性标签，也可以使用“褐肤猫魅族”“黑发拉拉菲尔族”等有趣的标签。',
      '装備品を簡単に登録できる機能を実装！': '支持轻松登记装备信息！',
      'ゲーム内でも真似しやすい！': '在游戏中也能轻松照着搭配！',
      '「追加」ボタンを押して出てきたボックスに装備名を入力→検索ボタンを押すと（少ない文字で検索するとちょっと時間がかかります）装備リストが出てくるので、名前をクリックすると登録完了です。染色している場合は色名も設定できます。エオルゼアデータベースの情報が表示される公式ツールチップも使用！': '点击“添加”，在弹出的输入框中填写装备名称并搜索（关键词过短时搜索可能稍慢），然后从列表中点击对应装备即可完成登记。若装备染色，还可以设置染剂名称。本站也使用官方工具提示展示艾欧泽亚数据库的信息！',
      '「追加」ボタンを押して出てきたボックスに装備名を入力→検索ボタンを押すと（输入较短时检索会稍慢）装備リストが出てくるので、名前をクリックすると登録完了です。染色している場合は色名も設定できます。エオルゼアデータベースの情報が表示される公式ツールチップも使用！': '点击“添加”，在弹出的输入框中填写装备名称并搜索（关键词过短时搜索可能稍慢），然后从列表中点击对应装备即可完成登记。若装备染色，还可以设置染剂名称。本站也使用官方工具提示展示艾欧泽亚数据库的信息！',
      '実にイイ！投稿にはハートを贈ろう！': '喜欢的作品就送上一颗爱心吧！',
      'コメントも書き込めるよ！': '还可以发表评论！',
      'ミラプリ詳細画面には「イイ！」ボタンを実装しました。このミラプリ・・・実にイイ！と思ったら気軽にぽちっと押してみて下さい！（イイ騎士とは、民と友のために投稿し、ボタンを押す者……それだけのことだ。）コメント機能もつけているので、ぜひ投稿者さんに感想などを伝えて下さい！マナーは守ってね！': '作品详情页设有“赞！”按钮。看到特别喜欢的幻化就点个赞吧！（所谓好骑士，就是为了人民和朋友投稿、点赞之人……仅此而已。）也欢迎通过评论功能向作者分享感想，记得遵守礼仪哦！',
      '注意事項や利用規約（必ず読んでね）': '注意事项与使用条款（请务必阅读）',
      '当サイトにおける画像の取り扱いについては、「': '本站对图片的使用遵循《',
      '」に従います。': '》的规定。',
      '他人を誹謗・中傷する、不快にするような投稿・コメント等は行わないで下さい。': '请勿发布诽谤、攻击他人或令人不适的投稿及评论。',
      'ファイナルファンタジーXIVとは関係のない画像、ミラージュプリズム以外の画像、その他管理人が相応しくないと判断した画像は削除の対象となります。': '与《最终幻想 XIV》或幻化无关，以及其他经管理员认定不适宜的图片，都可能被删除。',
      '当サイトの利用により発生したトラブル等の責任を管理人は負いません。': '对于使用本站而引发的纠纷等问题，管理员不承担责任。',
      '理由の如何に関わらず、情報の変更及び本ウェブサイトの運用の中断または中止によって生じるいかなる損害についても責任を負うものではありません。 また、投稿した画像などの情報について管理人に保存義務はありません。適宜バックアップ等を取るようにして下さい。': '无论出于何种原因，因信息变更或网站暂停、终止运营而产生的任何损失，管理员均不承担责任。此外，管理员没有保存已投稿图片等信息的义务，请自行及时备份。',
      '当サイトではJavaScriptを使用しているため、ご利用のブラウザでJavaScriptを無効に設定されている場合、コンテンツなどが正しく表示されない場合があります。ご利用する場合はJavaScriptを有効にしてください。': '本站使用 JavaScript。如果浏览器禁用了 JavaScript，部分内容可能无法正常显示。请开启 JavaScript 后使用。',
      '当サイトでは「Googleアナリティクス」を利用しています。このGoogleアナリティクスはトラフィックデータの収集のためにCookieを使用します。このトラフィックデータは匿名で収集されており、個人を特定するものではありません。この機能はCookieを無効にすることで収集を拒否することが出来ますので、お使いのブラウザの設定をご確認ください。': '本站使用 Google Analytics 统计访问流量。该服务通过 Cookie 收集匿名数据，不会用于识别个人身份。您可以在浏览器设置中禁用 Cookie，以拒绝此类数据收集。',
      '当サイトに投稿された画像を、投稿者以外の方が外部へ無断で転載することは禁止です。': '未经投稿者许可，其他人不得擅自将本站图片转载到站外。',
      '１日の投稿上限は５件までです。': '每天最多投稿 5 件作品。',
      '管理人からのごあいさつ': '管理员寄语',
      'はじめまして！このサイトを作ったショーコです！': '大家好！我是创建这个网站的 Shoko！',
      'こんなところまで読んでいただいてありがとうございます！': '感谢你读到这里！',
      '皆さんはミラプリ楽しんでいますか？': '大家都在享受幻化的乐趣吗？',
      'わたしの場合、エオルゼアに降り立って１年くらいが経とうとしていますが、 冒険の先々で目でおってしまうのはやっぱり個性豊かなミラプリです。ただぼーっと街を行き交うオシャレヒカセンさんを眺めていることもあります。そのくらい大好きです。': '我来到艾欧泽亚快一年了，但旅途中最吸引我目光的，仍是大家个性十足的幻化。有时我甚至会发呆地看着街上衣着讲究的光之战士来来往往。我就是这么喜欢幻化。',
      'ファッションコンテストみたいなユーザー主催のイベントも最近だと増えてきて嬉しいです。': '最近玩家自发组织的时尚比赛等活动也越来越多，让我很开心。',
      'わたしの場合はそんな楽しみ方をしていますが、 ミラプリには他にもいろんな楽しみ方があると思います。見たい！見せたい！参考にしたい！etc... そんな風にミラプリを楽しんでいる方々にとって、使いやすいサイトを第一に心がけ制作しました。': '这是我享受幻化的方式，但我相信幻化还有许多其他乐趣：想欣赏、想展示、想借鉴……我制作这个网站时，最重视的就是让喜欢幻化的大家都能方便地使用。',
      'それでも個人の趣味で制作したものなので、至らぬ点は多々とあるとおもいます。要望などがあれば': '不过，这毕竟是出于个人爱好制作的网站，肯定还有很多不足。如果有什么建议，',
      'から気軽にご連絡頂けると嬉しいです！管理人が不敵な表情になります。': '欢迎随时通过以上渠道联系我！管理员会露出会心的微笑。',
      'これからもたくさんの人に利用してもらえるように頑張りますので、どうぞよろしくお願いします！': '我会继续努力，让更多玩家用得顺手，今后也请多多关照！',
    };

    /* =====================================================================
     * 第二部分：Eorzea Collection（ffxiv.eorzeacollection.com）界面汉化
     * 英文 → 中文；游戏术语（职业/职能/种族/部位）依灰机 FF14 中文维基
     * 采用「整段精确匹配」，用户产出的标题/作者/描述不会被误翻
     * ===================================================================== */

    // ⚠️ 自动生成（dict/dict-ec.json → build/inject_dicts.py）：勿手改本块；改词请改 JSON 后重新构建
    const DICT_EC = { ...DICT_COMMON,
      ', all about glamour.': '，一切都关于幻化。',
      'A Pair of Wings': '双翼',
      'A Realm Reborn': '重生之境',
      'About this Glamour': '关于这套幻化',
      'About this glamour': '关于这套幻化',
      'Academic Clothes': '学院风',
      'Accessories': '饰品',
      'Accessory Sets': '饰品',
      'Advanced Filters': '高级筛选',
      'Adventurer': '冒险者',
      'Aiming': '精准',
      'All News': '全部消息',
      'All Rights Reserved': '保留所有权利',
      'All Servers': '全部服务器',
      'All genders': '全部性别',
      'All servers': '全部服务器',
      'Alliance Raid': '团队任务',
      'An Error Occurred': '出错了',
      'Ancient': '古代',
      'Any': '任意',
      'Any Class': '全部职能',
      'Any Classification': '全部分类',
      'Any Color': '全部色系',
      'Any Gender': '任意性别',
      'Any Job': '全部职业',
      'Any Level': '任意等级',
      'Any Race': '全部种族',
      'Any Server': '任意服务器',
      'Any Style': '全部风格',
      'Any Theme': '全部主题',
      'Any body': '任意身体',
      'Any bracelets': '任意手镯',
      'Any earrings': '任意耳饰',
      'Any facewear': '任意面饰',
      'Any fashion accessory': '任意时尚配饰',
      'Any feet': '任意脚部',
      'Any hands': '任意手部',
      'Any head': '任意头部',
      'Any legs': '任意腿部',
      'Any main hand': '任意主手',
      'Any necklace': '任意项链',
      'Any offhand': '任意副手',
      'Any ring': '任意戒指',
      'Apply filters': '应用筛选',
      'Armor': '护甲',
      'Articles': '文章',
      'Athletic': '运动',
      'Autumn Outfit': '秋季装扮',
      'BODY': '身体',
      'BODY PIECE': '身体装备',
      'BODY PIECES': '身体装备',
      'Back Accessories': '背部配饰',
      'Back to Home': '返回首页',
      'Backpack': '背包',
      'Battle Content Drop': '战斗内容掉落',
      'Battle Content Gear': '战斗内容装备',
      'Battle Gear': '战斗装备',
      'Beast Herder\'s': '兽牧套装',
      'Beastmaster\'s': '兽主套装',
      'Become a Patron': '成为赞助人',
      'Become a patron to remove ads': '成为赞助人可移除广告',
      'Beige': '米色系',
      'Black': '黑色系',
      'Blacks': '黑色系',
      'Blue': '蓝色系',
      'Body': '身体',
      'Body pieces': '身体',
      'Bohemian': '波西米亚',
      'Bookmarked': '已收藏',
      'Bought in Shop': '商店购买',
      'Brass Goggles': '黄铜护目镜',
      'Brown': '棕色系',
      'Browse All': '浏览全部',
      'Browse All Chocobo Glamours': '浏览全部陆行鸟幻化',
      'Browse All Glamours': '浏览全部幻化',
      'Browse all': '浏览全部',
      'Browse all glamours': '浏览全部幻化',
      'Browse our stylish merch': '浏览我们的周边',
      'By Barding Equipped': '按已装备的装甲',
      'By Color': '按颜色',
      'By Content': '按内容',
      'By Gender': '按性别',
      'By Job': '按职业',
      'By Model': '按模型',
      'By Race': '按种族',
      'By Role': '按职能',
      'By Tag': '按标签',
      'Calamity Salvager': '灾祸回收人',
      'Carwen': '卡文套装',
      'Caster DPS': '法系职业',
      'Casting': '咏咒',
      'Cat Eye Glasses': '猫眼眼镜',
      'Checkout the ongoing fashion trends in Eorzea.': '查看艾欧泽亚当前的时尚趋势。',
      'Chic': '别致',
      'Chocobo Companion Glamours': '陆行鸟幻化',
      'Chocobo Glamours': '陆行鸟幻化',
      'Clear': '清空',
      'Clear filters': '清空筛选',
      'Collections': '合集',
      'Community Contests': '社区竞赛',
      'Community Interviews': '社区访谈',
      'Companion Glamours': '陆行鸟幻化',
      'Content Type': '内容类型',
      'Cool': '酷',
      'Cosplay': '角色扮演',
      'Craftable Glamours': '制作幻化',
      'Crafted Glamour': '制作幻化',
      'Crafted Sets': '制作套装',
      'Creature designs': '生物造型',
      'Cute': '可爱',
      'Cyber Outfit': '赛博装',
      'Dark': '暗黑',
      'Delete': '删除',
      'Description': '描述',
      'Desert Outfit': '沙漠装扮',
      'Disciples of War and Magic': '战斗精英与魔法导师',
      'Disciples of the Hand and Land': '能工巧匠与大地使者',
      'Discover our': '发现我们的',
      'Divine': '神圣',
      'Domed parasols': '圆顶阳伞',
      'Done': '完成',
      'Dungeon': '副本',
      'Dungeon Drop': '副本掉落',
      'Dyed': '已染色',
      'Dyes:': '染剂：',
      'ENTIRE SETS': '整套套装',
      'EXTRA FILTERS': '更多筛选',
      'Ear pieces': '耳部',
      'Earth': '大地',
      'Eastern': '东方',
      'Edit': '编辑',
      'Elegant': '优雅',
      'Entire Set': '整套',
      'Entire Sets': '整套',
      'Eorzea Collection line of merchandise': 'Eorzea Collection 周边系列',
      'Equipment List': '装备列表',
      'Eternal Bonding': '永结同心',
      'Exclude Special': '排除特殊',
      'Exclude mogstation bardings': '排除商城装甲',
      'Exclude mogstation items': '排除商城物品',
      'Exclude promotional accessories': '排除促销配饰',
      'Exclude promotional facewear': '排除促销面饰',
      'Exclude promotional sets': '排除促销套装',
      'Exclude seasonal accessories': '排除季节活动配饰',
      'Exclude seasonal bardings': '排除季节活动装甲',
      'Exclude seasonal facewear': '排除季节活动面饰',
      'Exclude seasonal items': '排除季节活动物品',
      'Exclude seasonal sets': '排除季节活动套装',
      'Exclude sets for all classes': '排除全职业通用套装',
      'Explore an': '探索',
      'Extensive': '丰富的',
      'Extra filters': '更多筛选',
      'FACE': '面饰',
      'FAVORITE OUTFITS': '收藏的穿搭',
      'FEET': '脚部',
      'FEET PIECE': '脚部装备',
      'FEET PIECES': '脚部装备',
      'FILTER BY TAG': '按标签筛选',
      'FINGER PIECES': '指环',
      'Face': '面饰',
      'Facewear': '面饰',
      'Fall Guys Collaboration Event Returns October 7!': '《糖豆人》联动活动 10 月 7 日回归！',
      'Fantasy': '奇幻',
      'Fashion Trends': '时尚趋势',
      'Favorites': '收藏夹',
      'Featured in Album': '收录于相册',
      'Feet': '脚部',
      'Feet pieces': '脚部',
      'Fending': '御敌',
      'Festival Hooded': '欢庆卫衣套装',
      'Filter By Tag': '按标签筛选',
      'Filter by Feet': '按脚部筛选',
      'Filter by barding body piece': '按身体装甲筛选',
      'Filter by barding head piece': '按头部装甲筛选',
      'Filter by barding legs piece': '按腿部装甲筛选',
      'Filter by body': '按身体筛选',
      'Filter by chocobo color': '按陆行鸟颜色筛选',
      'Filter by feet': '按脚部筛选',
      'Filter by hands': '按手部筛选',
      'Filter by head': '按头部筛选',
      'Filter by legs': '按腿部筛选',
      'Final Fantasy': '最终幻想',
      'Find my character': '查找我的角色',
      'Finger pieces': '手指',
      'Fire': '火焰',
      'Fits': '适用',
      'Follow us:': '关注我们：',
      'For Female Characters': '女性角色适用',
      'For Male Characters': '男性角色适用',
      'Forest Outfit': '森林装扮',
      'Forgot your password': '忘记密码',
      'Forgot your password?': '忘记密码？',
      'Formal': '正式',
      'Four Wings': '四翼',
      'Four wings': '四翼',
      'From Endwalker': '自晓月之终途起',
      'From Patch:': '版本：',
      'From the latest Patch': '最新版本起',
      'Futuristic': '未来',
      'GLAMOURS USING THIS ACCESSORY': '使用此配饰的幻化',
      'Game Order': '游戏顺序',
      'Gear Pieces': '装备部件',
      'Glamorous': '华丽',
      'Glamour Collection': '幻化收藏',
      'Glamour Creations': '幻化作品',
      'Glamour Set': '幻化套装',
      'Glamourous Merchandise': '幻化周边',
      'Glamours using this piece': '使用这件装备的幻化',
      'Glamours using this piece:': '使用这件装备的幻化：',
      'Glasses': '眼镜',
      'Go Back Home': '返回首页',
      'Gold': '金色系',
      'Gold Saucer Prize': '金碟奖励',
      'Goth': '哥特',
      'Grand Company Gear': '大国防联军装备',
      'Gray': '灰色系',
      'Green': '绿色系',
      'Grey': '灰色系',
      'Greys': '灰色系',
      'Grunge': '摇滚',
      'HANDS': '手部',
      'HANDS PIECE': '手部装备',
      'HANDS PIECES': '手部装备',
      'HEAD': '头部',
      'HEAD PIECE': '头部',
      'HEAD PIECES': '头部装备',
      'Hands': '手部',
      'Hands pieces': '手部',
      'Head': '头部',
      'Head pieces': '头部',
      'Healer': '治疗职业',
      'Healers': '治疗职能',
      'Healing': '治愈',
      'Heroic': '英勇',
      'Historical': '历史',
      'Holy': '神圣',
      'House Wear': '家居服',
      'Hyur Midlander': '人族·中原之民',
      'Ice': '冰',
      'Idle Clothes': '休闲装',
      'Intended For': '适用',
      'Intended for': '适用对象',
      'Intended only for': '仅适用于',
      'Job Artifact': '职业校服',
      'Job Artifact Armor': '职业校服',
      'Join us for Duty Commenced on October 7!': '10 月 7 日「任务开始」直播，欢迎参加！',
      'LEGS': '腿部',
      'LEGS PIECE': '腿部装备',
      'LEGS PIECES': '腿部装备',
      'Last Month': '上个月',
      'Last Week': '上周',
      'Last Year': '去年',
      'Latest Companion Glamours': '最新搭档幻化',
      'Latest Gearsets': '最新套装',
      'Latest Glamours': '最新幻化',
      'Latest Lodestone News': '最新 Lodestone 新闻',
      'Latest News': '最新消息',
      'Latest Patch': '最新版本',
      'Latest Updates': '最新更新',
      'Learn More': '了解更多',
      'Legs': '腿部',
      'Legs pieces': '腿部',
      'Less filters': '收起筛选',
      'Level to Equip': '装备等级',
      'Lightning': '雷',
      'Loved': '已点赞',
      'Loves': '点赞数',
      'Low-level': '低等级',
      'MORE SHADED GLASSES': '更多遮光眼镜',
      'Magical': '魔法',
      'Magnifiers': '放大镜',
      'Maiming': '制敌',
      'Maximum Level': '最高等级',
      'Maximum level': '最高等级',
      'Medieval': '中世纪',
      'Meet our Contributors': '认识我们的贡献者',
      'Melee DPS': '近战职业',
      'Metallic': '金属色系',
      'Military Gear': '军装',
      'Minimum Level': '最低等级',
      'Minimum level': '最低等级',
      'Model': '模型',
      'Modern': '现代',
      'Mogstation Set': '商城套装',
      'Monochromatic': '单色系',
      'Monocle': '单片眼镜',
      'Monocles': '单片眼镜',
      'Monthly': '每月',
      'More Glamours by': '该作者的更多幻化',
      'More filters': '更多筛选',
      'More glamours by': '该作者的更多幻化',
      'Most Loved': '最受欢迎',
      'Most Loved Glamours': '最受欢迎的幻化',
      'My Account': '我的账号',
      'NECK PIECES': '颈饰',
      'Nature': '自然',
      'Nature Outfit': '自然装扮',
      'Neck pieces': '颈部',
      'Neo Citizen\'s': '新生国民套装',
      'Neon': '霓虹色系',
      'Neutrals': '中性色',
      'News and Articles': '新闻与文章',
      'Not Found': '未找到',
      'OFFHAND': '副手',
      'ORDER BY': '排序方式',
      'Offhand': '副手',
      'Online Store Exclusive': '商城限定',
      'Only Missing': '仅未拥有',
      'Only Owned': '仅已拥有',
      'Oops': '哎呀',
      'Optional': '可选',
      'Or Sign Up using': '或使用以下方式注册',
      'Orange': '橙色系',
      'Order by': '排序方式',
      'Other': '其他',
      'Other Content Gear': '其他内容装备',
      'Other Content Reward': '其他内容奖励',
      'Oversized Plain Hooded': '大码素色卫衣套装',
      'PVP Gear': 'PvP 装备',
      'Pair of wings': '双翼',
      'Paper parasols': '油纸伞',
      'Parasols': '阳伞',
      'Participate in': '参与',
      'Party Outfit': '派对装',
      'Pastel': '粉彩色系',
      'Patch 7.1 Update': '版本 7.1 更新',
      'Patron Challenge': '赞助人挑战',
      'Patron Challenges': '赞助人挑战',
      'Patrons': '赞助人',
      'Phantom Vision': '幻境意象',
      'Pink': '粉色系',
      'Pirate': '海盗',
      'Plain Hooded': '素色卫衣套装',
      'Please let us know what happened': '请告知我们发生了什么',
      'Please login to bookmark glamours': '登录后可收藏幻化',
      'Please login to love glamours': '登录后可点赞',
      'Praemagitek': '前魔导',
      'Promotional Item': '促销物品',
      'Promotional Set': '促销套装',
      'Purple': '紫色系',
      'PvP Gear': 'PvP 装备',
      'PvP Series Reward': 'PvP 系列奖励',
      'Quests': '任务',
      'RELATED TO': '相关',
      'RESET FILTERS': '重置筛选',
      'Ranged DPS': '远程职业',
      'Rarity': '稀有度',
      'Read More': '阅读更多',
      'Read more': '阅读更多',
      'Read more news': '更多消息',
      'Recent Patch': '最新版本',
      'Red': '红色系',
      'Related to': '相关',
      'Report': '举报',
      'Reset filters': '重置筛选',
      'Retro': '复古',
      'Round glasses': '圆框眼镜',
      'Royalty': '王室',
      'Rules and Guidelines': '规则与指南',
      'Rules and guidelines': '规则与指南',
      'SHADED GLASSES': '遮光眼镜',
      'Saving...': '保存中…',
      'Scouting': '游击',
      'Scrips Exchange': '票据兑换',
      'Search...': '搜索…',
      'Seasonal Event Gear': '季节活动装备',
      'Seasonal Event Reward': '季节活动奖励',
      'Seasonal Item': '季节限定',
      'Sexy': '性感',
      'Shaded glasses': '墨镜',
      'Shadowbringers': '漆黑之逆焰',
      'Show All': '显示全部',
      'Show all': '显示全部',
      'Show only glamour dresser outfits': '只显示幻化衣柜中的套装',
      'Show only job-exclusive': '只显示职业专属',
      'Show:': '显示：',
      'Sign in with Discord': '使用 Discord 登录',
      'Sign in with Google': '使用 Google 登录',
      'Sign in with Square Enix': '使用 Square Enix 登录',
      'Silver': '银色系',
      'Simple Spectacles': '简约眼镜',
      'Single Piece': '单件',
      'Slim Frame Glasses': '细框眼镜',
      'Something is broken': '出了点问题',
      'Sorry for any inconvenience caused': '抱歉给您带来不便',
      'Sort by:': '排序：',
      'Special': '特殊',
      'Special Occasions': '特殊场合',
      'Spiritual': '灵性',
      'Sportswear': '运动装',
      'Spring Outfit': '春季装扮',
      'Steampunk': '蒸汽朋克',
      'Striking': '强袭',
      'Strong': '强壮',
      'Studded Eyepatch (Left)': '左侧钉扣眼罩',
      'Studded Eyepatch (Right)': '右侧钉扣眼罩',
      'Submit Chocobo glamour': '提交陆行鸟幻化',
      'Submit Glamour': '投稿幻化',
      'Submit Your Own': '投稿你的幻化',
      'Submit a Glamour': '投稿幻化',
      'Submit your own': '提交你自己的',
      'Submitted on:': '投稿于：',
      'Submitted:': '提交时间：',
      'Successor\'s': '继承者套装',
      'Succubus Hooded': '梦魔卫衣套装',
      'Summer Outfit': '夏季装扮',
      'Sunglasses': '太阳镜',
      'Support Us': '支持我们',
      'Support the site': '支持本站',
      'Sweet': '甜美',
      'Swimwear': '泳装',
      'TOP': '顶部',
      'Tags:': '标签：',
      'Tank': '防护职业',
      'Tanks': '防护职能',
      'Tataru': '塔塔露',
      'Terms of Service': '服务条款',
      'The 2024 Yearly Census is now live!': '2024 年度普查现已开启！',
      'The Rising Stones': '石之家',
      'This Expansion': '当前资料片',
      'This Year': '今年',
      'Token Exchange': '代币兑换',
      'Tomestones': '神典石',
      'Tomestones Exchange': '神典石兑换',
      'Torna': '托纳套装',
      'Tradewinds': '贸易风套装',
      'Treasure Hunt Drop': '寻宝掉落',
      'Trial Drop': '歼灭战掉落',
      'Tribal': '部落',
      'Tule': '图尔套装',
      'Turquoise': '青绿色系',
      'Under-rim Glasses': '下框眼镜',
      'Undyed': '未染色',
      'Untradable': '不可交易',
      'Up to Free Trial': '免费体验范围内',
      'Up to Level 90': '90 级以下',
      'Using': '使用中',
      'Vacation': '度假',
      'Vana\'dielian': '瓦纳·迪尔',
      'Vibrant': '鲜艳色系',
      'Views': '浏览',
      'Villainous': '邪恶',
      'Vintage': '怀旧',
      'WRIST PIECES': '腕饰',
      'Water': '水',
      'We will fix it as soon as possible': '我们会尽快修复',
      'Weaver': '裁缝师',
      'Weekly': '每周',
      'White': '白色系',
      'Whites': '白色系',
      'Wild West Outfit': '西部装扮',
      'Wind': '风',
      'Winter Outfit': '冬季装扮',
      'Wrist pieces': '腕部',
      'Yearly Census': '年度统计',
      'Yellow': '黄色系',
      'Yesterday': '昨天',
      'Youthful': '年轻',
      'Yozakura': '夜樱装束',
      'Zero\'s Luminary': '零点套装',
      'and Articles': '与文章',
      'and Glamour Challenges': '与幻化挑战',
      'collection of collections': '合集的合集',
      'for being': '如此',
      'from': '从',
      'glamourous': '华丽',
      'in The Rising Stones (X:6.1 Y:5.9)': '在石之家（X:6.1 Y:5.9）',
      'started in March, 2016 as a gear catalogue website.': '始于 2016 年 3 月，最初是一个装备图鉴网站。',
      'thank you': '谢谢',
      'thank you for being glamourous': '谢谢你如此华丽',
      'type to search gear pieces..': '输入以搜索装备…',
      'you need to be logged in to love': '需要登录才能点赞',
      'you need to be logged in to save as favorite': '需要登录才能收藏',
      'your own': '你的',
      '~ How to obtain ~': '~ 获取方式 ~',
      '–– Color ––': '–– 颜色 ––',
      '–– Creator ––': '–– 作者 ––',
      '–– Description ––': '–– 描述 ––',
      '–– Gear ––': '–– 装备 ––',
      '— Accessories —': '— 饰品 —',
      '— Commonly Neglected —': '— 常被忽视 —',
      '— Equipment —': '— 装备 —',
      '— Most Used from Dawntrail —': '— 晓月之终途最常用 —',
      '— New Aliance Raid —': '— 新团队任务 —',
      '— New Craftable Glamours —': '— 新制作幻化 —',
      '— New Dungeon —': '— 新副本 —',
      '— New Emotes —': '— 新情感动作 —',
      '— New Hairstyles —': '— 新发型 —',
      '— New Minions —': '— 新宠物 —',
      '— New Mounts —': '— 新坐骑 —',
      '— New Optional Items —': '— 新商城物品 —',
      '— New PvP Items —': '— 新 PvP 物品 —',
      '— New Quest Rewards —': '— 新任务奖励 —',
      '— News and Articles —': '— 新闻与文章 —',
      '— Recently Popular —': '— 最近流行 —',
      'FINAL FANTASY XIV Online Store': '最终幻想 XIV 在线商店',
      'Online Store': '在线商店',
      'Requirements': '要求',
      'Allowed': '允许',
      'Not Allowed': '不允许',
      'Restrictions': '限制',
      'Do': '应当遵守',
      'Don\'t': '禁止事项',
      'Search for option': '搜索选项',
      'main navigation': '主导航',
      'pagination': '分页导航',
      'Previous slide': '上一张图片',
      'Next slide': '下一张图片',
      'Basic (White)': '普通（白色）',
      'Plundered (Green)': '稀有（绿色）',
      'Legendary (Blue)': '精良（蓝色）',
      'Set': '套装',
      'Display': '显示',
      'Rewarded from the quest': '任务奖励',
      'Please be sure to read and adhere to each rule carefully.': '请仔细阅读并遵守每条规则。',
      'Rules for screenshots': '截图规则',
      'Minimum requirements for a glamour': '幻化的基本要求',
      'About Modded content': '关于模组内容',
      'About Weapon and Gear Manipulation': '关于武器与装备修改',
      'About Size Manipulation': '关于大小调整',
      'About the Usage of Props': '关于道具的使用',
      'About NPCs': '关于非玩家角色',
      'About Custom Backgrounds': '关于自定义背景',
      'Guidelines for submitting a glamour': '幻化投稿指南',
      'About Submitting your Glamour': '关于提交幻化',
      'About Optional & Alternative Items': '关于可选与替代装备',
      'Duplicate Content': '重复内容',
      'Appropriate Content': '适当的内容',
      'Negative Content': '不当内容',
      'Editing Glamours': '编辑幻化作品',
      'Code of conduct': '行为准则',
      'Giving Credit and Drawing Inspiration': '注明来源与参考创意',
      'Reporting Content': '举报内容',
      'Inflating Likes and Multiple Accounts': '刷赞及使用多个账号',
      'Seasonal item': '季节活动物品',
      'Mogstation exclusive': '官方商城专属',
      'ALL': '全部',
      'icon': '图标',
      'Browse more glamours': '浏览更多幻化',
      'Male': '男性',
      'Female': '女性',
      'Caster': '法系职业',
      'Melee': '近战职业',
      'Ranged': '远程职业',
      'Info': '信息',
      'Quest': '任务',
      'and Master XII': '且需要制作秘籍第十二卷',
      'Crafting': '制作',
      'Female Set': '女性套装',
      'From the heights of Mount Rokkon to your glamour dresser!': '从六根山之巅，到你的幻化衣柜！',
      'glamours using this piece': '使用此装备的幻化',
      'Melee Maiming DPS': '近战制敌输出职业',
      'Melee Scouting DPS': '近战游击输出职业',
      'Related': '相关',
      'Related Sets': '相关套装',
      'Sets': '套装',
      'Tradable': '可交易',
      'Weapons': '武器',
      'with a recipe level': '配方等级',
    };

    /* =====================================================================
     * 第四部分：ff14-fc.com（ミラプリライフ）界面汉化 + 装备名跳转
     * ===================================================================== */

    // 界面词表（日文 → 中文），按 FF14 国服官方译名
    // ⚠️ 自动生成（dict/dict-fc.json → build/inject_dicts.py）：勿手改本块；改词请改 JSON 后重新构建
    const DICT_FC = { ...DICT_COMMON,
      '部位別': '按部位',
      'シリーズ': '系列',
      'ヘアカタログ': '发型图鉴',
      'カテゴリ別': '按分类',
      'お役立ち': '实用',
      'アイテム': '物品',
      '検索条件': '搜索条件',
      '検索結果': '搜索结果',
      '記事を読む': '阅读文章',
      '見た目・入手方法': '外观·获取方式',
      '各種族での見た目・入手方法': '各种族外观·获取方式',
      '見た目・入手方法まとめ': '外观·获取方式汇总',
      'スタイルカタログ': '样式目录',
      '髪型': '发型',
      'コラボ': '联动',
      '新着情報': '最新信息',
      'パッチ情報': '补丁信息',
      'まとめ': '汇总',
      '上のメニューから絞り込みができます': '可从上方菜单筛选',
      'なし': '无',
      'マーケット': '市场',
      '近接物理DPS': '近战物理DPS',
      '全ジョブ一覧': '全职业一览',
      '宇宙開拓': '宇宙开拓',
      '友好部族': '友好部族',
      'イシュガルド復興': '伊修加德复兴',
      'リンク先で各種族や男女ごとの装備の見た目や入手方法が確認できます': '在跳转页面可查看各种族及男女装备的外观与获取方式',
      'の見た目や入手方法が確認できます': '的外观与获取方式',
      'レビュー': '评价',
      'おすすめ': '推荐',
      '更新情報': '更新信息',
      '最終更新': '最后更新',
      '関連記事': '相关文章',
      'トップへ戻る': '返回顶部',
      'ページトップへ': '回到顶部',
      '絞り込み条件': '筛选条件',
      '条件をクリア': '清除条件',
      '該当する装備': '匹配的装备',
      '該当件数': '匹配数量',
      '件': '件',
      '表示件数': '显示数量',
      '動画': '视频',
      'メニュー': '菜单',
      'サイトマップ': '网站地图',
      '利用規約': '使用条款',
      'カテゴリ': '分类',
      'アーカイブ': '归档',
      '月別': '按月',
      '週間': '周榜',
      '人気記事': '热门文章',
      '最新記事': '最新文章',
      '関連サイト': '相关站点',
      '目次': '目录',
      '続きを読む': '阅读全文',
      '選択してください': '请选择',
      'を選択': '选择',
      '以上': '以上',
      '以下': '以下',
      '未満': '以下',
      '含む': '包含',
      '除外': '排除',
      'のみ表示': '仅显示',
      '装備詳細': '装备详情',
      '装備情報': '装备信息',
      '基本性能': '基础性能',
      '物理防御力': '物理防御力',
      '魔法防御力': '魔法防御力',
      '耐久力': '耐久度',
      'マテリア装着': '魔晶石镶嵌',
      '修理': '修理',
      '修理レベル': '修理等级',
      '修理素材': '修理材料',
      '二色染色': '双染色',
      '売却価格': '出售价格',
      '製作レシピ': '制作配方',
      '素材': '材料',
      '入手': '获取',
      '購入': '购买',
      'ドロップ': '掉落',
      'アチーブメント': '成就',
      '実績': '成就',
      'ペット': '宠物',
      'エモート': '情感动作',
      'ハウジング': '房屋',
      '調度品': '家具',
      '庭具': '庭具',
      '食材': '食材',
      '素材品': '材料',
      'その他アイテム': '其他物品',
      'クリック': '点击',
      'タップ': '点击',
      'クリックして拡大': '点击放大',
      'タップして拡大': '点击放大',
      'クリックで詳細': '点击查看详情',
      '拡大': '放大',
      '縮小': '缩小',
      'TOP': '首页',
      '新生': '重生',
      '蒼天': '苍穹',
      '紅蓮': '红莲',
      '漆黒': '暗影',
      '暁月': '晓月',
      '黄金': '金曦',
      'パッチ': '补丁',
      'バージョン': '版本',
      'アップデート': '更新',
      '盾': '盾',
      '防具': '防具',
      '胴着': '上装',
      'メンテナンス': '维护',
      'メンテナンス中': '维护中',
      '只今より数十分の間、メンテナンス中です': '目前正在维护中，预计数十分钟',
      '只今より数十分の間、メンテナンス中です……！': '目前正在维护中，预计数十分钟……！',
      '装備一覧＆検索': '装备一览&搜索',
      '装備の見た目一覧サイト': '装备外观一览站',
      'ミラプリライフ': '幻化生活',
      'エリィ': '艾莉',
      'お問い合わせフォーム': '联系表单',
      '著作権': '著作权',
      '免責事項': '免责声明',
      '登録商標': '注册商标',
      '商標': '商标',
      '各社の商標、または登録商標です': '为各公司之商标或注册商标',
      '無断転載': '未经授权转载',
      '禁止': '禁止',
      'ツイッター': '推特',
      'フォロー': '关注',
      'ツイートする': '发推文',
      'ページ': '页',
      'カテゴリ一覧': '分类一览',
      'バックナンバー': '往期',
      '一覧': '一览',
      '検索結果一覧': '搜索结果一览',
      'このページについて': '关于本页',
      '更新履歴': '更新记录',
      'お知らせ': '公告',
      '運営': '运营',
      '管理人': '管理员',
      '画像をクリック': '点击图片',
      'で拡大': '放大',
      'プルダウン': '下拉',
      'プルダウンで選択': '下拉选择',
      'チェック': '勾选',
      'チェックボックス': '复选框',
      'ラジオボタン': '单选按钮',
      'テキストボックス': '文本框',
      'ここに入力': '在此输入',
      '入力してください': '请输入',
      'を入力': '输入',
      '半角': '半角',
      '全角': '全角',
      'ひらがな': '平假名',
      'カタカナ': '片假名',
      'アルファベット': '字母',
      '数字': '数字',
      '記号': '符号',
      '必須': '必填',
      '任意': '选填',
      '送信': '发送',
      'OK': '确定',
      'はい': '是',
      'いいえ': '否',
      '次へ進む': '继续',
      '開く': '展开',
      '展開する': '展开',
      '折りたたむ': '收起',
      'すべて表示': '全部显示',
      '一部表示': '部分显示',
      '表示': '显示',
      '非表示': '隐藏',
      '固定': '固定',
      '解除': '解除',
      '初期化': '初始化',
      'カスタム': '自定义',
      'オプション': '选项',
      '詳細設定': '详细设置',
      '絞り込み検索': '筛选搜索',
      '条件指定': '指定条件',
      'キーワード検索': '关键词搜索',
      'フリーワード': '自由词',
      'お気に入り登録': '添加收藏',
      '実用': '实用',
      '物品': '物品',
      '詳細': '详情',
      '一覧を見る': '查看一览',
      '一覧へ': '前往一览',
      '検索はこちら': '点击搜索',
      'はこちら': '点这里',
      'こちら': '这里',
      'ヘアカタログ髪型': '发型图鉴',
      'カタログ': '目录',
      'スタイル': '样式',
      'コーデ': '搭配',
      'ジョブレベル': '职业等级',
      'ジョブチェンジ': '切换职业',
      'ロールクエスト': '职能任务',
      'ノート': '笔记',
      'ストーリー': '剧情',
      'コンテンツ': '内容',
      'パーティ': '小队',
      'ソロ': '单人',
      'マッチング': '匹配',
      'ルーレット': '随机任务',
      'コンテンツルーレット': '随机任务',
      'ギルド': '公会',
      'リテイナー': '雇员',
      'マーケットボード': '市场布告板',
      'リムサ': '利姆萨',
      'グリダニア': '格里达尼亚',
      'ウルダハ': '乌尔达哈',
      'イシュガルド': '伊修加德',
      'クガネ': '黄金港',
      'ラザハン': '拉札罕',
      'トライヨラ': '图莱尤拉',
      'オールドシャーレアン': '旧萨雷安',
      'クリスタリウム': '水晶都',
      'エーテライト': '以太之光',
      'テレポ': '传送',
      'コンパニオン': '搭档',
      'ミニオン': '宠物',
      'マウント': '坐骑',
      'オーケストリオン': '管弦乐琴',
      'ハウジングエリア': '住宅区',
      'トリプルトライアド': '九宫幻卡',
      'ドマ式麻雀': '多玛方城战',
      'ジャンピング': '跳跃',
      'エモート一覧': '情感动作一览',
      'コンテンツファインダー': '任务搜索器',
      'パーティ募集': '小队招募',
      'フレンド': '好友',
      'リンクシェル': '通讯贝',
      'フリーカンパニー': '部队',
      'ロドスト': '战友列表',
      'ロードストーン': '战友列表',
      '公式サイト': '官方网站',
      'スクウェア・エニックス': '史克威尔艾尼克斯',
      'ファイナルファンタジーXIV': '最终幻想XIV',
      'ファイナルファンタジー': '最终幻想',
      'プロデューサー': '制作人',
      'ディレクター': '总监',
      'パッチノート': '更新笔记',
      'パッチノート公開': '更新笔记公开',
      'アプデ': '更新',
      'メンテ': '维护',
      'アーリーアクセス': '抢先体验',
      '拡張パッケージ': '资料片',
      '体験版': '试玩版',
      '無料トライアル': '免费试玩',
      'キャラクリ': '捏脸',
      'キャラクタークリエイト': '角色创建',
      'データセンター': '数据中心',
      '種族変更': '种族变更',
      '幻想薬': '幻想药',
      'グレア': '光泽',
      'ドレスアップ': '外观搭配',
      'コスチューム': '服装',
      'ドレス': '连衣裙',
      'ワンピース': '连衣裙',
      'スカート': '短裙',
      'パンツ': '裤子',
      'トラウザー': '长裤',
      'シャツ': '衬衫',
      'ブラウス': '女衬衫',
      'ジャケット': '夹克',
      'コート': '外套',
      'ローブ': '长袍',
      'ケープ': '披风',
      'マント': '斗篷',
      'ベスト': '马甲',
      'チュニック': '束腰衣',
      'ハーフグローブ': '半指手套',
      'グローブ': '手套',
      'ミトン': '连指手套',
      'ブーツ': '长靴',
      'シューズ': '鞋',
      'サンダル': '凉鞋',
      'ソックス': '袜子',
      'タイツ': '紧身裤',
      'ニーソックス': '过膝袜',
      'ストッキング': '长筒袜',
      'ベルト': '腰带',
      'サッシュ': '腰布',
      'チョーカー': '颈环',
      'イヤリング': '耳环',
      'ピアス': '耳钉',
      'アンクレット': '脚环',
      'マフラー': '围巾',
      'スカーフ': '围巾',
      'ベール': '面纱',
      'ティアラ': '头冠',
      'ヘッドドレス': '头饰',
      'イヤーカフ': '耳夹',
      'フェイスアクセサリー': '面部配饰',
      'イベント': '活动',
      'ノーマルレイド': '普通团队任务',
      '討伐・討滅戦': '讨伐·歼殛战',
      '討伐戦': '讨伐战',
      '討滅戦': '歼殛战',
      '零式': '零式',
      '絶レイド': '绝境战',
      'ディープダンジョン': '深层迷宫',
      'ヴァリアントダンジョン': '多变迷宫',
      'F.A.T.E': 'F.A.T.E',
      '宝の地図': '藏宝图',
      'モグコレ': '莫古莫古大收集',
      '戦闘コンテンツ': '战斗内容',
      'ジョブ専用装備': '职业专用装备',
      'メインクエスト': '主线任务',
      'サブクエスト': '支线任务',
      'イベントクエスト': '活动任务',
      'ジョブクエスト': '职业任务',
      '大規模クエスト': '大型任务',
      'NPC取引': 'NPC兑换',
      'スクリップ': '票据',
      'ギル購入': '金币购买',
      'トークン': '代币',
      'クロの空想帳': '库洛的奇谈书',
      'ソーチョー': '狩猎',
      'モブハント': '怪物狩猎',
      'ゴールドソーサー': '金碟游乐场',
      '軍票': '军票',
      '購入特典': '购买特典',
      'ベテランリワード': '老手奖励',
      '無人島開拓': '无人岛开拓',
      'サブマリンボイジャー': '潜水艇远航',
      'エアシップボイジャー': '飞空艇远航',
      'ヴァレンティオンデー': '恋人节',
      'プリンセスデー': '女儿节',
      'エッグハント': '彩蛋狩猎',
      '紅蓮祭': '红莲节',
      '守護天節': '守护天节',
      '星芒祭': '星芒节',
      '他作品コラボ': '其他作品联动',
      '牙狼': '牙狼',
      'ボズヤ': '博兹雅',
      'エウレカ': '优雷卡',
      'レジスタンスウェポン': '义军武器',
      'エウレカウェポン': '优雷卡武器',
      'アニマウェポン': '元灵武器',
      'ゾディアックウェポン': '黄道武器',
      'マンダヴィルウェポン': '曼德维尔武器',
      'コスモエクスプローラー': '宇宙探索者',
      '兜': '头盔',
      'ヘッドギア・フェイスガード': '头饰·面罩',
      'マスク': '面罩',
      'ヴェール': '头纱',
      'バンダナ・ヘッドバンド': '头巾·发带',
      'ゴーグル・スコープ': '护目镜·瞄准镜',
      '眼鏡・サングラス': '眼镜·太阳镜',
      '眼帯': '眼罩',
      'フード': '兜帽',
      '着ぐるみ・スーツ': '玩偶装·套装',
      'パワードスーツ': '动力装甲',
      'ヘッドセット': '头戴设备',
      '帽子': '帽子',
      'ハット': '宽檐帽',
      'シルクハット': '礼帽',
      'カウボーイハット': '牛仔帽',
      '魔女帽子': '魔女帽',
      'キャップ': '鸭舌帽',
      'ベレー': '贝雷帽',
      'ロシア帽': '俄罗斯帽',
      '三角帽': '三角帽',
      '博士帽': '博士帽',
      'ニット帽': '针织帽',
      'ターバン': '头巾',
      '笠': '斗笠',
      'その他帽子': '其他帽子',
      'ヘッドドレス・ヘアアクセサリー': '头饰·发饰',
      '冠・ティアラ': '王冠·头冠',
      'サークレット': '头环',
      'カチューシャ': '发箍',
      'リボン': '蝴蝶结',
      'エクステ': '接发',
      '角': '角饰',
      'その他ヘッドドレス・ヘアアクセサリー': '其他头饰·发饰',
      'パーティー': '派对',
      '東方風': '东方风',
      'バレンタイン': '情人节',
      'ひな祭り': '女儿节',
      'イースター': '复活节',
      '夏祭り': '夏日祭',
      '海': '海洋',
      'ハロウィン': '万圣节',
      'クリスマス': '圣诞节',
      '花・植物': '花·植物',
      '獣': '野兽',
      '羽根・翼': '羽毛·翅膀',
      'モチーフ': '主题',
      'NPCコスチューム': 'NPC服装',
      '頭防具一覧': '头部防具一览',
      '胴防具一覧': '身体防具一览',
      '手防具一覧': '手部防具一览',
      '脚防具一覧': '腿部防具一览',
      '足防具一覧': '脚部防具一览',
      '防具シリーズの一覧': '防具系列一览',
      '武器の一覧': '武器一览',
      'ファッションアクセ 一覧': '时尚配饰一览',
      'ヘアカタログ髪型一覧': '发型图鉴一览',
      '装備まとめ': '装备汇总',
      'アイテム紹介': '物品介绍',
      '攻略・お役立ち': '攻略·实用',
      'まとめTOP': '汇总TOP',
      'ジョブ専用(AF)': '职业专用(AF)',
      'おしゃれ装備': '时尚装备',
      'エリィ日記': '艾莉日记',
      'まとめ記事(更新停止)': '汇总文章(停止更新)',
      '装備一覧・検索': '装备一览·检索',
      '装備の一覧検索・絞り込みはこちら': '装备一览检索·筛选点这里',
      '装備一覧検索': '装备一览检索',
      '装備部位': '装备部位',
      'クリックで切替': '点击切换',
      'タップで切り替え': '点击切换',
      '主な入手方法': '主要获取方式',
      '基本情報': '基本信息',
      '装備可能レベル': '可装备等级',
      'マーケット取引': '市场交易',
      'ヴィエラ頭防具': '维埃拉头部防具',
      'ヴィエラ頭': '维埃拉头部',
      '関連アイテム': '相关物品',
      '全て閉じる': '全部关闭',
      'もっと詳しく': '更多详情',
      '詳しい入手方法♪(タップで開く)': '详细获取方式♪(点击展开)',
      '入手方法は？': '获取方式？',
      '関連装備': '相关装备',
      'Gallery': '画廊',
      'Info': '信息',
      'ディフェンダー': '御敌',
      'スレイヤー': '制敌',
      'ストライカー': '强袭',
      'スカウト': '游击',
      'レンジャー': '精准',
      'メレー': '近战',
      'レンジ': '远程',
      '特徴・形': '特征·形状',
      '雰囲気': '氛围',
      'カテゴリー': '分类',
      '入手方法カテゴリ': '获取方式分类',
      '女性専用': '女性专用',
      '男性専用': '男性专用',
      '女性〇': '女性○',
      '男性〇': '男性○',
      '表示可': '可见',
      '表示不可': '不可见',
      '名前昇順': '名称升序',
      '名前降順': '名称降序',
      '該当なし': '无匹配',
      '条件をリセット': '重置条件',
      'すべて見る': '查看全部',
      'New Equipment': '新装备',
      '新着装備': '新装备',
      'Feature': '特辑',
      '特集': '特辑',
      '部位ごと': '按部位',
      'New Fashion Accessories': '新时尚配饰',
      'Category': '分类',
      'Package': '资料片',
      'パッケージ': '资料片',
      'Dream Fitting': '幻想试穿',
      '各種族で幻想試着ツール': '各种族幻想试穿工具',
      '漆黒のヴィランズ': '暗影之逆焰',
      '新生エオルゼア': '新生艾欧泽亚',
      'クリア': '清除',
      '装備シリーズ': '装备系列',
      '装備特集': '装备特辑',
      '前往一覧': '前往一览',
      '装備シリーズ前往一覧': '前往装备系列一览',
      '装備特集の前往一覧': '前往装备特辑一览',
      'サバント': '学术',
      '装備特輯の前往一覧': '前往装备特辑一览',
      '装備特輯': '装备特辑',
      '武器一覧へ': '前往武器一览',
      '装備特集の一覧へ': '前往装备特辑一览',
      '装備パーツごとの一覧へ': '前往装备部位分类一览',
      '装備シリーズ一覧へ': '前往装备系列一览',
      'ヘアカタログ一覧へ': '前往发型图鉴一览',
      'ファッションアクセ一覧へ': '前往时尚配饰一览',
      '装備シリーズへ': '前往装备系列',
      '外着': '外套',
      'ネイル': '美甲',
      'スラックス': '西装裤',
      '長靴': '长靴',
      '籠手': '手甲',
      'スキニー': '紧身裤',
      '下駄・足袋': '木屐·足袋',
      '下駄': '木屐',
      '足袋': '足袋',
      '片手剣': '单手剑',
      '両手斧': '大斧',
      '両手剣': '双手剑',
      '両手槍': '长枪',
      'ガンシールド': '枪盾',
      '格闘武器': '格斗武器',
      '双剣': '双剑',
      '両手鎌': '双手镰刀',
      '二刀流武器': '蝰蛇对剑',
      '投擲武器': '投掷武器',
      '細剣': '刺剑',
      '呪具': '咒杖',
      '幻具': '幻杖',
      '天球儀': '天球仪',
      '片手斧': '单手斧',
      '男女見た目・入手方法': '男女外观·获取方式',
      '一覧＆検索': '一览&搜索',
      '一覧・検索': '一览·搜索',
      'クレセントアイル': '新月岛',
      'FF14装備の見た目一覧サイト': 'FF14 装备外观一览站',
      'お問い合わせ・メッセージ': '咨询·留言',
      'エフエフ14アンテナ': 'FF14 天线',
      '＆検索': '&搜索',
      'FF14 部位ごと一覧・検索': 'FF14 部位分类一览·搜索',
      'FF14 装備シリーズ一覧・検索': 'FF14 装备系列一览·搜索',
      'FF14 全ファッションアクセサリー一覧・検索': 'FF14 全时尚配饰一览·搜索',
      'FF14 ヘアカタログ一覧・検索': 'FF14 发型图鉴一览·搜索',
      'FF14 武器シリーズ一覧・検索': 'FF14 武器系列一览·搜索',
      '装備👗': '装备👗',
      '装備⚔️': '装备⚔️',
      '装備💍': '装备💍',
      '装備✂': '装备✂',
      '装備🎃': '装备🎃',
      '装備🎄': '装备🎄',
      '装備🌸': '装备🌸',
      '装備❤️': '装备❤️',
      '装備✨': '装备✨',
      '記載されている会社名・製品名・システム名などは、各社の商標、または登録商標です。': '文中提及的公司名、产品名、系统名等，均为各公司的商标或注册商标。',
      'しばらく後に再度アクセスして頂きますと嬉しいです！': '请稍后再访问本站！',
      'エラー表記が出る可能性があります。': '部分内容可能显示异常。',
      'FF14の装備について一覧で紹介しているページです。各種族や男女ごとの見た目や入手方法がリンク先で確認できます。ミラプリの参考にどうぞ♪': 'FF14 全装备一览介绍页。各种族、男女的外观与获取方式均可在链接页查看，欢迎作为幻化参考♪',
      'FF14の武器の見た目を一覧で紹介しているページです。詳しい見た目や入手方法がリンク先で確認できます♪': 'FF14 武器外观一览介绍页。详细外观与获取方式均可在链接页查看♪',
      'FF14の頭装備を一覧で紹介しているページです。 特徴や雰囲気、入手方法での絞り込みや検索も可能です。リンク先で男女ごとの見た目や入手方法が確認できます♪': 'FF14 头部装备一览介绍页。支持按特征、风格、获取方式筛选与搜索，男女外观与获取方式均可在链接页查看♪',
      'FF14の頭装備を一覧で紹介しているページです。特徴や雰囲気、入手方法での絞り込みや検索も可能です。リンク先で男女ごとの見た目や入手方法が確認できます♪': 'FF14 头部装备一览介绍页。支持按特征、风格、获取方式筛选与搜索，男女外观与获取方式均可在链接页查看♪',
      'FF14のファッションアクセサリー(パラソル/傘/羽/眼鏡)について一覧で紹介しているページです。 リンク先で見た目や入手方法が確認できます♪': 'FF14 时尚配饰（阳伞/伞/羽翼/眼镜）一览介绍页。外观与获取方式均可在链接页查看♪',
      'FF14のファッションアクセサリー(パラソル/傘/羽/眼鏡)について一覧で紹介しているページです。リンク先で見た目や入手方法が確認できます♪': 'FF14 时尚配饰（阳伞/伞/羽翼/眼镜）一览介绍页。外观与获取方式均可在链接页查看♪',
      '申し訳ありません。お探しのページはありませんでした。': '抱歉，未找到您要访问的页面。',
      'Patch6.5までのリーパー/賢者の武器は99%網羅してます✨他は随時更新中……！': '至 Patch6.5 的钐镰客/贤者武器已收录 99%✨其余随进度更新……！',
      'FF14の髪型（ヘアカタログ）について一覧で紹介しているページです。 リンク先で各種族や男女ごとの髪型の見た目や入手方法が確認できます♪': 'FF14 发型（发型图鉴）一览介绍页。各种族、男女发型外观与获取方式均可在链接页查看♪',
      'FF14の髪型（ヘアカタログ）について一覧で紹介しているページです。リンク先で各種族や男女ごとの髪型の見た目や入手方法が確認できます♪': 'FF14 发型（发型图鉴）一览介绍页。各种族、男女发型外观与获取方式均可在链接页查看♪',
      'FF14の様々な装備・ミラプリについて一覧で紹介しているページです。 リンク先で各種族や男女ごとの装備の見た目や入手方法が確認できます♪': 'FF14 各类装备与幻化一览介绍页。各种族、男女装备外观与获取方式均可在链接页查看♪',
      'FF14の様々な装備・ミラプリについて一覧で紹介しているページです。リンク先で各種族や男女ごとの装備の見た目や入手方法が確認できます♪': 'FF14 各类装备与幻化一览介绍页。各种族、男女装备外观与获取方式均可在链接页查看♪',
      'FF14の胴装備を一覧で紹介しているページです。 特徴や雰囲気、入手方法での絞り込みや検索も可能です。リンク先で男女ごとの見た目や入手方法が確認できます♪': 'FF14 躯干装备一览介绍页。支持按特征、风格、获取方式筛选与搜索，男女外观与获取方式均可在链接页查看♪',
      'FF14の胴装備を一覧で紹介しているページです。特徴や雰囲気、入手方法での絞り込みや検索も可能です。リンク先で男女ごとの見た目や入手方法が確認できます♪': 'FF14 躯干装备一览介绍页。支持按特征、风格、获取方式筛选与搜索，男女外观与获取方式均可在链接页查看♪',
      'FF14の手装備を一覧で紹介しているページです。特徴や雰囲気、入手方法での絞り込みや検索も可能です。リンク先で男女ごとの見た目や入手方法が確認できます♪': 'FF14 手部装备一览介绍页。支持按特征、风格、获取方式筛选与搜索，男女外观与获取方式均可在链接页查看♪',
      'FF14の手装備を一覧で紹介しているページです。 特徴や雰囲気、入手方法での絞り込みや検索も可能です。リンク先で男女ごとの見た目や入手方法が確認できます♪': 'FF14 手部装备一览介绍页。支持按特征、风格、获取方式筛选与搜索，男女外观与获取方式均可在链接页查看♪',
      'FF14の脚装備を一覧で紹介しているページです。特徴や雰囲気、入手方法での絞り込みや検索も可能です。リンク先で男女ごとの見た目や入手方法が確認できます♪': 'FF14 腿部装备一览介绍页。支持按特征、风格、获取方式筛选与搜索，男女外观与获取方式均可在链接页查看♪',
      'FF14の脚装備を一覧で紹介しているページです。 特徴や雰囲気、入手方法での絞り込みや検索も可能です。リンク先で男女ごとの見た目や入手方法が確認できます♪': 'FF14 腿部装备一览介绍页。支持按特征、风格、获取方式筛选与搜索，男女外观与获取方式均可在链接页查看♪',
      'FF14の足装備を一覧で紹介しているページです。特徴や雰囲気、入手方法での絞り込みや検索も可能です。リンク先で男女ごとの見た目や入手方法が確認できます♪': 'FF14 脚部装备一览介绍页。支持按特征、风格、获取方式筛选与搜索，男女外观与获取方式均可在链接页查看♪',
      'FF14の足装備を一覧で紹介しているページです。 特徴や雰囲気、入手方法での絞り込みや検索も可能です。リンク先で男女ごとの見た目や入手方法が確認できます♪': 'FF14 脚部装备一览介绍页。支持按特征、风格、获取方式筛选与搜索，男女外观与获取方式均可在链接页查看♪',
      'FF14の耳装備を一覧で紹介しているページです。特徴や雰囲気、入手方法での絞り込みや検索も可能です。リンク先で男女ごとの見た目や入手方法が確認できます♪': 'FF14 耳部装备一览介绍页。支持按特征、风格、获取方式筛选与搜索，男女外观与获取方式均可在链接页查看♪',
      'FF14の耳装備を一覧で紹介しているページです。 特徴や雰囲気、入手方法での絞り込みや検索も可能です。リンク先で男女ごとの見た目や入手方法が確認できます♪': 'FF14 耳部装备一览介绍页。支持按特征、风格、获取方式筛选与搜索，男女外观与获取方式均可在链接页查看♪',
      'FF14の首装備を一覧で紹介しているページです。特徴や雰囲気、入手方法での絞り込みや検索も可能です。リンク先で男女ごとの見た目や入手方法が確認できます♪': 'FF14 颈部装备一览介绍页。支持按特征、风格、获取方式筛选与搜索，男女外观与获取方式均可在链接页查看♪',
      'FF14の首装備を一覧で紹介しているページです。 特徴や雰囲気、入手方法での絞り込みや検索も可能です。リンク先で男女ごとの見た目や入手方法が確認できます♪': 'FF14 颈部装备一览介绍页。支持按特征、风格、获取方式筛选与搜索，男女外观与获取方式均可在链接页查看♪',
      'FF14の腕装備を一覧で紹介しているページです。特徴や雰囲気、入手方法での絞り込みや検索も可能です。リンク先で男女ごとの見た目や入手方法が確認できます♪': 'FF14 腕部装备一览介绍页。支持按特征、风格、获取方式筛选与搜索，男女外观与获取方式均可在链接页查看♪',
      'FF14の腕装備を一覧で紹介しているページです。 特徴や雰囲気、入手方法での絞り込みや検索も可能です。リンク先で男女ごとの見た目や入手方法が確認できます♪': 'FF14 腕部装备一览介绍页。支持按特征、风格、获取方式筛选与搜索，男女外观与获取方式均可在链接页查看♪',
      'FF14の指装備を一覧で紹介しているページです。特徴や雰囲気、入手方法での絞り込みや検索も可能です。リンク先で男女ごとの見た目や入手方法が確認できます♪': 'FF14 手指装备一览介绍页。支持按特征、风格、获取方式筛选与搜索，男女外观与获取方式均可在链接页查看♪',
      'FF14の指装備を一覧で紹介しているページです。 特徴や雰囲気、入手方法での絞り込みや検索も可能です。リンク先で男女ごとの見た目や入手方法が確認できます♪': 'FF14 手指装备一览介绍页。支持按特征、风格、获取方式筛选与搜索，男女外观与获取方式均可在链接页查看♪',
      'FF14の装備について一覧で紹介しているページです。各種族や男女ごとの見た目や入手方法がリンク先で確認できます。幻化の参考にどうぞ♪': 'FF14 全装备一览介绍页。各种族、男女的外观与获取方式均可在链接页查看，欢迎作为幻化参考♪',
      '脚鎧': '腿甲',
      '袴': '袴',
      'ニーソ': '过膝袜',
      '水着': '泳装',
      'アンダーウェア': '内衣',
      'ストレート': '直筒',
      'サルエル': '萨鲁尔',
      'フレア': '喇叭',
      'ワイド': '阔腿',
      'ブーツイン': '靴裤',
      'クロップド': '七分',
      'ハーフ': '半长',
      'ショート': '短款',
      'ミニ・ショート': '迷你·短款',
      'ひざ丈・ハーフ': '膝长·半长',
      'ミモレ・クロップド': '中长·七分',
      'ロング・フルレングス': '长款·全长',
      '甲冑': '铠甲',
      'メイル': '锁子甲',
      'ハーネス': '挂带',
      'Tシャツ': 'T恤',
      'セーター': '毛衣',
      'ボレロ': '短外套',
      'ビスチェ': '胸衣',
      'コーティ': '大衣',
      'ポンチョ': '斗篷',
      'ショール': '披肩',
      'エプロン': '围裙',
      '着物': '和服',
      '浴衣': '浴衣',
      'タトゥー': '纹身',
      'オールインワン': '连体衣',
      '半袖': '短袖',
      '半端丈': '中长款',
      '長袖': '长袖',
      '袖なし': '无袖',
      'ショート丈': '短款',
      'ミドル丈': '中款',
      'ロング丈': '长款',
      '篭手': '护手',
      'バンデージ': '绷带',
      'アームレット': '臂环',
      '爪・ネイル': '指甲·美甲',
      '手袋': '手套',
      'フィンガレス': '露指',
      '手首': '手腕',
      '肘': '肘部',
      '肘上': '肘上',
      'DQコラボ': 'DQ联动',
      '初心者の館': '初学者之家',
      'AF6': '校服6',
      'AF5': '校服5',
      'AF4': '校服4',
      'AF3': '校服3',
      'AF2': '校服2',
      'AF1': '校服1',
      'レッグドレス': '腿裙',
      'カーゴパンツ': '工装裤',
      'ワンピース・ドレス': '连衣裙',
      'アームドレス付き': '连臂裙',
      'レッグ': '腿',
      'カーゴ': '工装',
      'FANTASIANコラボ': 'FANTASIAN联动',
      'FFTコラボ': 'FFT联动',
      'FFBEコラボ': 'FFBE联动',
      'FF9コラボ': 'FF9联动',
      'FF11コラボ': 'FF11联动',
      'FF15コラボ': 'FF15联动',
      'FF16コラボ': 'FF16联动',
      'モンハンコラボ': '怪物猎人联动',
      '牙狼〈GARO〉コラボ': '牙狼〈GARO〉联动',
      'メッセージ送信箱': '发送消息',
      'スニーカー': '运动鞋',
      'トームストーン': '神典石',
      '伝説の採集場所': '传说采集地点',
      '最寄り': '最近',
      'ほか': '等',
      'で制作': ' 制作',
      'で採取': ' 采集',
      'などの': '等',
      'の获取方式': '的获取方式',
      'と兑换で获取': '兑换获取',
      '工芸館': '工艺馆',
      'ミーン': '中庸',
      'ミラプリライフ👗FF14装備の見た目一覧サイト': 'MirapriLife👗FF14 装备外观一览站',
      '·入手方法': '·获取方法',
      'スイートアリッサム': '甜香荠',
      '険山の霊砂': '险山灵砂',
      '虹結晶': '彩虹晶',
      'ドワーフ綿布': '矮人棉布',
      '泡絹布': '泡绢布',
      '泡マユ': '泡茧',
      'テンペスト': '黑风海',
      '陸人の墓標': '陆人墓标',
      'アラガントームストーン：詩学': '亚拉戈诗学神典石',
      'これから順番に、': '接下来依次，',
      '順番に更新していきます……！': '会依次更新……！',
      'もたくさん載せていきます！': '也会大量上传！',
      '男性での見た目': '男性外观',
      '他の種族': '其他种族',
      '他の色': '其他颜色',
      '按部位の詳しい説明': '按部位的详细说明',
      '他の装備': '其他装备',
      '研磨剤': '研磨剂',
      '特製': '特制',
      'が用いられた': '所采用的',
      '技術': '技术',
      '製作レベル': '制作等级',
      '等級制限': '等级限制',
      'ボズヤン': '博兹雅',
      'ボルトキープ': '锦衣',
      'キングダムブラス': '王国黄铜',
      'エクサーク': '总督',
      'ヒーラー': '治愈',
      'ミラプリで生きてる。': '靠幻化生活。',
      'ファッション大好きなFF14歴4年のヒカセン\'sです。': '超喜欢时尚的 FF14 四年光之战士。',
      'エオルゼアの装備や実用情報を紹介していきます♪': '介绍艾欧泽亚的装备与实用信息♪',
      '装備特集の行き方一覧': '装备特辑的获取方式一览',
      '1GCDで分かる获取方式♪': '一个GCD就能看懂的获取方式♪',
      'ヤ・シュトラ': '雅·修特拉',
      'スノウ': '斯诺',
      'ソーラー': '金阳',
      'ハンマーキング': '玄甲',
      'スカリー': '狩猎者',
      'オステア': '苦行',
      'アテナ': '雅典娜',
      'マインキープ': '富矿',
      'コスチュームセット': '服装套装',
      'イディル・ハンター': '田园监督者',
      'イディル・ガーディアン': '田园管理者',
      'イディル・フィロソファー': '田园哲学家',
      '紹介': '介绍',
      '情報': '情报',
      'ヤ': '雅',
      'シュトラ': '修特拉',
      'ヨルハ': '寄叶',
      '絞り込みをリセットする': '重置筛选',
      'FINAL FANTASY XIV(FF14)ランキング': '最终幻想 XIV（FF14）排行榜',
      'ブログ': '博客',
      '初動リスト': '版本上线速查表',
      '基本ステータス': '基础属性',
      '染色できない': '无法染色',
      '染色可能': '可染色',
      '以上で装備可能': '满足上述条件即可装备',
      '以上で装備できます。': '满足上述条件即可装备。',
      'と交換する': '兑换',
      'まとめてご紹介！': '汇总介绍！',
      '各部位・各種族ごとにわかりやすく画像を載せました！': '按装备部位与种族整理了清晰易读的图片！',
      'ファイナルファンタジーXIV: 黄金のレガシー コレクターズエディション': '最终幻想 XIV：金曦的遗产 典藏版',
      '各装備についての詳しい見た目や情報は、それぞれの記事にまとめてありますので、気になった装備を是非チェックしてみて下さい♪': '各件装备的详细外观与信息已整理在对应文章中，欢迎查看感兴趣的装备♪',
      '新装備についての詳しい見た目や情報は、順次記事にまとめていきますので、気になった装備を是非チェックしてみて下さい♪': '我们会陆续整理新装备的详细外观与信息，欢迎查看感兴趣的装备♪',
      'あなたのミラプリライフを、': '希望您的幻化生活',
      'もっと華やかに彩るお手伝いが出来たなら嬉しいです♪': '更加绚丽多彩，这是我们最大的心愿♪',
      'Twitterで更新情報をお知らせしていますので、よかったらフォローをお願いします！（': '我们会在 Twitter 上发布更新信息，欢迎关注！（',
      'Twitterで更新情報をお知らせしていますので、フォローしていただけると嬉しいです！（': '我们会在 Twitter 上发布更新信息，期待您的关注！（',
      'もっと詳しく知りたい方はこちら': '点击了解更多详情',
      '着せ替えスライダーで装備の詳細や各種族ごとでの染色が確認できます！': '通过换装滑块查看装备详情及各种族的染色效果！',
      '【FF14】おしゃれな装備を各種族・染色で紹介！': '【FF14】按种族和染色展示时尚装备！',
      'メールアドレスが公開されることはありません。': '您的电子邮箱地址不会公开。',
      '次回のコメントで使用するためブラウザーに自分の名前、メールアドレス、サイトを保存する。': '在此浏览器中保存我的姓名、邮箱地址和网站，以便下次评论时使用。',
      '上に表示された文字を入力してください。': '请输入上方显示的字符。',
      'が付いている欄は必須項目です': '标有该符号的字段为必填项',
      'メール': '邮箱',
      'サイト': '网站',
      'comment': '评论',
      '性別': '性别',
      '入手方法': '获取方式',
      'ボス1': '首领 1',
      'ボス2': '首领 2',
      'ボス3': '首领 3',
      'セットで交換することができます。': '可以兑换成套装。',
      '1回クリアで1ジョブ分手に入る！': '每次通关可获得一个职业份的奖励！',
      '宝箱からランダム': '从宝箱中随机获得',
      '装備可能': '可装备',
    };

    // ronka（lookbook.ronkacloset.com）界面 + 染剂词典（由 dict/dict-ronka.json 注入）
    // ⚠️ 自动生成（dict/dict-ronka.json → build/inject_dicts.py）：勿手改本块；改词请改 JSON 后重新构建
    const DICT_RONKA = { ...DICT_COMMON,
      '기본색': '基础色',
      '하얀눈색': '素雪白',
      '구부 회색': '古菩灰',
      '진회색': '石板灰',
      '탄회색': '木炭灰',
      '숯검정색': '煤烟黑',
      '장미색': '玫瑰粉',
      '라일락색': '丁香紫',
      '롤란베리색': '罗兰莓',
      '달라가브색': '卫月红',
      '녹슨 빨간색': '铁锈红',
      '포도주색': '果酒红',
      '산호색': '珊瑚粉',
      '선홍색': '鲜血红',
      '연어색': '鲑鱼粉',
      '홍옥색': '宝石红',
      '꽃분홍색': '樱桃粉',
      '노을색': '日落橙',
      '황야의 붉은색': '台地红',
      '나무껍질색': '树皮棕',
      '초콜릿색': '巧克力',
      '적갈색': '铁锈棕',
      '코볼드색': '钴铁棕',
      '코르크색': '软木棕',
      '키키룬색': '卢恩棕',
      '오포오포색': '奥猴棕',
      '큰뿔염소색': '山羊棕',
      '늙은호박색': '南瓜橙',
      '도토리색': '橡果棕',
      '과수원 흙색': '果园棕',
      '밤색': '山栗棕',
      '고블린색': '哥布林',
      '찰흙색': '页岩棕',
      '두더지색': '鼹鼠棕',
      '비옥토색': '沃土棕',
      '상아색': '骸骨白',
      '울다하 갈색': '黄沙棕',
      '꿀색': '蜂蜜黄',
      '옥수수색': '玉米黄',
      '커얼색': '猛豹黄',
      '크림색': '奶油黄',
      '할라탈리 노란색': '日影黄',
      '건포도색': '萄干棕',
      '카나리아색': '丝雀黄',
      '바닐라색': '香草黄',
      '습지 녹색': '泥沼绿',
      '실프색': '妖精绿',
      '라임색': '青柠绿',
      '이끼색': '苔藓绿',
      '풀색': '牧草绿',
      '올리브색': '橄榄绿',
      '늪지 녹색': '沼泽绿',
      '풋사과색': '苹果绿',
      '선인장색': '仙人掌',
      '진녹색': '猎人绿',
      '오츄색': '口花绿',
      '금강거북색': '金龟绿',
      '노피카의 녹색': '地神绿',
      '밀림 녹색': '深林绿',
      '옅은 청록색': '天上蓝',
      '터키석색': '绿松蓝',
      '몰볼색': '魔花绿',
      '옅은 하늘색': '寒冰蓝',
      '하늘색': '天空蓝',
      '바다안개색': '海雾蓝',
      '공잣깃 파란색': '孔雀蓝',
      '로타노 바다색': '罗海蓝',
      '좀비의 얼굴색': '腐尸蓝',
      '청린수색': '青磷蓝',
      '쪽빛 파란색': '靛青蓝',
      '검푸른색': '油墨蓝',
      '랍토르색': '盗龙蓝',
      '오사드 바다색': '东洲蓝',
      '선명한 파란색': '风暴蓝',
      '보이드의 파란색': '虚空蓝',
      '감청색': '皇室蓝',
      '밤하늘색': '午夜蓝',
      '청회색': '阴影蓝',
      '청보라색': '深渊蓝',
      '새파란색': '龙骑蓝',
      '담청색': '松石蓝',
      '라벤더색': '薰衣草',
      '어두운 보라색': '忧郁紫',
      '머루색': '醋栗紫',
      '붓꽃색': '鸢尾紫',
      '포도색': '葡萄紫',
      '연꽃색': '莲花粉',
      '콜리브리색': '蜂鸟粉',
      '매화색': '仙子梅',
      '자주색': '帝王紫',
      '순백색': '无瑕白',
      '칠흑색': '煤玉黑',
      '부드러운 연분홍': '柔彩粉',
      '짙은 빨강': '黑暗红',
      '짙은 갈색': '黑暗棕',
      '부드러운 연녹색': '柔彩绿',
      '짙은 녹색': '黑暗绿',
      '부드러운 연파랑': '柔彩蓝',
      '짙은 파랑': '黑暗蓝',
      '부드러운 연보라': '柔彩紫',
      '짙은 자주색': '黑暗紫',
      '반짝이는 은색': '闪耀银',
      '반짝이는 금색': '闪耀金',
      '금속질 빨간색': '金属红',
      '금속질 주황색': '金属橙',
      '금속질 노란색': '金属黄',
      '금속질 녹색': '金属绿',
      '금속질 하늘색': '金属蓝',
      '금속질 파란색': '金属靛',
      '금속질 보라색': '金属紫',
      '건메탈색': '炮铜黑',
      '진주색': '珍珠白',
      '황동색': '金属铜',
      '은색': '银',
      '금색': '金',
      '구리색': '铜',
      '연지색': '胭脂红',
      '형광 분홍색': '霓虹粉',
      '밝은 주황색': '明亮橙',
      '형광 노란색': '霓虹黄',
      '형광 녹색': '霓虹绿',
      '짙은 하늘색': '碧空蓝',
      '제비꽃색': '罗兰紫',
      '금속질 분홍색': '金属粉',
      '금속질 홍옥색': '金属宝石红',
      '금속질 푸른 녹색': '金属钴铁绿',
      '금속질 짙은 파랑': '金属黑暗蓝',
      '사막노란색': '沙漠黄',
      '롱카의 룩북?': 'Ronka 的穿搭集',
      '롱카의 옷장?': 'Ronka 的衣柜',
      '롱카의 옷장': 'Ronka 的衣柜',
      '이 사이트는 javascript를 허용해야 정상적으로 동작합니다.': '本站需要允许 JavaScript 才能正常运行。',
      'https://ronkacloset.com': 'https://ronkacloset.com',
      'GALLERY': '作品集',
      'GENERATOR': '生成器',
      '주간인기 TOP 10 ITEM': '周人气 TOP 10 装备',
      '유저를 검색하세요': '搜索用户',
      '아이템을 검색하세요': '搜索装备',
      '검색어를 입력해주세요': '请输入搜索词',
      '검색어 로딩 중...': '搜索中……',
      '인기순': '人气',
      '공용': '通用',
      '중복선택가능': '可多选',
      '검색 필터': '搜索筛选',
      '학살자': '制敌',
      '타격대': '强袭',
      '정찰대': '游击',
      '유격대': '精准',
      '채집가': '采集',
      '코디아이템': '搭配装备',
      '공식 가이드': '官方指南',
      '다른 코디 보기': '查看更多搭配',
      '코디 정보': '搭配信息',
      '조회수': '浏览量',
      '코디 정보 입력': '搭配信息输入',
      '사용방법': '使用方法',
      '주의사항': '注意事项',
      '이미지 다운로드': '下载图片',
      '로그인시 글작성 가능': '登录后可发布',
      '에디터 닫기': '关闭编辑器',
      '글 작성하기': '发布帖子',
      '글 작성이 완료되었습니다.': '帖子发布完成。',
      '작성': '发布',
      '추가 옵션': '附加选项',
      '염색 색상추가': '染色 · 添加颜色',
      '아이콘': '图标',
      '배경색': '背景色',
      '합성': '合成',
      '다운로드': '下载',
      '비어있음': '空',
      '슬롯': '槽位',
      '유효하지 않은 이미지입니다.': '无效的图片。',
      'bmp, png, jpeg 형식의 이미지만 등록할 수 있습니다': '仅可上传 bmp、png、jpeg 格式的图片',
      '이미지 업로드 과정에서\n오류가 발생했습니다.': '图片上传过程中发生错误。',
      '잠시 후 다시 시도해주세요.': '请稍后再试。',
      'Blob 생성 실패': 'Blob 创建失败',
      'canvas context 생성에 실패했습니다.': 'Canvas 上下文创建失败。',
      '뉴스 리스트 조회 실패': '新闻列表加载失败',
      '로그인이 필요한 서비스입니다.\n로그인 하시겠습니까?': '此服务需要登录，是否前往登录？',
      '로그인이 필요한 서비스입니다. 로그인 하시겠습니까?': '此服务需要登录，是否前往登录？',
      '종족을 선택해주세요.': '请选择种族。',
      '직업을 선택해주세요.': '请选择职业。',
      '* 무기, 악세서리, 얼굴장식은 추가옵션으로 등록할 수 있습니다': '* 武器、饰品、面部装饰可通过附加选项添加',
      '무기, 악세서리, 얼굴장식은 추가옵션으로 등록할 수 있습니다': '* 武器、饰品、面部装饰可通过附加选项添加',
      '현재 적용된 패치 데이터 버전(KOR): ': '当前应用的补丁数据版本(KOR): ',
      '운영정책 및 이용가이드': '运营政策及使用指南',
      '사이트 소개': '网站介绍',
      '이용가이드': '使用指南',
      '롱카의 룩북을 이용해 주셔서 감사합니다.': '感谢您使用 Ronka 的穿搭集。',
      '사이트 이용 시 아래의 운영 정책을 반드시 숙지하시고, 원활한 커뮤니티 운영을 위해 협조 부탁드립니다.': '使用本站时请务必阅读以下运营政策，感谢您为社区良好运营提供协助。',
      '이미지 업로드 가이드': '图片上传指南',
      '룩북의 일관된 분위기를 유지하고, 모험가분들이 더욱 몰입감 있는 코디를 즐길 수 있도록 협조 부탁드립니다!': '为保持穿搭集的一致氛围，让冒险者们享受更有沉浸感的幻化搭配，请您配合！',
      '이미지 규격 및 촬영 방식': '图片规格及拍摄方式',
      '업로드 이미지는 전신의 아이템이 잘 보이는 정면 사진을 권장합니다.': '建议上传能清晰展示全身装备的正脸照片。',
      '소품 및 꼬마친구, 탈 것 등으로 전신의 아이템이 가려지지 않은 사진을 사용해주세요.': '请使用未被道具、宠物、坐骑等遮挡全身装备的照片。',
      '외부 카메라가 아닌, 게임 내에서 촬영 기능을 사용한 스크린샷만 업로드 가능합니다.': '仅可上传使用游戏内截图功能拍摄的照片，而非外部相机拍摄。',
      '파이널판타지14에 구현되지 않은 아이템이 표시되거나 외형이 변경된 이미지(모드 사용)': '显示了最终幻想14中不存在的装备、或外观经过修改的图片（使用 MOD）',
      '는 별도의 통보 없이 삭제될 수 있습니다.': '可能会在不另行通知的情况下被删除。',
      '이미지 보정 및 수정': '图片修饰及修改',
      '색감 보정을 위해 외부 프로그램을 사용하거나 보정하는 것은 허용되지만, 감상에 지장을 주지 않는 선에서만 가능합니다.': '允许使用外部软件进行色调修饰，但以不影响观赏为前提。',
      '원색을 알아볼 수 없을 정도의 과도한 보정이 적용된 이미지': '原色无法辨认的过度修饰图片',
      '배경 이미지 기준': '背景图片标准',
      '반드시': '必须',
      '파이널판타지14 게임 내 배경': '最终幻想14游戏内背景',
      '을 사용해야 합니다.': '使用。',
      '게임 내 배경이 아닌 이미지(예: 외부 CG, 크로마키 배경 등)를 사용하여 게임 내 장면과 혼동을 줄 수 있는 경우, 별도의 통보 없이 삭제될 수 있습니다.': '使用非游戏内背景的图片（如外部 CG、绿幕背景等）可能造成与游戏内场景混淆的，可能会在不另行通知的情况下被删除。',
      '글 작성 가이드': '帖子撰写指南',
      '예시 이미지에 맞는 적절한 착용가능 성별, 종족을 입력해주세요.': '请填写与示例图片相符的适用性别、种族。',
      '해당 장비를 착용할 수 있는 직업을 올바르게 선택해주세요.': '请正确选择能够穿戴该装备的职业。',
      '스크린샷에 표시된 장비를 최대한 상세히 입력하여 투영 세트 참고가 용이하도록 해주세요.': '请尽量详细填写截图中显示的装备，以便他人参考幻化套装。',
      '제재 기준': '处罚标准',
      '📌 다음과 같은 경우 경고 1회가 부여되며, 해당 내용이 수정 또는 삭제됩니다.': '📌 以下情况将给予 1 次警告，并修改或删除相应内容。',
      '부적절한 닉네임 및 SNS 정보 등록': '填写不当昵称或 SNS 信息',
      '닉네임, SNS에 부적절한 단어 포함시 경고 1회 후 관리자에 의해 임의 수정 처리': '昵称、SNS 中包含不当词语时，警告 1 次后由管理员酌情修改处理',
      '게시글 제목, 내용, 태그에 부적절한 단어 포함': '帖子标题、内容、标签中包含不当词语',
      '제7.4항 에 해당하는 ‘홈페이지 제재 항목’ 대상의 경우 작성자에게 사전통지 없이 해당 게시물을 삭제할 수 있으며, 이를 작성한 계정은 경고 1회 후 게시글 삭제': '属于第 7.4 条「官网处罚事项」的，可在不事先通知作者的情况下删除该帖子，相关账号警告 1 次后删除帖子',
      '부적절한 이미지 업로드': '上传不当图片',
      '파이널판타지14 외의 이미지(타 게임, 실사, 일러스트 등)를 포함한 경우': '包含非最终幻想14的图片（其他游戏、真人、插画等）',
      '캐릭터 전신이 명확하게 보이지 않는 이미지(너무 가까운 클로즈업, 과도한 이펙트, UI 포함 등)': '角色全身不清晰的图片（过近的特写、过度特效、包含 UI 等）',
      '과도하게 가공되거나 왜곡된 이미지(극단적인 보정, 게임 내 구현되지 않은 모드 사용 이미지 등)': '过度加工或扭曲的图片（极端修饰、使用游戏内未实装 MOD 的图片等）',
      '위 경우에 해당 될 경우 경고 1회 후 게시글 삭제': '符合上述情况的，警告 1 次后删除帖子',
      '고의적인 잘못된 정보 기입': '故意填写错误信息',
      '게시글 작성시 의도적으로 잘못된 아이템, 종족, 직업설정을 반복적으로 입력하여 다른 유저에게 혼란을 줄 경우 경고 1회 부여': '发帖时故意反复填写错误的装备、种族、职业设定，给其他用户造成混淆的，给予警告 1 次',
      '누적 제재 및 계정 조치': '累计处罚及账号处理',
      '3회 누적시 계정 삭제 및 재가입 불가 처리': '累计 3 次时删除账号并禁止重新注册',
      '운영 정책': '运营政策',
      '투영기록 생성기 이용 관련 책임안내': '幻化记录生成器使用相关责任说明',
      '투영기록 생성기 사용 및 게시글 작성 시, 본 운영 정책을 숙지하고 동의한 것으로 간주됩니다.': '使用幻化记录生成器及发帖时，视为已阅读并同意本运营政策。',
      '본 이미지 생성기를 통해 생성된 이미지와 관련된 모든 활동으로 인해 발생하는 불미스러운 사건에 대해 롱카의 옷장?측은 이에 대해 책임을 지지 않습니다.': '对于通过本图片生成器生成的图片所引发的所有活动而产生的纠纷，Ronka 的衣柜方不承担任何责任。',
      '저작권 및 무단 복제 금지': '版权及禁止擅自转载',
      '게시글 작성자가 아닌 제3자가 본 사이트에 게시된 이미지를 무단으로 복제, 배포, 2차 가공하는 행위는 금지됩니다.': '禁止非帖子作者的第 3 方擅自复制、传播、二次加工本站发布的图片。',
      '운영 정책 준수': '遵守运营政策',
      '본 사이트의 이미지 및 게시물은': '本站的图片及帖子遵循',
      '파이널판타지14 한국서버 홈페이지 운영정책': '最终幻想14韩服官网运营政策',
      '을 따릅니다. 해당 정책을 위반하는 게시물은 별도의 안내 없이 수정 또는 삭제될 수 있습니다.': '。违反该政策的帖子可能会在不另行通知的情况下被修改或删除。',
      '운영정책에 명확히 명시되지 않은 사항이라도, 건전한 온라인 커뮤니티 문화를 유지하기 위해 관리자가 필요하다고 판단하는 경우 적절한 조치(수정, 삭제 등)가 이루어질 수 있습니다.': '即使运营政策未明确规定，为维持健康的在线社区文化，管理员认为必要时可采取适当措施（修改、删除等）。',
      '서비스의 일시 중단': '服务临时中断',
      '롱카의 룩북은 정기정검 또는 서비스의 질을 향상시키기 위한 목적으로 홈페이지 서비스를 일시 중단할 수 있습니다. 이 경우 회사는 사전에 그 사유 및 중단 기간을 반드시 회원에게 통지합니다.': 'Ronka 的穿搭集可能因定期维护或提升服务质量的目的临时中断网站服务。此时公司将事先将原因及中断时间通知会员。',
      '단, 천재지변, 전기통신제공업자 등 제삼자의 귀책사유를 근거로 한 경우 등과 같은 통제할 수 없는 명백한 불가항력적인 사유로 중단되었을 경우는 예외로 합니다. 이로 인해 발생하는': '但基于天灾、电信运营商等第三方责任等无法控制的明显不可抗力原因中断的除外。由此产生的',
      '어떠한 손해에 대해서도 책임을 지지 않습니다.': '任何损失均不承担责任。',
      '또한, 관리자는 게시된 이미지 및 게시물 데이터를 별도로 저장할 의무가 없으므로,': '此外，管理员没有另行保存已发布图片及帖子数据的义务，',
      '사용자가 필요한 데이터는 직접 백업해 주시기 바랍니다.': '请用户自行备份所需数据。',
      '- 운영 정책은 필요 시 변경될 수 있으며, 변경된 내용은 별도의 공지를 통해 안내됩니다.': '- 运营政策可能根据需要变更，变更内容将通过另行公告通知。',
      '- 이용규칙 혹은 사이트 이용에 관한 문의사항은': '- 关于使用规则或网站使用的疑问，请通过',
      '오픈채팅': '开放聊天',
      '으로 문의하여 주시기 바랍니다.': '进行咨询。',
      '더 많은 모험가 분들이 편하고 즐거운 투영생활을 할 수 있도록 최선의 노력을 다하겠습니다. 감사합니다.': '我们将竭尽全力，让更多冒险者享受轻松愉快的幻化生活。谢谢！',
      '쉽고 간편한 코디 기록! 스크린샷과 함께 장착한 아이템을 하나의 이미지로 저장할 수 있어요. 로그인하면 직접 스타일 노트를 작성해 나만의 룩북을 안전하게 백업할 수도 있어요.': '简单便捷的幻化记录！可将截图与穿戴的装备保存为一张图片。登录后还能撰写专属穿搭笔记，安全备份属于您的穿搭集。',
      '내가 올린 투영기록들과 ‘좋아요’한 코디를 한눈에 모아볼 수 있어요. 회원정보 수정도 가능하니, 투영기록과 함께 프로필도 업데이트해보세요!': '可以一眼查看您发布的幻化记录和点赞的搭配。还能修改会员信息，配合幻化记录更新您的个人资料吧！',
      '모험가 여러분의 멋진 코디를 자랑해주세요!': '向冒险者们展示您的精美幻化吧！',
      '마이페이지': '我的页面',
      '로그아웃': '退出登录',
      '회원정보 수정': '修改会员信息',
      '닉네임': '昵称',
      '비밀번호': '密码',
      '이메일': '邮箱',
      '비밀번호 확인': '确认密码',
      '단,': '但，',
      '게시물 중': '帖子中',
      '게시물 중 ': '帖子中 ',
      '파이널판타지14 운영정책': '最终幻想14 运营政策',
      '도움말': '帮助',
      '검색:': '搜索：',
      '검색': '搜索',
    };

    // ⚠️ 自动生成（dict/dict-acl.json → build/inject_dicts.py）：勿手改本块；改词请改 JSON 后重新构建
    const DICT_ACL = { ...DICT_COMMON,
      'クラス / ジョブ': '职业 / 特职',
      'アイテム': '物品',
      '広告': '广告',
      'スペック': '规格',
      '関連装備': '相关装备',
      '類似装備': '类似装备',
      '一覧に戻る': '返回列表',
      '入手元': '获取方式',
      '関連コンテンツ': '相关内容',
      '週制限': '周限制',
      '装備Lv': '装备等级',
      '調べたいキーワードを入力': '输入想查询的关键词',
      'ロスガル 頭表示': '硌狮族头部显示',
      'ヴィエラ 頭表示': '维埃拉族头部显示',
      '性別制限': '性别限制',
      '交換装備': '兑换装备',
      'PvP装備': 'PvP 装备',
      '製作装備': '制作装备',
      'コンテンツ報酬': '副本奖励',
      '新生エオルゼア': '重生之境',
      '漆黒のヴィランズ': '暗影之逆焰',
      '未知との邂逅': '未知的邂逅',
      'アークエンジェル': '方舟天使',
      'ダークホースチャンピオン': '黑马冠军',
      'ケーツハリー': '绿咬鹃',
      'ディフェンダー': '御敌',
      'スレイヤー': '制敌',
      'ストライカー': '强袭',
      'スカウト': '游击',
      'レンジャー': '精准',
      'キャスター': '咏咒',
      'ヒーラー': '治愈',
      'アタイア': '套装',
      'パッチ': '版本',
      '討伐・討滅戦': '讨伐歼灭战',
      'マーケット取引': '市场交易',
      'カテゴリー': '分类',
      'すべて選択': '全选',
      'Language': '语言',
      '日本語': '日语',
      'キーワード': '关键词',
      '最小': '最小',
      '最大': '最大',
      'FFXIV 装備図鑑': 'FFXIV 装备图鉴',
      'FFXIV 武器図鑑': 'FFXIV 武器图鉴',
      'FFXIV グッズ': 'FFXIV 周边',
      'FFXIV コレクションガイド': 'FFXIV 收藏指南',
      'FFXIV 装備データベース': 'FFXIV 装备数据库',
      'アタイア販売': '套装贩售',
      'MMOゲーム探す': '找 MMO 游戏',
      'RPGを探す': '找 RPG 游戏',
      'コンピューターゲーム': '电脑游戏',
      '軍票': '军票',
      '同盟記章': '同盟徽章',
      'セントリオ記章': '百夫长徽章',
      'モブハントの戦利品': '怪物狩猎战利品',
      '新式強化': '新式强化',
      'アラガントームストーン:詩学': '亚拉戈神典石：诗学',
      'アラガントームストーン:美学': '亚拉戈神典石：美学',
      'アラガントームストーン:天道': '亚拉戈神典石：天道',
      'クラフタースクリップ:紫貨': '能工巧匠票据：紫币',
      'クラフタースクリップ:橙貨': '能工巧匠票据：橙币',
      'ギャザラースクリップ:紫貨': '大地使者票据：紫币',
      'ギャザラースクリップ:橙貨': '大地使者票据：橙币',
      '対人戦績': '对战战绩',
      'トロフィークリスタル': '奖杯水晶',
      'シリーズ報酬': '系列赛奖励',
      'ゴールドソーサー': '金碟游乐场',
      '初心者の館': '初学者学堂',
      'クロの空想帳': '天书奇谈',
      '禁断の地 エウレカ': '禁地优雷卡',
      'イシュガルド復興': '重建伊修加德',
      'セイブ・ザ・クイーン': '天佑女王',
      '無人島開拓': '开拓无人岛',
      'ヴァリアントダンジョン': '多变迷宫',
      'メインクエスト': '主线任务',
      'ジョブクエスト': '特职任务',
      'サブクエスト': '支线任务',
      'シーズナルイベント': '季节活动',
      '友好部族クエスト': '友好部族任务',
      'お得意様取引': '老主顾交易',
      'タタルの大繁盛商店': '塔塔露的大繁荣商店',
      'オンラインストア': '在线商店',
      'SHOP販売': '商店贩售',
      'アチーブメント': '成就',
      'ベテランリワード': '礼物特典',
      'リテイナーベンチャー': '雇员探险',
      '入手不可': '无法获取',
      'レジスタンスウェポン': '义军武器',
      'ホーム': '首页',
      'アニマウェポン': '元灵武器',
      'エウレカウェポン': '禁地兵装',
      'ゾディアックウェポン': '黄道武器',
      'エフェクト': '特效',
      '有り': '有',
      '無し': '无',
      'クリア': '通关',
      '並び順': '排序',
      'エオルゼアDB と同じ順': '与艾欧泽亚 DB 相同排序',
      'ITEM Lv の高い順': '按品级从高到低',
      'ITEM Lv の低い順': '按品级从低到高',
      '装備Lv の高い順': '按装备等级从高到低',
      '装備Lv の低い順': '按装备等级从低到高',
      'テレビ': '电视',
      'ゲーム開発': '游戏开发',
      'ナ': '骑',
      'ガ': '枪',
      'モ': '武',
      '詩学': '诗学',
      'ゲーム開発を学ぶ': '学习游戏开发',
      'AF': '校服',
      'Previous page': '上一页',
      'Jump to page': '跳转到指定页',
      'Next page': '下一页',
      'ページネーション': '分页导航',
      '次へ': '下一页',
      '前へ': '上一页',
      'ITEM Lv': '物品品级',
      'MENU': '菜单',
      'ナイト': '骑士',
      '戦士': '战士',
      '暗黒騎士': '暗黑骑士',
      'ガンブレイカー': '绝枪战士',
      '竜騎士': '龙骑士',
      'リーパー': '钐镰客',
      'モンク': '武僧',
      '侍': '武士',
      '忍者': '忍者',
      'ヴァイパー': '蝰蛇剑士',
      '吟遊詩人': '吟游诗人',
      '機工士': '机工士',
      '踊り子': '舞者',
      '黒魔道士': '黑魔法师',
      '召喚士': '召唤师',
      '赤魔道士': '赤魔法师',
      'ピクトマンサー': '绘灵法师',
      '青魔道士': '青魔法师',
      '白魔道士': '白魔法师',
      '学者': '学者',
      '占星術師': '占星术士',
      '賢者': '贤者',
    };

    // ⚠️ 自动生成（dict/dict-endcloset.json → build/inject_dicts.py）：勿手改本块；改词请改 JSON 后重新构建
    const DICT_ENDCLOSET = { ...DICT_COMMON,
      '검색': '搜索',
      '최신순': '最新',
      '인기순': '人气',
      '더보기': '更多',
      '투영 세트': '投影套装',
      '글래머 세트': '幻化套装',
      '투영세트, 아이템 이름, 태그로 검색...': '搜索投影套装、装备名、标签...',
      '아이템 이름이나 키워드로 검색...': '搜索装备名或关键词...',
      '선택됨': '已选择',
      '선택하지 않음': '未选择',
      '새 아이템': '新装备',
      '수정': '编辑',
      '중복': '重复',
      '레벨': '等级',
      '아이템 목록': '装备列表',
      '컨셉 룩': '概念穿搭',
      '작성자 소개': '作者介绍',
      '좋아요': '点赞',
      '세트 최고 아이템 레벨': '套装最高装备等级',
      '아이템 글씨 색상': '装备文字颜色',
      '이미지 렌더링': '图片渲染',
      '패널 배경 렌더링': '面板背景渲染',
      '아이템 텍스트 렌더링': '装备文本渲染',
      '아이템 아이콘 렌더링': '装备图标渲染',
      '저작권 표시 렌더링': '版权显示渲染',
      '한국어, 영어, 일본어 태그를 모두 입력해주세요.': '请输入韩文、英文、日文标签。',
      '이미 존재하는 태그입니다.': '标签已存在。',
      '키워드 추가 중 오류가 발생했습니다.': '添加关键词时出错。',
      '한국어 이름은 최소한 입력해주세요.': '至少请输入韩文名称。',
      '글래머 세트를 찾을 수 없습니다.': '找不到幻化套装。',
      '투영했습니다': '已投影',
      '글래머 세트가 성공적으로 업데이트되었습니다!': '幻化套装更新成功！',
      '글래머 세트가 성공적으로 저장되었습니다!': '幻化套装保存成功！',
      '글래머 세트 수정': '编辑幻化套装',
      '글래머 세트 업데이트': '更新幻化套装',
      '글래머 세트 내보내기': '导出幻化套装',
      '글래머 세트 정보를 불러오지 못했어요.': '无法加载幻化套装信息。',
      '글래머 세트가 삭제되었습니다.': '幻化套装已删除。',
      '현재 적용된 패치 데이터 버전': '当前应用的补丁数据版本',
      'Search glamour sets, item names, tags...': '搜索投影套装、装备名、标签...',
      'Search by item name or keyword...': '搜索装备名或关键词...',
      'Item List': '装备列表',
      'Concepts': '概念穿搭',
      'Creators': '作者介绍',
      'Max Item Level in Set': '套装最高装备等级',
      'Selected': '已选择',
      'No selection': '未选择',
      'New Item': '新装备',
      'Edit': '编辑',
      'Duplicate': '重复',
      'Level': '等级',
      'グラマー セット、アイテム名、タグで検索...': '搜索投影套装、装备名、标签...',
      'アイテム名やキーワードで検索...': '搜索装备名或关键词...',
      'アイテム一覧': '装备列表',
      'コンセプト': '概念穿搭',
      '作成者紹介': '作者介绍',
      'セットの最高アイテムレベル': '套装最高装备等级',
      '選択': '已选择',
      '選択されていません': '未选择',
      '新しいアイテム': '新装备',
      '編集': '编辑',
      '重複': '重复',
      'レベル': '等级',
      '나이트': '骑士',
      'Paladin': '骑士',
      'ナイト': '骑士',
      '전사': '战士',
      'Warrior': '战士',
      '戦士': '战士',
      '암흑기사': '暗黑骑士',
      'Dark Knight': '暗黑骑士',
      '暗黒騎士': '暗黑骑士',
      '건브레이커': '绝枪战士',
      'Gunbreaker': '绝枪战士',
      'ガンブレイカー': '绝枪战士',
      '백마도사': '白魔法师',
      'White Mage': '白魔法师',
      '白魔道士': '白魔法师',
      '학자': '学者',
      'Scholar': '学者',
      '学者': '学者',
      '점성술사': '占星术士',
      'Astrologian': '占星术士',
      '占星術師': '占星术士',
      '현자': '贤者',
      'Sage': '贤者',
      '賢者': '贤者',
      '몽크': '武僧',
      'Monk': '武僧',
      'モンク': '武僧',
      '용기사': '龙骑士',
      'Dragoon': '龙骑士',
      '竜騎士': '龙骑士',
      '닌자': '忍者',
      'Ninja': '忍者',
      '忍者': '忍者',
      '사무라이': '武士',
      'Samurai': '武士',
      '侍': '武士',
      '리퍼': '钐镰客',
      'Reaper': '钐镰客',
      'リーパー': '钐镰客',
      '바이퍼': '蝰蛇剑士',
      'Viper': '蝰蛇剑士',
      'ヴァイパー': '蝰蛇剑士',
      '음유시인': '吟游诗人',
      'Bard': '吟游诗人',
      '吟遊詩人': '吟游诗人',
      '기공사': '机工士',
      'Machinist': '机工士',
      '機工士': '机工士',
      '무도가': '舞者',
      'Dancer': '舞者',
      '踊り子': '舞者',
      '흑마도사': '黑魔法师',
      'Black Mage': '黑魔法师',
      '黒魔道士': '黑魔法师',
      '소환사': '召唤师',
      'Summoner': '召唤师',
      '召喚士': '召唤师',
      '적마도사': '赤魔法师',
      'Red Mage': '赤魔法师',
      '赤魔道士': '赤魔法师',
      '픽토맨서': '绘灵法师',
      'Pictomancer': '绘灵法师',
      'ピクトマンサー': '绘灵法师',
      '청마도사': '青魔法师',
      'Blue Mage': '青魔法师',
      '青魔道士': '青魔法师',
      '목수': '刻木匠',
      'Carpenter': '刻木匠',
      '木工師': '刻木匠',
      '대장장이': '锻铁匠',
      'Blacksmith': '锻铁匠',
      '鍛冶師': '锻铁匠',
      '갑주제작사': '铸甲匠',
      'Armorer': '铸甲匠',
      '甲冑師': '铸甲匠',
      '보석공예가': '雕金匠',
      'Goldsmith': '雕金匠',
      '彫金師': '雕金匠',
      '가죽공예가': '制革匠',
      'Leatherworker': '制革匠',
      '革細工師': '制革匠',
      '재봉사': '裁缝师',
      'Weaver': '裁缝师',
      '裁縫師': '裁缝师',
      '연금술사': '炼金术士',
      'Alchemist': '炼金术士',
      '錬金術師': '炼金术士',
      '요리사': '烹调师',
      'Culinarian': '烹调师',
      '調理師': '烹调师',
      '광부': '采矿工',
      'Miner': '采矿工',
      '採掘師': '采矿工',
      '원예가': '园艺工',
      'Botanist': '园艺工',
      '園芸師': '园艺工',
      '어부': '捕鱼人',
      'Fisher': '捕鱼人',
      '漁師': '捕鱼人',
      '휴런': '人族',
      'Hyur': '人族',
      'ヒューラン': '人族',
      '엘레젠': '精灵族',
      'Elezen': '精灵族',
      'エレゼン': '精灵族',
      '라라펠': '拉拉菲尔族',
      'Lalafell': '拉拉菲尔族',
      'ララフェル': '拉拉菲尔族',
      '미코테': '猫魅族',
      'Miqo\'te': '猫魅族',
      'ミコッテ': '猫魅族',
      '루가딘': '鲁加族',
      'Roegadyn': '鲁加族',
      'ルガディン': '鲁加族',
      '아우라': '敖龙族',
      'Au Ra': '敖龙族',
      'アウラ': '敖龙族',
      '로스갈': '硌狮族',
      'Hrothgar': '硌狮族',
      'ロスガル': '硌狮族',
      '비에라': '维埃拉族',
      'Viera': '维埃拉族',
      'ヴィエラ': '维埃拉族',
      '캐주얼': '休闲',
      'Casual': '休闲',
      'カジュアル': '休闲',
      '포멀': '正式',
      'Formal': '正式',
      'フォーマル': '正式',
      '우아한': '优雅',
      'Elegant': '优雅',
      'エレガント': '优雅',
      '귀여운': '可爱',
      'Cute': '可爱',
      'かわいい': '可爱',
      '멋진': '酷',
      'Cool': '酷',
      'クール': '酷',
      '섹시한': '性感',
      'Sexy': '性感',
      'セクシー': '性感',
      '판타지': '奇幻',
      'Fantasy': '奇幻',
      'ファンタジー': '奇幻',
      '밀리터리': '军事风',
      'Military': '军事风',
      'ミリタリー': '军事风',
      '스팀펑크': '蒸汽朋克',
      'Steampunk': '蒸汽朋克',
      'スチームパンク': '蒸汽朋克',
      '동양풍': '东方风',
      'Oriental': '东方风',
      '東洋風': '东方风',
      '서양풍': '西方风',
      'Western': '西方风',
      '西洋風': '西方风',
      '모던': '现代',
      'Modern': '现代',
      'モダン': '现代',
      '빈티지': '怀旧',
      'Vintage': '怀旧',
      'ヴィンテージ': '怀旧',
      '스포티': '运动风',
      'Sporty': '运动风',
      'スポーティー': '运动风',
      '고딕': '哥特风',
      'Gothic': '哥特风',
      'ゴシック': '哥特风',
      '펑크': '朋克风',
      'Punk': '朋克风',
      'パンク': '朋克风',
      '로열': '皇室风',
      'Royal': '皇室风',
      'ロイヤル': '皇室风',
      '모험가': '冒险者',
      'Adventurer': '冒险者',
      '冒険者': '冒险者',
      '비치웨어': '沙滩装',
      'Beachwear': '沙滩装',
      'ビーチウェア': '沙滩装',
      '코스프레': '角色扮演',
      'Cosplay': '角色扮演',
      'コスプレ': '角色扮演',
      '좋아요 목록': '我的点赞',
      'My Likes': '收藏',
      'お気に入りリスト': '我的点赞',
      '후원하기': '赞助',
      'Donate': '赞助',
      '支援': '赞助',
      '메뉴 열기': '打开菜单',
      'Open menu': '打开菜单',
      'メニューを開く': '打开菜单',
      '메뉴 닫기': '关闭菜单',
      'Close menu': '关闭菜单',
      'メニューを閉じる': '关闭菜单',
      '없음': '无',
      'None': '无',
      'なし': '无',
      '하얀눈색': '素雪白',
      'Snow White': '素雪白',
      'スノウホワイト': '素雪白',
      '회색': '灰',
      'Ash Grey': '灰',
      'アッシュグレイ': '灰',
      '구부 회색': '古菩灰',
      'Goobbue Grey': '古菩灰',
      'グゥーブーグレイ': '古菩灰',
      '진회색': '石板灰',
      'Slate Grey': '石板灰',
      'スレートグレイ': '石板灰',
      '탄회색': '木炭灰',
      'Charcoal Grey': '木炭灰',
      'チャコールグレイ': '木炭灰',
      '숯검정색': '煤烟黑',
      'Soot Black': '煤烟黑',
      'スートブラック': '煤烟黑',
      '장미색': '玫瑰粉',
      'Rose Pink': '玫瑰粉',
      'ローズピンク': '玫瑰粉',
      '라일락색': '丁香紫',
      'Lilac Purple': '丁香紫',
      'ライラックパープル': '丁香紫',
      '롤란베리색': '罗兰莓',
      'Rolanberry Red': '罗兰莓',
      'ロランベリーレッド': '罗兰莓',
      '달라가브색': '卫月红',
      'Dalamud Red': '卫月红',
      'ダラガブレッド': '卫月红',
      '녹슨 빨간색': '铁锈红',
      'Rust Red': '铁锈红',
      'ラストレッド': '铁锈红',
      '포도주색': '果酒红',
      'Wine Red': '果酒红',
      'ワインレッド': '果酒红',
      '산호색': '珊瑚粉',
      'Coral Pink': '珊瑚粉',
      'コーラルピンク': '珊瑚粉',
      '선홍색': '鲜血红',
      'Blood Red': '鲜血红',
      'ブラッドレッド': '鲜血红',
      '연어색': '鲑鱼粉',
      'Salmon Pink': '鲑鱼粉',
      'サーモンピンク': '鲑鱼粉',
      '홍옥색': '宝石红',
      'Ruby Red': '宝石红',
      'ルビーレッド': '宝石红',
      '꽃분홍색': '樱桃粉',
      'Cherry Pink': '樱桃粉',
      'チェリーピンク': '樱桃粉',
      '연지색': '胭脂红',
      'Carmine Red Dye': '胭脂红',
      'カーマインレッド': '胭脂红',
      '형광 분홍색': '霓虹粉',
      'Neon Pink': '霓虹粉',
      'ネオンピンク': '霓虹粉',
      '노을색': '日落橙',
      'Sunset Orange': '日落橙',
      'サンセットオレンジ': '日落橙',
      '황야의 붉은색': '台地红',
      'Mesa Red': '台地红',
      'メサレッド': '台地红',
      '나무껍질색': '树皮棕',
      'Bark Brown': '树皮棕',
      'バークブラウン': '树皮棕',
      '초콜릿색': '巧克力',
      'Chocolate Brown': '巧克力',
      'チョコレートブラウン': '巧克力',
      '적갈색': '铁锈棕',
      'Russet Brown': '铁锈棕',
      'ラセットブラウン': '铁锈棕',
      '코볼드색': '钴铁棕',
      'Kobold Brown': '钴铁棕',
      'コボルドブラウン': '钴铁棕',
      '코르크색': '软木棕',
      'Cork Brown': '软木棕',
      'コルクブラウン': '软木棕',
      '키키룬색': '卢恩棕',
      'Qiqirn Brown': '卢恩棕',
      'キキルンブラウン': '卢恩棕',
      '오포오포색': '奥猴棕',
      'Opo-opo Brown': '奥猴棕',
      'オポオポブラウン': '奥猴棕',
      '큰뿔염소색': '山羊棕',
      'Aldgoat Brown': '山羊棕',
      'アルドゴートブラウン': '山羊棕',
      '늙은호박색': '南瓜橙',
      'Pumpkin Orange': '南瓜橙',
      'パンプキンオレンジ': '南瓜橙',
      '도토리색': '橡果棕',
      'Acorn Brown': '橡果棕',
      'エーコンブラウン': '橡果棕',
      '과수원 흙색': '果园棕',
      'Orchard Brown': '果园棕',
      'オーチャードブラウン': '果园棕',
      '밤색': '山栗棕',
      'Chestnut Brown': '山栗棕',
      'チェスナットブラウン': '山栗棕',
      '고블린색': '哥布林',
      'Gobbiebag Brown': '哥布林',
      'ゴブリンブラウン': '哥布林',
      '찰흙색': '页岩棕',
      'Shale Brown': '页岩棕',
      'シェールブラウン': '页岩棕',
      '두더지색': '鼹鼠棕',
      'Mole Brown': '鼹鼠棕',
      'モールブラウン': '鼹鼠棕',
      '비옥토색': '沃土棕',
      'Loam Brown': '沃土棕',
      'ロームブラウン': '沃土棕',
      '밝은 주황색': '明亮橙',
      'Bright Orange': '明亮橙',
      'ブライトオレンジ': '明亮橙',
      '상아색': '骸骨白',
      'Bone White': '骸骨白',
      'ボーンホワイト': '骸骨白',
      '울다하 갈색': '黄沙棕',
      'Ul Brown': '黄沙棕',
      'ウルダハンブラウン': '黄沙棕',
      '사막노란색': '沙漠黄',
      'Desert Yellow': '沙漠黄',
      'デザートイエロー': '沙漠黄',
      '꿀색': '蜂蜜黄',
      'Honey Yellow': '蜂蜜黄',
      'ハニーイエロー': '蜂蜜黄',
      '옥수수색': '玉米黄',
      'Millioncorn Yellow': '玉米黄',
      'ミリオンコーンイエロー': '玉米黄',
      '커얼색': '猛豹黄',
      'Coeurl Yellow': '猛豹黄',
      'クァールイエロー': '猛豹黄',
      '크림색': '奶油黄',
      'Cream Yellow': '奶油黄',
      'クリームイエロー': '奶油黄',
      '할라탈리 노란색': '日影黄',
      'Halatali Yellow': '日影黄',
      'ハラタリイエロー': '日影黄',
      '건포도색': '萄干棕',
      'Raisin Brown': '萄干棕',
      'レーズンブラウン': '萄干棕',
      '카나리아색': '丝雀黄',
      'Canary Yellow': '丝雀黄',
      'カナリーイエロー': '丝雀黄',
      '바닐라색': '香草黄',
      'Vanilla Yellow': '香草黄',
      'バニライエロー': '香草黄',
      '형광 노란색': '霓虹黄',
      'Neon Yellow': '霓虹黄',
      'ネオンイエロー': '霓虹黄',
      '습지 녹색': '泥沼绿',
      'Mud Green': '泥沼绿',
      'マッドグリーン': '泥沼绿',
      '실프색': '妖精绿',
      'Sylph Green': '妖精绿',
      'シルフグリーン': '妖精绿',
      '라임색': '青柠绿',
      'Lime Green': '青柠绿',
      'ライムグリーン': '青柠绿',
      '이끼색': '苔藓绿',
      'Moss Green': '苔藓绿',
      'モスグリーン': '苔藓绿',
      '풀색': '牧草绿',
      'Meadow Green': '牧草绿',
      'メドウグリーン': '牧草绿',
      '올리브색': '橄榄绿',
      'Olive Green': '橄榄绿',
      'オリーヴグリーン': '橄榄绿',
      '늪지 녹색': '沼泽绿',
      'Marsh Green': '沼泽绿',
      'マーシュグリーン': '沼泽绿',
      '풋사과색': '苹果绿',
      'Apple Green': '苹果绿',
      'アップルグリーン': '苹果绿',
      '선인장색': '仙人掌',
      'Cactuar Green': '仙人掌',
      'サボテンダーグリーン': '仙人掌',
      '진녹색': '猎人绿',
      'Hunter Green': '猎人绿',
      'ハンターグリーン': '猎人绿',
      '오츄색': '口花绿',
      'Ochu Green': '口花绿',
      'オチューグリーン': '口花绿',
      '금강거북색': '金龟绿',
      'Adamantoise Green': '金龟绿',
      'アダマンタスグリーン': '金龟绿',
      '노피카의 녹색': '地神绿',
      'Nophica Green': '地神绿',
      'ノフィカグリーン': '地神绿',
      '밀림 녹색': '深林绿',
      'Deepwood Green': '深林绿',
      'ディープウッドグリーン': '深林绿',
      '옅은 청록색': '天上蓝',
      'Celeste Green': '天上蓝',
      'セレストグリーン': '天上蓝',
      '터키석색': '绿松蓝',
      'Turquoise Green': '绿松蓝',
      'ターコイズグリーン': '绿松蓝',
      '몰볼색': '魔花绿',
      'Morbol Green': '魔花绿',
      'モルボルグリーン': '魔花绿',
      '형광 녹색': '霓虹绿',
      'Neon Green': '霓虹绿',
      'ネオングリーン': '霓虹绿',
      '옅은 하늘색': '寒冰蓝',
      'Ice Blue': '寒冰蓝',
      'アイスブルー': '寒冰蓝',
      '하늘색': '天空蓝',
      'Sky Blue': '天空蓝',
      'スカイブルー': '天空蓝',
      '바다안개색': '海雾蓝',
      'Seafog Blue': '海雾蓝',
      'シーフォグブルー': '海雾蓝',
      '공잣깃 파란색': '孔雀蓝',
      'Peacock Blue': '孔雀蓝',
      'ピーコックブルー': '孔雀蓝',
      '로타노 바다색': '罗海蓝',
      'Rhotano Blue': '罗海蓝',
      'ロータノブルー': '罗海蓝',
      '좀비의 얼굴색': '腐尸蓝',
      'Corpse Blue': '腐尸蓝',
      'コープスブルー': '腐尸蓝',
      '청린수색': '青磷蓝',
      'Ceruleum Blue': '青磷蓝',
      'セルレアムブルー': '青磷蓝',
      '쪽빛 파란색': '靛青蓝',
      'Woad Blue': '靛青蓝',
      'ウォードブルー': '靛青蓝',
      '검푸른색': '油墨蓝',
      'Ink Blue': '油墨蓝',
      'インクブルー': '油墨蓝',
      '랍토르색': '盗龙蓝',
      'Raptor Blue': '盗龙蓝',
      'ラプトルブルー': '盗龙蓝',
      '오사드 바다색': '东洲蓝',
      'Othard Blue': '东洲蓝',
      'オサードブルー': '东洲蓝',
      '선명한 파란색': '风暴蓝',
      'Storm Blue': '风暴蓝',
      'ストームブルー': '风暴蓝',
      '보이드의 파란색': '虚空蓝',
      'Void Blue': '虚空蓝',
      'ヴォイドブルー': '虚空蓝',
      '감청색': '皇室蓝',
      'Royal Blue': '皇室蓝',
      'ロイヤルブルー': '皇室蓝',
      '밤하늘색': '午夜蓝',
      'Midnight Blue': '午夜蓝',
      'ミッドナイトブルー': '午夜蓝',
      '청회색': '阴影蓝',
      'Shadow Blue': '阴影蓝',
      'シャドウブルー': '阴影蓝',
      '청보라색': '深渊蓝',
      'Abyssal Blue': '深渊蓝',
      'アビサルブルー': '深渊蓝',
      '새파란색': '龙骑蓝',
      'Dragoon Blue': '龙骑蓝',
      'ドラグーンブルー': '龙骑蓝',
      '담청색': '松石蓝',
      'Turquoise Blue': '松石蓝',
      'ターコイズブルー': '松石蓝',
      '짙은 하늘색': '碧空蓝',
      'Azure Blue': '碧空蓝',
      'アズールブルー': '碧空蓝',
      '라벤더색': '薰衣草',
      'Lavender Purple': '薰衣草',
      'ラベンダーブルー': '薰衣草',
      '어두운 보라색': '忧郁紫',
      'Gloom Purple': '忧郁紫',
      'グルームパープル': '忧郁紫',
      '머루색': '醋栗紫',
      'Currant Purple': '醋栗紫',
      'カラントパープル': '醋栗紫',
      '붓꽃색': '鸢尾紫',
      'Iris Purple': '鸢尾紫',
      'アイリスパープル': '鸢尾紫',
      '포도색': '葡萄紫',
      'Grape Purple': '葡萄紫',
      'グレープパープル': '葡萄紫',
      '연꽃색': '莲花粉',
      'Lotus Pink': '莲花粉',
      'ロータスピンク': '莲花粉',
      '콜리브리색': '蜂鸟粉',
      'Colibri Pink': '蜂鸟粉',
      'コリブリピンク': '蜂鸟粉',
      '매화색': '仙子梅',
      'Plum Purple': '仙子梅',
      'プラムパープル': '仙子梅',
      '자주색': '帝王紫',
      'Regal Purple': '帝王紫',
      'リーガルパープル': '帝王紫',
      '제비꽃색': '罗兰紫',
      'Violet Purple': '罗兰紫',
      'バイオレットパープル': '罗兰紫',
      '순백색': '无瑕白',
      'Pure White': '无瑕白',
      'ピュアホワイト': '无瑕白',
      '칠흑색': '煤玉黑',
      'Jet Black': '煤玉黑',
      'ジェットブラック': '煤玉黑',
      '부드러운 연분홍': '柔彩粉',
      'Pastel Pink': '柔彩粉',
      'パステルピンク': '柔彩粉',
      '짙은 빨강': '黑暗红',
      'Dark Red': '黑暗红',
      'ダークレッド': '黑暗红',
      '짙은 갈색': '黑暗棕',
      'Dark Brown': '黑暗棕',
      'ダークブラウン': '黑暗棕',
      '부드러운 연녹색': '柔彩绿',
      'Pastel Green': '柔彩绿',
      'パステルグリーン': '柔彩绿',
      '짙은 녹색': '黑暗绿',
      'Dark Green': '黑暗绿',
      'ダークグリーン': '黑暗绿',
      '부드러운 연파랑': '柔彩蓝',
      'Pastel Blue': '柔彩蓝',
      'パステルブルー': '柔彩蓝',
      '짙은 파랑': '黑暗蓝',
      'Dark Blue': '黑暗蓝',
      'ダークブルー': '黑暗蓝',
      '부드러운 연보라': '柔彩紫',
      'Pastel Purple': '柔彩紫',
      'パステルパープル': '柔彩紫',
      '짙은 자주색': '黑暗紫',
      'Dark Purple': '黑暗紫',
      'ダークパープル': '黑暗紫',
      '반짝이는 은색': '闪耀银',
      'Metallic Silver': '闪耀银',
      'シャインシルバー': '闪耀银',
      '반짝이는 금색': '闪耀金',
      'Metallic Gold': '闪耀金',
      'シャインゴールド': '闪耀金',
      '금속질 빨간색': '金属红',
      'Metallic Red': '金属红',
      'メタリックレッド': '金属红',
      '금속질 주황색': '金属橙',
      'Metallic Orange': '金属橙',
      'メタリックオレンジ': '金属橙',
      '금속질 노란색': '金属黄',
      'Metallic Yellow': '金属黄',
      'メタリックイエロー': '金属黄',
      '금속질 녹색': '金属绿',
      'Metallic Green': '金属绿',
      'メタリックグリーン': '金属绿',
      '금속질 하늘색': '金属蓝',
      'Metallic Sky Blue': '金属蓝',
      'メタリックスカイブルー': '金属蓝',
      '금속질 파란색': '金属靛',
      'Metallic Blue': '金属靛',
      'メタリックブルー': '金属靛',
      '금속질 보라색': '金属紫',
      'Metallic Purple': '金属紫',
      'メタリックパープル': '金属紫',
      '건메탈색': '炮铜黑',
      'Gunmetal Black': '炮铜黑',
      'ガンメタル': '炮铜黑',
      '진주색': '珍珠白',
      'Pearl White': '珍珠白',
      'パールホワイト': '珍珠白',
      '황동색': '金属铜',
      'Metallic Brass': '金属铜',
      'シャインブラス': '金属铜',
      '금속질 분홍색': '金属粉',
      'Metallic Pink': '金属粉',
      'メタリックピンク': '金属粉',
      '금속질 홍옥색': '金属宝石红',
      'Metallic Ruby Red': '金属宝石红',
      'メタリックルビーレッド': '金属宝石红',
      '금속질 푸른 녹색': '金属钴铁绿',
      'Metallic Cobalt Green': '金属钴铁绿',
      'メタリックコバルトグリーン': '金属钴铁绿',
      '금속질 짙은 파랑': '金属黑暗蓝',
      'Metallic Dark Blue': '金属黑暗蓝',
      'メタリックダークブルー': '金属黑暗蓝',
      '무채색': '无彩色',
      'Neutral': '无彩色',
      '無彩色': '无彩色',
      '빨강': '红色系',
      'Red': '红色系',
      'レッド': '红色系',
      '갈색': '棕',
      'Brown': '棕',
      'ブラウン': '棕',
      '노랑': '黄色系',
      'Yellow': '黄色系',
      'イエロー': '黄色系',
      '녹색': '绿色系',
      'Green': '绿色系',
      'グリーン': '绿色系',
      '파랑': '蓝色系',
      'Blue': '蓝色系',
      'ブルー': '蓝色系',
      '보라': '紫色系',
      'Purple': '紫色系',
      'パープル': '紫色系',
      '특수': '特殊',
      'Special': '特殊',
      '特殊': '特殊',
      '염료 추가': '添加染剂',
      'Add Dye': '添加染剂',
      '染料追加': '添加染剂',
      '클릭하여 제거': '点击移除',
      'Click to remove': '点击移除',
      'クリックで削除': '点击移除',
      '모두 지우기': '全部清空',
      'Clear all': '全部清空',
      '全て削除': '全部清空',
      'selected': '已选择',
      '무기': '武器',
      'Weapon': '武器',
      '武器': '武器',
      '머리': '头部',
      'Head': '头部',
      '頭': '头部',
      '몸통': '身体',
      'Body': '身体',
      '胴': '身体',
      '손': '手部',
      'Hands': '手部',
      '手': '手部',
      '다리': '腿部',
      'Legs': '腿部',
      '脚': '腿部',
      '발': '脚部',
      'Feet': '脚部',
      '足': '脚部',
      '귀걸이': '耳饰',
      'Earrings': '耳饰',
      '耳飾り': '耳饰',
      '목걸이': '项链',
      'Necklace': '项链',
      '首飾り': '项链',
      '팔찌': '手镯',
      'Bracelets': '手镯',
      '腕輪': '手镯',
      '반지': '戒指',
      'Ring': '戒指',
      '指輪': '戒指',
      'アイテム名またはキーワードで検索...': '搜索装备名或关键词...',
      '필터': '筛选',
      'Filters': '筛选',
      'フィルター': '筛选',
      '검색 실행 (Enter)': '执行搜索（回车）',
      'Run search (Enter)': '执行搜索（回车）',
      '検索実行 (Enter)': '执行搜索（回车）',
      'Search': '搜索',
      '検索': '搜索',
      '클릭: 포함, 꾹 누르기(0.5초): 제외': '点击包含，长按 0.5 秒排除',
      'Click: Include, Long press (0.5s): Exclude': '点击包含，长按 0.5 秒排除',
      'クリック: 含む、長押し(0.5秒): 除外': '点击包含，长按 0.5 秒排除',
      '염료 색상': '染剂颜色',
      'Dye Colors': '染剂颜色',
      '染料カラー': '染剂颜色',
      '(최대 3개)': '（最多 3 种）',
      '(up to 3)': '（最多 3 种）',
      '(最大3つ)': '（最多 3 种）',
      '팔레트에서 보기': '查看调色板',
      'View palette': '查看调色板',
      'パレットで見る': '查看调色板',
      '작성자': '作者',
      'By': '作者',
      '作成者': '作者',
      '종족': '种族',
      'Races': '种族',
      '種族': '种族',
      '스타일 태그': '风格标签',
      'Style Tags': '风格标签',
      'スタイルタグ': '风格标签',
      '전체 검색 (XIVAPI 포함)': '全局搜索（包含 XIVAPI）',
      'Global Search (include XIVAPI)': '全局搜索（包含 XIVAPI）',
      '全体検索(XIVAPI含む)': '全局搜索（包含 XIVAPI）',
      '태그가 없는 아이템도 실시간으로 검색해요': '实时搜索没有标签的装备',
      'Also searches untagged items in real time': '实时搜索没有标签的装备',
      'タグなしアイテムもリアルタイムで検索': '实时搜索没有标签的装备',
      '검색 중': '搜索中',
      'Searching': '搜索中',
      '検索中': '搜索中',
      '부위': '部位',
      'Category': '部位',
      '部位': '部位',
      '태그': '标签',
      'Tag': '标签',
      'タグ': '标签',
      '개 투영세트': '套幻化',
      'glamour sets': '件',
      '件': '件',
      '개 아이템': '件装备',
      'items': '件',
      '필터 초기화': '重置筛选',
      'Clear Filters': '重置筛选',
      'フィルターリセット': '重置筛选',
      '적용': '应用',
      'Apply': '应用',
      '適用': '应用',
      'Newest': '最新',
      '新着順': '最新',
      'Popular': '人气',
      '人気順': '人气',
      '정렬:': '排序：',
      'Sort:': '排序：',
      '並び替え:': '排序：',
      '검색 결과가 없습니다.': '没有搜索结果。',
      'No results found.': '没有搜索结果。',
      '検索結果がありません。': '没有搜索结果。',
      'More': '更多',
      'もっと見る': '更多',
      '뒤로 가기': '返回',
      'Back': '返回',
      '戻る': '返回',
      '로딩 중...': '加载中...',
      'Loading...': '加载中...',
      '読み込み中...': '加载中...',
      '데이터가 없습니다.': '暂无数据。',
      'No data available.': '暂无数据。',
      '홈으로 돌아가기': '返回首页',
      'Back to Home': '返回首页',
      'Glamour set not found.': '找不到幻化套装。',
      'グラマーセットが見つかりません。': '找不到幻化套装。',
      '데이터를 불러오는 중 오류가 발생했습니다.': '加载数据时出错。',
      'An error occurred while loading data.': '加载数据时出错。',
      '장비 목록': '装备列表',
      'Equipment List': '装备列表',
      '装備一覧': '装备列表',
      '등록된 아이템이 없습니다.': '暂无已登记的装备。',
      'No items registered.': '暂无已登记的装备。',
      '登録されたアイテムがありません。': '暂无已登记的装备。',
      'Unknown Item': '未知装备',
      '不明なアイテム': '未知装备',
      '뒤로': '返回',
      '탱커': '防护职业',
      'Tank': '防护职业',
      'タンク': '防护职业',
      '힐러': '治疗职业',
      'Healer': '治疗职业',
      'ヒーラー': '治疗职业',
      '학살자': '制敌',
      'Slayer': '制敌',
      'スレイヤー': '制敌',
      '타격대': '强袭',
      'Striker': '强袭',
      '打撃': '强袭',
      '정찰대': '游击',
      'Scouting': '游击',
      '偵察': '游击',
      '유격대': '精准',
      'Aiming': '精准',
      '遠隔': '精准',
      '마술사': '法系',
      'Casting': '法系',
      '魔術': '法系',
      '제작자': '制作',
      'Crafter': '制作',
      'クラフター': '制作',
      '채집가': '采集',
      'Gatherer': '采集',
      'ギャザラー': '采集',
      '안경': '眼镜',
      'Glasses': '眼镜',
      '眼鏡': '眼镜',
      '선글라스': '太阳镜',
      'Sunglasses': '太阳镜',
      'サングラス': '太阳镜',
      '투구': '头盔',
      'Helm': '头盔',
      '兜': '头盔',
      '후드': '兜帽',
      'Hood': '兜帽',
      'フード': '兜帽',
      '머리띠': '发带',
      'Headband': '发带',
      'ヘアバンド': '发带',
      '왕관': '王冠',
      'Crown': '王冠',
      '冠': '王冠',
      '귀마개': '耳罩',
      'Earmuffs': '耳罩',
      'イヤーマフ': '耳罩',
      '베레모': '贝雷帽',
      'Beret': '贝雷帽',
      'ベレー帽': '贝雷帽',
      '두건': '头巾',
      'Bandana': '头巾',
      'バンダナ': '头巾',
      '고글': '护目镜',
      'Goggles': '护目镜',
      'ゴーグル': '护目镜',
      '반가면': '半面罩',
      'Half Mask': '半面罩',
      'ハーフマスク': '半面罩',
      '가면': '面罩',
      'Mask': '面罩',
      'マスク': '面罩',
      '모자': '帽子',
      'Hat': '帽子',
      '帽子': '帽子',
      '서클릿': '头环',
      'Circlet': '头环',
      'サークレット': '头环',
      '서부풍': '西部风帽子',
      'Western hat': '西部风帽子',
      'ウエスタンハット': '西部风帽子',
      '가죽': '皮革',
      'Leather': '皮革',
      'レザー': '皮革',
      '금속': '金属',
      'Metal': '金属',
      '金属': '金属',
      '천': '布料',
      'Cloth': '布料',
      '布': '布料',
      '장식': '装饰',
      'Ornament': '装饰',
      '装飾': '装饰',
      '깃털': '羽毛',
      'Feather': '羽毛',
      '羽': '羽毛',
      '민소매': '无袖',
      'Sleeveless': '无袖',
      'ノースリーブ': '无袖',
      '로브': '长袍',
      'Robe': '长袍',
      'ローブ': '长袍',
      '코트': '外套',
      'Coat': '外套',
      'コート': '外套',
      '조끼': '马甲',
      'Vest': '马甲',
      'ベスト': '马甲',
      '셔츠': '衬衫',
      'Shirt': '衬衫',
      'シャツ': '衬衫',
      '드레스': '连衣裙',
      'Dress': '连衣裙',
      'ドレス': '连衣裙',
      '재킷': '夹克',
      'Jacket': '夹克',
      'ジャケット': '夹克',
      '갑옷': '护甲',
      'Armor': '护甲',
      '鎧': '护甲',
      '긴팔': '长袖',
      'Long Sleeve': '长袖',
      '長袖': '长袖',
      '반팔': '短袖',
      'Short Sleeve': '短袖',
      '半袖': '短袖',
      '소매': '袖子',
      'Sleeves': '袖子',
      '袖': '袖子',
      '슬림핏': '修身',
      'Slim Fit': '修身',
      'スリムフィット': '修身',
      '루즈핏': '宽松',
      'Loose Fit': '宽松',
      'ルーズフィット': '宽松',
      '오버핏': '加大版型',
      'Oversized Fit': '加大版型',
      'オーバーサイズ': '加大版型',
      '레이어드': '叠穿',
      'Layered': '叠穿',
      'レイヤード': '叠穿',
      '긴기장': '长款',
      'Longline': '长款',
      'ロング丈': '长款',
      '크롭': '短款',
      'Crop': '短款',
      'クロップ': '短款',
      '천옷': '布料',
      '자수': '刺绣',
      'Embroidery': '刺绣',
      'ししゅう': '刺绣',
      '망토': '斗篷',
      'Cape': '斗篷',
      'マント': '斗篷',
      '앞트임': '前开衩',
      'Front Slit': '前开衩',
      '前スリット': '前开衩',
      '벨트': '腰带',
      'Belt': '腰带',
      'ベルト': '腰带',
      '금속장식': '装饰配件',
      'Embellishment': '装饰配件',
      '装飾パーツ': '装饰配件',
      '갑주장식': '铠甲装饰',
      'Armor Ornament': '铠甲装饰',
      '甲冑装飾': '铠甲装饰',
      '포켓': '口袋',
      'Pocket': '口袋',
      'ポケット': '口袋',
      '귀족풍': '贵族风',
      'Noblewear': '贵族风',
      'ロイヤルファッション': '贵族风',
      '현대풍': '现代风',
      'Modern Style': '现代风',
      '現代風': '现代风',
      'SF': '科幻',
      '무늬': '花纹',
      'Pattern': '花纹',
      'もよう': '花纹',
      '장갑': '手套',
      'Gloves': '手套',
      '手袋': '手套',
      '건틀릿': '铠甲手套',
      'Gauntlets': '铠甲手套',
      'ガントレット': '铠甲手套',
      '손목보호대': '护腕',
      'Wristguard': '护腕',
      'リストガード': '护腕',
      '팔꿈치 장갑': '及肘手套',
      'Elbow gloves': '及肘手套',
      'ロンググローブ': '及肘手套',
      '반장갑': '半指手套',
      'Half Gloves': '半指手套',
      'ハーフグローブ': '半指手套',
      '비대칭': '不对称',
      'Asymmetrical': '不对称',
      'アシンメトリー': '不对称',
      '반팔화': '短袖款',
      'Short-sleeved version': '短袖款',
      '半袖化装備': '短袖款',
      '스트랩': '绑带',
      'Strap': '绑带',
      'ストラップ': '绑带',
      '문신': '纹身',
      'Tattoo': '纹身',
      'タトゥー': '纹身',
      '치마': '短裙',
      'Skirt': '短裙',
      'スカート': '短裙',
      '레깅스': '紧身裤',
      'Leggings': '紧身裤',
      'レギンス': '紧身裤',
      '슬랙스': '西装裤',
      'Slacks': '西装裤',
      'スラックス': '西装裤',
      '정장': '正装',
      'Suit': '正装',
      'スーツ': '正装',
      '양말': '袜子',
      'Socks': '袜子',
      'くつした': '袜子',
      '바지': '裤子',
      'Pants': '裤子',
      'パンツ': '裤子',
      '반바지': '短裤',
      'Shorts': '短裤',
      'ショートパンツ': '短裤',
      '긴바지': '长裤',
      'Long Pants': '长裤',
      'ロングパンツ': '长裤',
      '롱스커트': '长裙',
      'Long Skirt': '长裙',
      'ロングスカート': '长裙',
      '미니스커트': '迷你裙',
      'Mini Skirt': '迷你裙',
      'ミニスカート': '迷你裙',
      '니삭스': '过膝袜',
      'Knee Socks': '过膝袜',
      'ニーソックス': '过膝袜',
      '와이드': '阔腿',
      'Wide': '阔腿',
      'ワイド': '阔腿',
      '청바지': '牛仔裤',
      'Jeans': '牛仔裤',
      'ジーンズ': '牛仔裤',
      '니트': '针织',
      'Knit': '针织',
      'ニット': '针织',
      '덧천': '罩布',
      'Overlay': '罩布',
      '布付き': '罩布',
      '트임': '开衩',
      'Slit': '开衩',
      'スリット': '开衩',
      '운동화': '运动鞋',
      'Sneakers': '运动鞋',
      'スニーカー': '运动鞋',
      '장화': '长靴',
      'Boots': '长靴',
      'ブーツ': '长靴',
      '구두': '鞋子',
      'Shoes': '鞋子',
      '靴': '鞋子',
      '부츠': '长靴',
      '샌들': '凉鞋',
      'Sandals': '凉鞋',
      'サンダル': '凉鞋',
      '하이힐': '高跟鞋',
      'High Heels': '高跟鞋',
      'ハイヒール': '高跟鞋',
      '슬리퍼': '拖鞋',
      'Slippers': '拖鞋',
      'スリッパ': '拖鞋',
      '갑주장화': '铠甲靴',
      'Greaves': '铠甲靴',
      'グリーヴ': '铠甲靴',
      '롱부츠': '长靴',
      'Long Boots': '长靴',
      'ロングブーツ': '长靴',
      '앵클부츠': '踝靴',
      'Ankle Boots': '踝靴',
      'アンクルブーツ': '踝靴',
      '니하이부츠': '及膝靴',
      'Knee-high Boots': '及膝靴',
      'ニーハイブーツ': '及膝靴',
      '레그워머': '暖腿套',
      'Leg Warmer': '暖腿套',
      'レッグウォーマー': '暖腿套',
      '드롭': '掉落',
      'Drop': '掉落',
      'ドロップ': '掉落',
      '링': '戒指',
      'リング': '戒指',
      '스터드': '耳钉',
      'Stud': '耳钉',
      'スタッド': '耳钉',
      '후프': '圈环',
      'Hoop': '圈环',
      'フープ': '圈环',
      '매듭': '绳结',
      'Knot': '绳结',
      '結び目': '绳结',
      '보석': '宝石',
      'Gemstone': '宝石',
      '宝石': '宝石',
      '초커': '颈环',
      'Choker': '颈环',
      'チョーカー': '颈环',
      '펜던트': '吊坠',
      'Pendant': '吊坠',
      'ペンダント': '吊坠',
      '체인': '链条',
      'Chain': '链条',
      'チェーン': '链条',
      '스카프': '围巾',
      'Scarf': '围巾',
      'スカーフ': '围巾',
      '검': '剑',
      'Sword': '剑',
      '剣': '剑',
      '도끼': '斧',
      'Axe': '斧',
      '斧': '斧',
      '창': '长枪',
      'Spear': '长枪',
      '槍': '长枪',
      '지팡이': '法杖',
      'Staff': '法杖',
      '杖': '法杖',
      '활': '弓',
      'Bow': '弓',
      '弓': '弓',
      '총': '枪',
      'Gun': '枪',
      '銃': '枪',
      '단검': '匕首',
      'Dagger': '匕首',
      '短剣': '匕首',
      '방패': '盾',
      'Shield': '盾',
      '盾': '盾',
      '망치': '锤',
      'Hammer': '锤',
      'ハンマー': '锤',
      '나무': '木材',
      'Wood': '木材',
      '木': '木材',
      '마법석': '魔法石',
      'Magic Stone': '魔法石',
      '魔法石': '魔法石',
      '광택': '光泽',
      'Glow': '光泽',
      '輝き': '光泽',
      '고대': '古代',
      'Ancient': '古代',
      '古代': '古代',
      '뱅글': '手镯',
      'Bangle': '手镯',
      'バングル': '手镯',
      '밴드': '环带',
      'Band': '环带',
      'バンド': '环带',
      '인장': '印章',
      'Signet': '印章',
      '印章': '印章',
      '세팅': '镶嵌',
      'Setting': '镶嵌',
      'セッティング': '镶嵌',
      '닫기': '关闭',
      'Close': '关闭',
      '閉じる': '关闭',
      '상세 정보 보기': '查看详情',
      'View Details': '查看详情',
      '詳細を見る': '查看详情',
      '공식 홈페이지': '官方网站',
      'Official Site': '官方网站',
      '公式サイト': '官方网站',
      '공식 데이터베이스에서 확인': '查看官方数据库',
      'Check in Official Database': '查看官方数据库',
      '公式データベースで確認': '查看官方数据库',
      '태그 없음': '无标签',
      'No tags': '无标签',
      'タグなし': '无标签',
      '검색 조건에 맞는 아이템이 없습니다.': '没有符合筛选条件的装备。',
      'No items match the search criteria.': '没有符合筛选条件的装备。',
      '検索条件に一致するアイテムがありません。': '没有符合筛选条件的装备。',
      '필터 초기화하기': '重置筛选',
      'Reset Filters': '重置筛选',
      'フィルターをリセット': '重置筛选',
      '이름 없음': '未知装备',
      '名前なし': '未知装备',
      '사용 가능한 직업': '可使用职业',
      'Available Jobs': '可使用职业',
      '使用可能なジョブ': '可使用职业',
      'XIVAPI': 'XIVAPI',
      '태그 없는 아이템입니다': '此装备暂时没有标签',
      'This item has no tags yet': '此装备暂时没有标签',
      'タグなしのアイテムです': '此装备暂时没有标签',
      'XIVAPI에서도 검색해보기': '同时搜索 XIVAPI',
      'Try searching XIVAPI too': '同时搜索 XIVAPI',
      'XIVAPIでも検索してみる': '同时搜索 XIVAPI',
      'DPS': 'DPS',
      '컨셉 & 페어 룩': '概念穿搭与双人搭配',
      'Concepts & Pair Looks': '概念穿搭与双人搭配',
      'コンセプト & ペアルック': '概念穿搭与双人搭配',
      '등록된 컨셉이 없습니다.': '暂无概念穿搭。',
      'No concepts to display.': '暂无概念穿搭。',
      '登録されたコンセプトがありません。': '暂无概念穿搭。',
      '포함된 투영': '包含的穿搭',
      'Included Looks': '包含的穿搭',
      '含まれる投影': '包含的穿搭',
      '투영 보기': '查看穿搭',
      'View Look': '查看穿搭',
      '投影を見る': '查看穿搭',
      '표시할 작성자가 없습니다.': '暂无作者。',
      'No authors to display.': '暂无作者。',
      '表示する作成者がいません。': '暂无作者。',
      '작성자 목록을 불러오지 못했습니다.': '无法加载作者列表。',
      'Failed to load the author list.': '无法加载作者列表。',
      '作成者リストを読み込めませんでした。': '无法加载作者列表。',
      '이전': '上一页',
      'Prev': '上一页',
      '前へ': '上一页',
      '다음': '下一页',
      'Next': '下一页',
      '次へ': '下一页',
      '컨셉을 찾을 수 없습니다.': '未找到概念穿搭。',
      'Concept not found.': '未找到概念穿搭。',
      '포함된 페어 룩': '包含的双人穿搭',
      'Included Pair Looks': '包含的双人穿搭',
      '상세 보기': '查看穿搭',
      '내 코드': '我的代码',
      'My Code': '我的代码',
      'マイコード': '我的代码',
      '코드로 좋아요 목록을 여러 기기에서 동기화하세요.': '使用代码在多台设备间同步点赞列表。',
      'Sync your likes across devices with a code.': '使用代码在多台设备间同步点赞列表。',
      'コードでお気に入りを複数のデバイスで同期。': '使用代码在多台设备间同步点赞列表。',
      '코드 관리': '管理代码',
      'Manage Code': '管理代码',
      'コード管理': '管理代码',
      '현재 내 코드': '当前代码',
      'Your code': '当前代码',
      'あなたのコード': '当前代码',
      '복사': '复制',
      'Copy': '复制',
      'コピー': '复制',
      '복사됨!': '已复制！',
      'Copied!': '已复制！',
      'コピー済!': '已复制！',
      '⚠️ 이 코드를 잃어버리면 좋아요 목록을 복구할 수 없습니다. 반드시 안전한 곳에 저장하세요.': '⚠️ 丢失此代码后将无法恢复点赞记录，请妥善保存。',
      '⚠️ If you lose this code, your likes cannot be recovered. Save it somewhere safe.': '⚠️ 丢失此代码后将无法恢复点赞记录，请妥善保存。',
      '⚠️ このコードを失うとお気に入りは復元できません。安全な場所に保管してください。': '⚠️ 丢失此代码后将无法恢复点赞记录，请妥善保存。',
      '새 코드 발급': '生成新代码',
      'Issue new code': '生成新代码',
      '新しいコードを発行': '生成新代码',
      '지금 이 기기의 좋아요가 새 코드에 저장됩니다.': '此设备当前的点赞记录将保存到新代码。',
      'Your current likes on this device will be saved to the new code.': '此设备当前的点赞记录将保存到新代码。',
      'このデバイスの現在のお気に入りが新しいコードに保存されます。': '此设备当前的点赞记录将保存到新代码。',
      '기존 코드 입력': '输入已有代码',
      'Enter existing code': '输入已有代码',
      '既存のコードを入力': '输入已有代码',
      '다른 기기에서 발급받은 코드를 입력하면 좋아요가 합쳐집니다.': '输入其他设备生成的代码，以合并点赞记录。',
      'Enter a code from another device to merge likes.': '输入其他设备生成的代码，以合并点赞记录。',
      '他のデバイスのコードを入力するとお気に入りが統合されます。': '输入其他设备生成的代码，以合并点赞记录。',
      'XXXX-XXXX-XXXX-XXXX': 'XXXX-XXXX-XXXX-XXXX',
      '코드를 찾을 수 없습니다.': '未找到代码。',
      'Code not found.': '未找到代码。',
      'コードが見つかりません。': '未找到代码。',
      '이 기기에서 코드 해제': '解除此设备的关联',
      'Unlink this device': '解除此设备的关联',
      'このデバイスから解除': '解除此设备的关联',
      '코드를 해제하시겠습니까? 좋아요 기록은 그대로 유지됩니다.': '确定解除代码关联？此设备的点赞记录将保留。',
      'Unlink the code? Your likes on this device will remain.': '确定解除代码关联？此设备的点赞记录将保留。',
      'コードを解除しますか？このデバイスのお気に入りは保持されます。': '确定解除代码关联？此设备的点赞记录将保留。',
      '내 좋아요': '收藏',
      'お気に入り': '收藏',
      '아직 좋아요한 항목이 없습니다.': '暂无点赞记录。',
      'No liked items yet.': '暂无点赞记录。',
      'まだお気に入りがありません。': '暂无点赞记录。',
      '불러오는 중...': '加载中...',
      '염료 색상 지도': '染剂颜色地图',
      'Dye Color Map': '染剂颜色地图',
      '染料カラーマップ': '染剂颜色地图',
      '원하는 색상을 선택해 투영세트를 검색해보세요. 다중 선택 모드에서는 최대 3개까지 조합하여 검색할 수 있어요.': '选择颜色来搜索幻化套装；多选模式最多可以组合 3 种染剂。',
      'Select colors to search for glamour sets. Use multiple selection mode to search with up to 3 dyes.': '选择颜色来搜索幻化套装；多选模式最多可以组合 3 种染剂。',
      '好きな色を選択してグラマーセットを検索しましょう。複数選択モードでは最大3つまで組み合わせて検索できます。': '选择颜色来搜索幻化套装；多选模式最多可以组合 3 种染剂。',
      '선택 모드': '选择模式',
      'Selection Mode': '选择模式',
      '選択モード': '选择模式',
      '단일 선택': '单选',
      'Single Select': '单选',
      '単一選択': '单选',
      '다중 선택 (최대 3개)': '多选（最多 3 种）',
      'Multi Select (Max 3)': '多选（最多 3 种）',
      '複数選択 (最大3つ)': '多选（最多 3 种）',
      '색 조합 모드': '配色模式',
      'Harmony Mode': '配色模式',
      '配色モード': '配色模式',
      '접기': '关闭',
      'Less': '关闭',
      '선택 안 함': '无',
      '유사색': '邻近色',
      'Analogous': '邻近色',
      '類似色': '邻近色',
      '보색': '互补色',
      'Complement': '互补色',
      '補色': '互补色',
      '3색 조합': '三角配色',
      'Triadic': '三角配色',
      '3色配色': '三角配色',
      '기본 전부': '全部基础色',
      'All Basic': '全部基础色',
      '基本すべて': '全部基础色',
      '단색조': '单色系',
      'Monochromatic': '单色系',
      '単色調': '单色系',
      '분할 보색': '分裂互补色',
      'Split Complement': '分裂互补色',
      '分裂補色': '分裂互补色',
      '사각 조합': '正方形配色',
      'Square': '正方形配色',
      'スクエア': '正方形配色',
      '직사각 조합': '矩形配色',
      'Tetradic': '矩形配色',
      'テトラード': '矩形配色',
      '톤 일치': '色调匹配',
      'Tonal': '色调匹配',
      'トーン一致': '色调匹配',
      '한난 대비': '冷暖对比',
      'Warm-Cool': '冷暖对比',
      '暖寒対比': '冷暖对比',
      '채도': '饱和度',
      'Saturation': '饱和度',
      '彩度': '饱和度',
      '명도': '明度',
      'Lightness': '明度',
      '明度': '明度',
      '선택한 색': '已选颜色',
      'Selected Colors': '已选颜色',
      '選択した色': '已选颜色',
      '선택한 염료로 검색': '用已选染剂搜索',
      'Search with selected dyes': '用已选染剂搜索',
      '選択した染料で検索': '用已选染剂搜索',
      '유사색 (비슷한 색감)': '邻近色（相近色相）',
      'Analogous (similar hue)': '邻近色（相近色相）',
      '類似色 (近い色相)': '邻近色（相近色相）',
      '보색 (반대 색감)': '互补色（相反色相）',
      'Complement (opposite hue)': '互补色（相反色相）',
      '補色 (反対の色相)': '互补色（相反色相）',
      '3색 조합 (균형잡힌 대비)': '三角配色（均衡对比）',
      'Triadic (balanced contrast)': '三角配色（均衡对比）',
      '3色配色 (均衡のとれたコントラスト)': '三角配色（均衡对比）',
      '단색조 (같은 색감, 다른 명도/채도)': '单色配色（相同色相，不同明度和饱和度）',
      'Monochromatic (same hue, varying tone)': '单色配色（相同色相，不同明度和饱和度）',
      '単色調 (同色相、明度/彩度違い)': '单色配色（相同色相，不同明度和饱和度）',
      '분할 보색 (보색의 양옆)': '分裂互补色（互补色的两侧）',
      'Split Complement (sides of complement)': '分裂互补色（互补色的两侧）',
      '分裂補色 (補色の両隣)': '分裂互补色（互补色的两侧）',
      '사각 조합 (90° 간격 4색)': '正方形配色（间隔 90° 的 4 种颜色）',
      'Square (4 colors at 90°)': '正方形配色（间隔 90° 的 4 种颜色）',
      'スクエア (90°間隔の4色)': '正方形配色（间隔 90° 的 4 种颜色）',
      '직사각 조합 (두 쌍의 보색)': '矩形配色（两组互补色）',
      'Tetradic (two complement pairs)': '矩形配色（两组互补色）',
      'テトラード (2組の補色)': '矩形配色（两组互补色）',
      '톤 일치 (비슷한 명도·채도)': '色调匹配（相近明度与饱和度）',
      'Tonal (matched lightness & chroma)': '色调匹配（相近明度与饱和度）',
      'トーン一致 (近い明度・彩度)': '色调匹配（相近明度与饱和度）',
      '한난 대비 (반대 온도감)': '冷暖对比',
      'Warm-Cool Contrast': '冷暖对比',
      '무채색은 색상환에서 색상값(Hue)이 없어 보색·유사색이 정의되지 않아요. (단색조·톤 일치는 가능)': '无彩色没有明确的色相，无法定义互补色或邻近色；仍可使用单色配色与色调匹配。',
      'Achromatic colors have no defined hue. (Monochromatic and tonal still work)': '无彩色没有明确的色相，无法定义互补色或邻近色；仍可使用单色配色与色调匹配。',
      '無彩色は色相が定義されていません。(単色調・トーン一致は可能)': '无彩色没有明确的色相，无法定义互补色或邻近色；仍可使用单色配色与色调匹配。',
      '매칭되는 색이 없어요': '没有匹配的颜色',
      'No matching colors': '没有匹配的颜色',
      '一致する色がありません': '没有匹配的颜色',
      '나만의 팔레트': '我的调色板',
      'My Palette': '我的调色板',
      'マイパレット': '我的调色板',
      '팔레트에 담기': '加入调色板',
      'Add to palette': '加入调色板',
      'パレットに追加': '加入调色板',
      '팔레트에서 제거': '移除',
      'Remove': '移除',
      '削除': '移除',
      '비우기': '清空',
      'Clear': '清空',
      'クリア': '清空',
      '팔레트 내보내기': '导出调色板',
      'Export Palette': '导出调色板',
      'パレットを書き出し': '导出调色板',
      '염료명 리스트 복사': '复制染剂名称列表',
      'Copy dye list': '复制染剂名称列表',
      '染料名リストをコピー': '复制染剂名称列表',
      '이미지로 저장': '保存为图片',
      'Save as image': '保存为图片',
      '画像として保存': '保存为图片',
      '색을 선택한 뒤 팔레트에 담아보세요.': '选择染剂并加入调色板。',
      'Select dyes and add them to your palette.': '选择染剂并加入调色板。',
      '色を選択してパレットに追加してください。': '选择染剂并加入调色板。',
      '복사 완료!': '已复制！',
      'コピーしました！': '已复制！',
      'Author': '作者',
      'Min': '最低',
      'Max': '最高',
      'KO': '韩语',
      'EN': '英语',
      'JA': '日语',
      '개 선택됨': '项已选择',
      ' items': '件装备',
      ' glamour sets': '套幻化',
      '태그 검색...': '搜索标签...',
      '한국어 태그': '韩语标签',
      '영어 태그': '英语标签',
      '일본어 태그': '日语标签',
      '한국어로 아이템 검색...': '用韩语搜索装备...',
      '🔍 XIVAPI에서 검색': '🔍 搜索 XIVAPI',
      '기재되어있는 회사명 · 제품명 · 시스템 이름은 해당 소유자의 상표 또는 등록 상표입니다.': '所列公司名、产品名和系统名均为其各自所有者的商标或注册商标。',
      '이미지 편집 및 내보내기': '编辑与导出图片',
      '취소': '取消',
      'Canvas 이미지 편집기': 'Canvas 图片编辑器',
      '렌더링 중...': '渲染中...',
      '캔버스 설정': '画布设置',
      '이미지 비율': '图片比例',
      '3:4 (기본)': '3:4（默认）',
      '1:1 (정방형)': '1:1（正方形）',
      '패널 배경색': '面板背景色',
      '즐겨찾기 색상 (최대 5개)': '收藏颜色（最多 5 种）',
      '즐겨찾기에서 삭제': '从收藏移除',
      '레이아웃 & 텍스트': '布局与文字',
      '글씨 그림자 사용': '启用文字阴影',
      '그림자 색상': '阴影颜色',
      '(로딩 중...)': '（加载中...）',
      '기본 폰트': '默认字体',
      '미리보기 새로고침': '刷新预览',
      '고품질 이미지 다운로드': '下载高质量图片',
      '관리자 메뉴': '管理员菜单',
      '언어 선택': '选择语言',
      '종족 선택': '选择种族',
      '전체 선택': '全选',
      '선택 해제': '取消选择',
      '스타일 태그 (복수 선택 가능)': '风格标签（可多选）',
      '태그 추가': '添加标签',
      '텍스트 자동 입력': '自动填入文字',
      '장비 정보가 포함된 텍스트를 붙여넣으면 자동으로 아이템을 찾아 적용합니다. 일본어 복붙 시 고유 ID 기반으로 한국어 DB와 완벽 매칭됩니다.': '粘贴包含装备信息的文字，自动查找并应用装备；日文内容通过唯一 ID 匹配韩文数据库。',
      '모든직업': '全部职业',
      '검색 중...': '搜索中...',
      '결과가 없어요. 다른 키워드로 검색해보세요.': '没有结果，请尝试其他关键词。',
      '📋 다른 아이템에서 가져오기': '📋 从其他装备导入',
      '이름 검색': '按名称搜索',
      '목록에서 고르기': '从列表选择',
      '아이템 이름으로 검색...': '按装备名搜索...',
      '결과가 없어요.': '没有结果。',
      '목록을 불러오는 중...': '正在加载列表...',
      '이 카테고리에 저장된 아이템이 없어요.': '此分类暂无已保存的装备。',
      '같은 카테고리만 표시': '仅显示同一分类',
      '아이템 이름 (형식: 한국어 · 영어 · 일본어)': '装备名称（格式：韩语 · 英语 · 日语）',
      '레온하트 재킷 · Leonhart Jacket · レオンハート・ジャケット': '狮心夹克 · Leonhart Jacket · レオンハート・ジャケット',
      '한국어:': '韩语：',
      '영어:': '英语：',
      '일본어:': '日语：',
      '키워드 선택': '选择关键词',
      '+ 새 키워드': '+ 新关键词',
      '한국어': '韩语',
      '영어': '英语',
      '일본어': '日语',
      '카테고리': '分类',
      '선택 안함': '未选择',
      '추가': '添加',
      '이 부위에 해당하는 키워드가 없습니다.': '此部位暂无对应关键词。',
      '🏷️ 태그 없음 · 편집하기': '🏷️ 无标签 · 编辑',
      '아이템 제거': '移除装备',
      '아이템을 추가해주세요': '请添加装备',
      '데이터 로딩 중...': '数据加载中...',
      '각 슬롯의 "태그 없음 · 편집하기" 버튼을 눌러 태그를 채워주세요. 태그를 채워 DB에 등록하면 글래머 세트에 포함됩니다. (등록하지 않으면 글래머 세트 저장 시 제외됩니다)': '点击各部位的“无标签 · 编辑”按钮填写标签，登记到数据库后将纳入幻化套装；未登记的装备在保存时会被排除。',
      '메인 이미지': '主图片',
      '기존 이미지를 사용 중입니다. 새 이미지를 업로드하면 교체됩니다.': '当前使用已有图片，上传新图片后将替换。',
      '장비 선택': '选择装备',
      '추가 정보 (선택사항)': '附加信息（选填）',
      '사용 가능한 직업 (선택된 모든 아이템과 호환되는 직업)': '可用职业（兼容所有已选装备）',
      '🆕 저장하면 DB의 items 컬렉션에 등록되고 이 세트에 자동으로 적용됩니다.': '🆕 保存后会登记到装备数据库，并自动应用到此套装。',
      '돌아가기': '返回',
      '아이템 이름 또는 키워드로 검색...': '按装备名或关键词搜索...',
      'DB에 없어서 XIVAPI에서 찾았어요. "태그 없이 장착" 하거나 "편집 후 등록" 중 선택할 수 있어요.': '数据库暂无此装备，已从 XIVAPI 找到；可以选择“无标签装备”或“编辑后登记”。',
      'DB와 XIVAPI 어디서도 아이템을 찾지 못했어요.': '数据库与 XIVAPI 均未找到装备。',
      '새 아이템 직접 등록하러 가기 →': '手动登记新装备 →',
      '검색어를 입력하여 아이템을 찾아보세요.': '输入关键词来查找装备。',
      '아이템 선택': '选择装备',
      '전체': '全部',
      '검색어를 입력하세요': '请输入搜索词',
      '삭제': '删除',
      '선택할 수 있는 아이템이 없습니다.': '暂无可选装备。',
      '업로드 중 오류:': '上传出错：',
      '아이템 관리': '装备管理',
      '직업 아이콘 업로드 (임시 관리 페이지)': '上传职业图标（临时管理页面）',
      '이 페이지는 직업 아이콘을 Firebase에 업로드하기 위한 임시 페이지입니다.': '此临时页面用于向 Firebase 上传职业图标。',
      '각 직업 박스를 클릭하여 이미지 선택': '点击职业框选择图片',
      '이미지를 직업 박스로 드래그 앤 드롭': '将图片拖入职业框',
      'PNG 형식의 투명 배경 이미지 권장': '建议使用透明背景的 PNG 图片',
      '역할 대표 아이콘': '职能代表图标',
      '업로드 상태': '上传状态',
      '역할 아이콘 디버그 정보': '职能图标调试信息',
      '현재 역할 아이콘 상태:': '当前职能图标状态：',
      '역할 아이콘 초기화': '重置职能图标',
      '모든 직업 아이콘 초기화': '重置所有职业图标',
      '업로드된 직업 아이콘 URL 보기 (디버그용)': '查看已上传的职业图标链接（调试用）',
      '홈으로': '返回首页',
      '로그아웃': '退出登录',
      '🔒 관리자 로그인': '🔒 管理员登录',
      '이메일': '电子邮箱',
      '비밀번호': '密码',
      '아직 계정이 없으신가요?': '还没有账号？',
      '관리자 회원가입 →': '注册管理员账号 →',
      '가입 신청이 접수되었습니다': '已收到注册申请',
      '📝 관리자 회원가입': '📝 管理员注册',
      '가입 후 슈퍼 관리자의 승인을 받아야 이용할 수 있습니다.': '注册后需要超级管理员批准才能使用。',
      '식별자 (대문자 1글자)': '标识符（一个大写字母）',
      '업로드한 글래머 세트의 작성자 표시에 사용됩니다. (A~Z 중 미사용된 글자)': '用于显示已上传幻化套装的作者（选择 A～Z 中尚未使用的字母）。',
      '비밀번호 (6자 이상)': '密码（至少 6 个字符）',
      '비밀번호 확인': '确认密码',
      '이미 계정이 있으신가요? 로그인': '已有账号？登录',
      '👑 관리자 승인 관리': '👑 管理员审批管理',
      '🛠 시스템 메타데이터 갱신': '🛠 更新系统元数据',
      '전체 데이터를 조사하여 필터에 쓰이는 통계 데이터를 갱신합니다. (최초 1회성 권장)': '扫描全部数据，更新筛选所需的统计信息（建议首次执行一次）。',
      '[투영 세트]': '[幻化套装]',
      '[아이템 목록]': '[装备列表]',
      '[UID 복원]': '[恢复 UID]',
      '🔧 식별자 직접 편집': '🔧 直接编辑标识符',
      'admins 목록에 없는 식별자(예: 슈퍼관리자 본인)의 프로필 이미지를 직접 편집할 수 있습니다.': '可以直接编辑管理员列表之外标识符的头像，例如超级管理员本人。',
      '예: D': '例如：D',
      '불러오기': '加载',
      '식별자 변경': '修改标识符',
      '승인': '批准',
      '거절': '拒绝',
      '재승인': '重新批准',
      '권한 해제': '撤销权限',
      '작성자 소개 페이지에 표시되는 언어별 프로필 이미지입니다.': '按语言显示在作者介绍页面的头像。',
      '이미지 없음': '暂无图片',
      'JPG · PNG · WEBP · 최대 5MB · 권장 비율 5:8': 'JPG · PNG · WEBP · 最大 5MB · 建议比例 5:8',
      '후원 안내': '赞助说明',
      '컨셉 커버 이미지': '概念穿搭封面',
      '컨셉 제목': '概念穿搭标题',
      '한국어 (필수)': '韩语（必填）',
      '예: 빛의 전사 페어룩': '例如：光之战士双人穿搭',
      '영어 (선택)': '英语（选填）',
      '일본어 (선택)': '日语（选填）',
      '+ 투영 추가하기': '+ 添加穿搭',
      '포함된 투영이 없습니다.': '暂无包含的穿搭。',
      '컨셉에 묶어줄 기존 룩들을 추가해주세요.': '请添加要纳入此概念的已有穿搭。',
      '기존 투영 검색': '搜索已有穿搭',
      '작성자 닉네임, 직업 등으로 검색...': '按作者昵称、职业等搜索...',
      '제거': '移除',
      '중동풍': '中东风',
      '방랑자': '流浪者',
      '와일드': '狂野',
      '화려한': '华丽',
      '신비로움': '神秘',
      '반갑주': '半身甲',
      '다크 판타지': '暗黑奇幻',
      '테크웨어': '机能风',
      '고대풍': '古代风',
      '기사': '骑士',
      '사냥꾼': '猎人',
      '갑주': '铠甲',
      '제복': '制服',
      '에스닉': '民族风',
      '아이돌': '偶像风',
      '신전': '神殿',
      '페어컨셉': '双人主题',
      '고딕 마법사': '哥特魔法师',
      '해적': '海盗',
      '의례복': '礼仪服',
      '용병': '雇佣兵',
      '성기사': '圣骑士',
      '사제': '祭司',
      '아카데믹': '学院风',
      '농부': '农夫',
      '음식': '美食',
      '선지자': '先知',
      '해군': '海军',
      'JobSet': '职业套装',
      'Fur': '毛皮',
      'Wrist gloves': '护腕手套',
      'noblewear': '贵族服饰',
      'Leather Detail': '皮革细节',
      'front slit': '前开衩',
      'Tunic': '束腰外衣',
      'casual': '休闲',
      'Frill': '荷叶边',
      'Wide sleeves': '宽袖',
      'Wide-brim': '宽檐',
      'suit': '西装',
      'Eye patch': '眼罩',
      'Bag': '包袋',
      'Bracelet': '手镯',
      'Cravat': '领巾',
      'Headpiece': '头饰',
      'Antler': '鹿角',
      'Apron': '围裙',
      'Cap': '帽子',
      'Cropped pants': '七分裤',
      'Stitch': '缝线',
      't-shirt': 'T 恤',
      'Nail': '美甲',
      'Tassel': '流苏',
      'Tricorn Hat': '三角帽',
      'Veil': '面纱',
      'Kanmuri': '冠饰',
      'Wings': '翅膀',
      'Long Gloves': '长手套',
      'corset': '束身衣',
      '\'Blue Mage\'s Arm': '青魔法师武器',
      'face decoration': '面部装饰',
      'Bandage': '绷带',
      'Monocle': '单片眼镜',
      'Samurai\'s Arm': '武士武器',
      'chakram': '圆月轮',
      'Scythe': '镰刀',
      'Hairpin': '发簪',
      'horoscope': '星象仪',
      'rapier': '刺剑',
      'knuckles': '拳套',
      'Healing Tome': '治疗魔导书',
      'Sage\'s Weapon': '贤者武器',
      'Top Hat': '高顶礼帽',
      'Rapier': '刺剑',
      'Poncho': '斗篷',
      'Fedora': '软呢帽',
      'Jumpsuit': '连体服',
      '해외 결제': '海外支付',
      '후원금은 모두 웹사이트의 운영 비용 또는 파트너 업로드 분들의 수고비로 지불될 예정입니다.': '赞助款将全部用于网站运营费用或支付合作投稿者的劳务报酬。',
      'Ko-fi를 통해 후원하실 수 있습니다.': '您可以通过 Ko-fi 赞助。',
      'Ko-fi에서 후원하기': '前往 Ko-fi 赞助',
      '국내 계좌 이체': '韩国境内银行转账',
      '은행': '银行',
      '계좌번호': '银行账号',
      '예금주': '账户名',
      '후원금 사용 내역': '赞助款用途明细',
      '후원금이 어떻게 사용되고 있는지 투명하게 공개합니다.': '我们将公开赞助款的使用明细，确保资金使用透明。',
      '구글 시트로 내역 보기': '在 Google 表格中查看明细',
      '따뜻한 마음에 진심으로 감사드립니다.': '衷心感谢您的支持与厚爱。',
      'Glamour Set': '幻化套装',
      'looks': '套穿搭',
      'FF14 글래머 투영': 'FF14 幻化投影',
      'All company names, product names, and system names mentioned are trademarks or registered trademarks of their respective owners.': '所列公司名、产品名和系统名均为其各自所有者的商标或注册商标。',
    };

    /* @zhixia:core-dictionary-start */
    /* ── Core Dictionary（v1.4 Phase 5）：运行时词典——dict.json 六层原地合并
         （common + 5 站）、旧译→新译修正收集与定向替换、派生缓存失效，及对外接口
         （get / has / update / getRevision / invalidate）。与 Core Translator 相邻，
         接口为后续模块的统一查询面。Phase 15 模块化构建时，本区段将原样抽出为
         src/core/dictionary.js。 */

    /* ── 词库运行时更新（v1.2.0）：dict.json → 各站词典「原地合并」──────────────
       词典对象引用遍布引擎（DICT_FC 直查、子串表、派生缓存等），reassign 会使引用失效；
       故用 Object.assign 原地更新 + 清派生缓存（子串键/前缀），新词全链路即时生效。
       另收集「修正词条」（旧译→新译）做定向替换：已译文本会被中文幂等逻辑跳过，
       不替换则旧译残留到会话结束（新增词条无需此步——补扫会处理未译文本）。 */
    // v1.2.x：单层合并与修正收集拆出（降认知复杂度）
    let _dictFixesBuf = null; // NOSONAR — 词典修正缓冲区按运行时应用阶段更新

    function _dictFixCheck(obj, k, newV) {
      const oldV = obj[k];
      if (typeof oldV === 'string' && oldV && typeof newV === 'string' && newV && oldV !== newV) {
        _dictFixesBuf.push([oldV, newV]);
      }
    }

    function _applyDictLayer(key, obj, d, common) {
      const extra = (d[key] && typeof d[key] === 'object') ? d[key] : null;
      if (extra) for (const k in extra) _dictFixCheck(obj, k, extra[k]);
      if (common) { for (const k in common) { if (extra?.[k] !== undefined) { continue; } _dictFixCheck(obj, k, common[k]); } }
      if (common) Object.assign(obj, common);
      if (extra) Object.assign(obj, extra);
    }

    function applyRuntimeDict(txt) {
      if (typeof txt !== 'string' || !txt.startsWith('{')) return;
      let d = null;
      try { d = JSON.parse(txt); } catch (e) { return; }
      if (!d || typeof d !== 'object') return;
      const common = (d.common && typeof d.common === 'object') ? d.common : null;
      // 五站层顺序固定；六层词表引用见 DICT_LAYERS（词典接口区）
      const layers = ['main', 'ec', 'fc', 'ronka', 'acl', 'endcloset'];
      _dictFixesBuf = [];
      try {
        if (common) Object.assign(DICT_COMMON, common);
        for (const key of layers) {
          const obj = DICT_LAYERS[key];
          if (!obj) continue;
          _applyDictLayer(key, obj, d, common);
        }
      } catch (e) { _zhxErr('dictApply', e); /* 词库应用 best-effort：失败不阻断，但记录 */ }
      _dictRevision++;   // 词典修订号（getRevision 提供）
      // 派生缓存重建（子串键列表 / 组合键列表由词典实时生成）——统一经词典失效入口
      try { dictInvalidate(); } catch (e) { /* 忽略：派生缓存失效内部按类防护 */ }
      // 定向替换：旧译 → 新译（去重后单次全页扫描）
      const fixes = _dictFixesBuf;
      _dictFixesBuf = null;
      try { _sweepDictFixes(fixes); } catch (e) { _zhxErr('dictSweep', e); }
    }
    // v1.2.x：去重与单节点扫描拆出（降认知复杂度）
    function _sweepDedupe(fixes) {
      const seen = new Set();
      const uniq = [];
      for (const [oldV, newV] of fixes) {
        if (!oldV || !newV || oldV === newV) continue;
        const k = oldV + '\u0000' + newV;
        if (seen.has(k)) continue;
        seen.add(k);
        uniq.push([oldV, newV]);
      }
      return uniq;
    }

    function _sweepNode(n, uniq) {
      let v = n.nodeValue;
      if (!v) return;
      let changed = false;
      for (const [oldV, newV] of uniq) {
        if (v.includes(oldV)) { v = v.split(oldV).join(newV); changed = true; }
      }
      if (changed) { try { n.nodeValue = v; } catch (e) { /* 忽略：节点已失效（渲染替换）——修正跳过 */ } }
    }

    function _sweepDictFixes(fixes) {
      if (!fixes?.length) return;
      const uniq = _sweepDedupe(fixes);
      // 防御上限：正常维护场景远小于此；超出时截断并告警（收敛供应链滥用面）
      if (uniq.length > 500) { try { console.warn('词典修正集超出 500 条上限，已截断'); } catch (e) { /* 忽略：日志输出失败不影响截断 */ } uniq.length = 500; }
      if (!uniq.length || !document.body) return;
      const skipTags = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1 };
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentElement && skipTags[n.parentElement.tagName]) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
      });
      const batch = [];
      while (walk.nextNode()) batch.push(walk.currentNode);
      for (const n of batch) _sweepNode(n, uniq);
    }

    /* ── 词典对外接口（v1.4 Phase 5）：六层词表访问 + 修订号 + 派生缓存失效 ──
       get/has 为翻译器与后续模块的统一查询面（当前翻译器保持既有直查路径；
       接口契约由测试冻结）；update = dict.json 文本原地合并；invalidate = 清词典派生缓存。 */
    let _dictRevision = 0; // NOSONAR — 词典修订号随运行时词典更新
    // 七层词表引用（common 为公共层；applyRuntimeDict 对 6 站层单独合并）
    const DICT_LAYERS = { common: DICT_COMMON, main: DICT, ec: DICT_EC, fc: DICT_FC, ronka: DICT_RONKA, acl: DICT_ACL, endcloset: DICT_ENDCLOSET };
    function dictGet(key, layer) { const o = DICT_LAYERS[layer || 'main']; return (o && Object.hasOwn(o, key)) ? o[key] : undefined; }   // NOSONAR —— 接口层：tests/unit 经 dist 区段装配调用（冻结契约）；生产路径暂不直呼
    function dictHas(key, layer) { const o = DICT_LAYERS[layer || 'main']; return !!o && Object.hasOwn(o, key); }   // NOSONAR —— 接口层：tests/unit 经 dist 区段装配调用（冻结契约）；生产路径暂不直呼
    function dictGetRevision() { return _dictRevision; }
    function dictInvalidate() { cacheReset('translate'); }
    function dictUpdate(txt) { return applyRuntimeDict(txt); }   // NOSONAR —— 接口层：tests/unit 经 dist 区段装配调用（冻结契约）；生产路径暂不直呼
    /* @zhixia:core-dictionary-end */

  /* @phase15-module-order:sites/eorzea-collection */
  /* @phase15-order-link:sites/eorzea-collection<-core/dictionary */


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
      [/^Page\s+(\d+)\s+of\s+([\d,]+)$/i, '第 $1 页 / 共 $2 页'],
      [/^Go to Page\s+(\d+)$/i, '前往第 $1 页'],
      [/^Go to slide\s+(\d+)$/i, '切换到第 $1 张'],
      [/^Browse All\s+(.{1,80})$/i, (m, name) => DICT_EC[name] ? '浏览全部' + DICT_EC[name] : m],
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


    // EC /gearsets 标题不是单件物品：按系列 + 职能合成，不能交给 resolveByName
    // 的装备卡片链（否则找不到译名，还可能将套装链接改写到灰机物品页）。
    // 系列译名取自 dict-ec.json，只有经确认的系列参与转换，未知名称保留英文。
    // Gearsets 的英文标题不是单件物品名。只收录在 EC Gearsets 页面确认存在、
    // 且译名可由国服物品表核验的系列；未知套装仍保留英文，避免猜译。
    // 为避免把不存在的角色套装列为搜索候选，每个系列单独声明实际职能。
    const EC_GEARSET_ROLES = ['Fending', 'Maiming', 'Striking', 'Scouting', 'Aiming', 'Casting', 'Healing'];
    const EC_GEARSET_ROLE_SERIES = [
      ['Phantom Vision', EC_GEARSET_ROLES],
      ["Vana'dielian", EC_GEARSET_ROLES],
      ['Praemagitek', EC_GEARSET_ROLES],
      ['Mistwake', EC_GEARSET_ROLES],
      ['Mistic Memory', EC_GEARSET_ROLES],
      ["War Cloud's", ['Fending', 'Maiming']],
      ["Prishe's", ['Striking']],
      ['Mayakov', ['Scouting', 'Aiming']],
      ['Orastery', ['Casting', 'Healing']],
    ];
    const EC_GEARSET_SINGLE_SERIES = new Set([
      "Beastmaster's", "Beast Herder's", "Successor's", 'Yozakura', "Zero's Luminary",
      'Tule', 'Torna', 'Carwen', 'Tradewinds', "Neo Citizen's",
      'Plain Hooded', 'Festival Hooded', 'Succubus Hooded', 'Oversized Plain Hooded',
      'Graffiti Neotunic',
      "Fallen's", "En Fortune-teller's", "Realm-roamer's", "Vibran Princess's",
      'Galatea', 'Fuath', 'Hope [F]', 'Hope [M]', "Gaffgarion's", "Ovelia's",
      "Ramza's", 'Star Captain', 'Star Pilot', 'Alternative', 'Maritime',
      'Alpha Wolf', 'Eagleclaw', 'Star Tech Crafting', 'Star Tech Gathering',
    ]);
    // 这些译名核对自 data/ff14-items.tsv（装备前缀或对应的 Attire/Armor 套装物品）。
    // 仅用于 EC Gearsets 标题，不混入单件装备译名与通用 UI 词典。
    const EC_GEARSET_NAME_EXTRAS = Object.freeze({
      'Graffiti Neotunic': '涂鸦新式上衣套装',
      'Mistwake': '雾迹',
      'Mistic Memory': '雾忆',
      "War Cloud's": '沃·克劳德',
      "Prishe's": '普利修',
      'Mayakov': '马雅科夫',
      'Orastery': '口之院',
      "Fallen's": '堕落套装',
      "En Fortune-teller's": '恩城预言师套装',
      "Realm-roamer's": '维度漫游者套装',
      "Vibran Princess's": '威布拉公主套装',
      'Galatea': '伽拉忒亚装备套装',
      'Fuath': '水妖装束',
      'Hope [F]': '希望套装【女】',
      'Hope [M]': '希望套装【男】',
      "Gaffgarion's": '加夫加利昂装备套装',
      "Ovelia's": '奥薇莉亚装备套装',
      "Ramza's": '拉姆萨装备套装',
      'Star Captain': '宇宙舰长套装',
      'Star Pilot': '宇宙驾驶员套装',
      'Alternative': '另类装备套装',
      'Maritime': '滨海套装',
      'Alpha Wolf': '头狼套装',
      'Eagleclaw': '雕爪套装',
      'Star Tech Crafting': '星际科技巧匠套装',
      'Star Tech Gathering': '星际科技大地套装',
    });
    // 分类后缀仅用于解析卡片同节点文本；不允许把来源名误识别为套装名。
    const EC_GEARSET_SOURCES = [
      'Battle Content Gear', 'Other Content Gear', 'Grand Company Gear',
      'Seasonal Event Gear', 'Job Artifact Armor', 'Tomestones Exchange',
      'Scrips Exchange', 'Achievement Reward', 'Gold Saucer Prize',
      'Crafted Glamour', 'Crafted Sets', 'Dungeon Drop', 'Trial Drop',
      'Raid Gear', 'Token Exchange', 'Quest Reward', 'Mogstation Set',
      'Promotional Set', 'PVP Gear', 'Bought in Shop',
    ];

    function ecGearsetSeriesZh(en) {
      return EC_GEARSET_NAME_EXTRAS[en] || DICT_EC[en] || null;
    }

    // EC Gearsets uses "Crafting/Gathering" as equipment roles; ordinary UI
    // translation "Crafting → 制作" is not an official equipment-name suffix.
    const EC_GEARSET_ITEM_ROLES = /^(.*?) of (Fending|Maiming|Striking|Scouting|Aiming|Casting|Healing|Crafting|Gathering)$/;
    const EC_GEARSET_TITLE_ROLES = /^(.*?) (Fending|Maiming|Striking|Scouting|Aiming|Casting|Healing|Crafting|Gathering)$/;
    const EC_GEARSET_NONCOMBAT_ROLE_ZH = Object.freeze({ Crafting: '巧匠', Gathering: '大地' });
    function ecGearsetRoleZh(role) {
      return EC_GEARSET_NONCOMBAT_ROLE_ZH[role] || DICT_EC[role] || null;
    }

    // 自动推导仅使用 V3 已有的官方英中装备映射，不维护逐套名单：
    // 如 3 件 Ceremonial ... of Scouting 同时映射至「仪仗游击...」，
    // 则推断 Ceremonial Scouting → 仪仗游击套装。
    // 依赖“多件独立装备 + 共同中文前缀 + 与英文职能一致”三重校验；
    // 达不到阈值时保留原英文，防止猜造非官方的套装名称。
    function ecGearsetCommonZhPrefix(names) {
      if (names.length < 3) return '';
      let prefix = names[0];
      for (const name of names.slice(1)) {
        while (prefix && !name.startsWith(prefix)) prefix = prefix.slice(0, -1);
        if (!prefix) break;
      }
      return prefix;
    }

    function ecGearsetAddInferredGroups(grouped, native, zh, englishPart, role) {
      const words = englishPart.split(' ');
      for (let n = 1; n < words.length && n <= 4; n++) {
        const title = words.slice(0, n).join(' ') + ' ' + role;
        if (!grouped.has(title)) grouped.set(title, new Map());
        grouped.get(title).set(native, zh);
      }
    }

    function ecGearsetInferredRow(native, items) {
      if (items.size < 3) return null;
      const names = [...new Set(items.values())];
      if (names.length < 3) return null;
      const prefix = ecGearsetCommonZhPrefix(names);
      const role = native.slice(native.lastIndexOf(' ') + 1);
      const roleZh = ecGearsetRoleZh(role);
      if (!roleZh || prefix.length < roleZh.length + 2 || !prefix.endsWith(roleZh)
          || prefix.length > 22) return null;
      return { native, zh: prefix + '套装' };
    }

    function inferECGearsetsFromItems(nameIndex) {
      const grouped = new Map();
      for (const [native, zh] of Object.entries(nameIndex || {})) {
        const hit = EC_GEARSET_ITEM_ROLES.exec(native);
        if (!hit || !/^[\u3400-\u9fff]/u.test(zh)) continue;
        const roleZh = ecGearsetRoleZh(hit[2]);
        if (!roleZh || !zh.includes(roleZh)) continue;
        ecGearsetAddInferredGroups(grouped, native, zh, hit[1], hit[2]);
      }
      const derived = [];
      for (const [native, items] of grouped) {
        const row = ecGearsetInferredRow(native, items);
        if (row) derived.push(row);
      }
      return derived;
    }

    // Game outfit packages use "Attire (Variant)" while EC shows "(Variant)"
    // with the package type removed. Two distinct officially named variants of
    // the same series give strong evidence for a shared native series search.
    // Suggestions are site searches, never invented direct /gearset links.
    function ecGearsetOfficialVariantRows(nameIndex) {
      const grouped = new Map();
      const pattern = /^(.+?) (?:Attire|Armor|Set|Outfit) (\([^()]{1,60}\)|\[[^\]]{1,40}\])$/;
      for (const [item, zh] of Object.entries(nameIndex || {})) {
        const match = pattern.exec(item);
        if (!match || !/[\u3400-\u9fff]/u.test(zh)
            || !/(?:套装|装束)$/u.test(zh)) continue;
        const native = match[1] + ' ' + match[2];
        if (!grouped.has(match[1])) grouped.set(match[1], new Map());
        grouped.get(match[1]).set(native, zh);
      }
      const rows = [];
      for (const variants of grouped.values()) {
        if (variants.size < 2) continue;
        for (const [native, zh] of variants) rows.push({ native, zh });
      }
      return rows;
    }

    // Official game outfit packages also cover standalone and single-variant
    // sets. They do NOT prove the corresponding EC Gearset page exists, so rows
    // from this broad catalogue are provisional search suggestions only.
    // Never invent or navigate to a /gearset/<slug> link from these entries.
    function ecGearsetOfficialOutfitRows(nameIndex) {
      const rows = [];
      const pattern = /^(.+?) (?:Attire|Armor)(?: (\([^()]{1,60}\)|\[[^\]]{1,40}\]))?$/;
      for (const [item, zh] of Object.entries(nameIndex || {})) {
        const match = pattern.exec(item);
        if (!match || !/[\u3400-\u9fff]/u.test(zh)
            || !/(?:套装|装束)$/u.test(zh)) continue;
        const native = match[1] + (match[2] ? ' ' + match[2] : '');
        rows.push({ native, zh, provisional: true });
      }
      return rows;
    }

    function ecGearsetKnownRows() {
      const rows = [];
      for (const [series, roles] of EC_GEARSET_ROLE_SERIES) {
        const zhSeries = ecGearsetSeriesZh(series);
        if (!zhSeries) continue;
        for (const role of roles) {
          const zhRole = DICT_EC[role];
          if (zhRole) rows.push({ native: series + ' ' + role, zh: zhSeries + zhRole + '套装' });
        }
      }
      for (const native of EC_GEARSET_SINGLE_SERIES) {
        const zh = ecGearsetSeriesZh(native);
        if (zh) rows.push({ native, zh });
      }
      return rows;
    }

    function ecGearsetAppendInferredRows(rows, nameIndex) {
      if (!nameIndex) return;
      const seen = new Set(rows.map(row => row.native));
      const derived = [
        ...inferECGearsetsFromItems(nameIndex),
        ...ecGearsetOfficialVariantRows(nameIndex),
        ...ecGearsetOfficialOutfitRows(nameIndex),
      ];
      for (const row of derived) {
        if (seen.has(row.native)) continue;
        rows.push(row);
        seen.add(row.native);
      }
    }

    // DOM 观察器可能频繁重扫，按词典修订号缓存，不在每次处理卡片时重建目录。
    let _ecGearsetRows = null;
    let _ecGearsetHadItemIndex = false;
    let _ecGearsetRevision = -1;
    function ecGearsetCatalog() {
      const revision = dictGetRevision();
      const nameIndex = dataGetIndex('nameMap');
      const hasItems = !!nameIndex;
      if (_ecGearsetRows && _ecGearsetRevision === revision && _ecGearsetHadItemIndex === hasItems) {
        return _ecGearsetRows;
      }
      const rows = ecGearsetKnownRows();
      ecGearsetAppendInferredRows(rows, nameIndex);
      _ecGearsetRows = rows;
      _ecGearsetRevision = revision;
      _ecGearsetHadItemIndex = hasItems;
      return rows;
    }

    function ecGearsetDescriptiveName(native) {
      // 站点的 Hempen <种族> <性别> 是服装搭配组合而非单条官方物品名。
      // 仅当页面确实出现该英文标题时，用固定语法生成【描述性】译名；
      // 不为未见过的种族变体创建搜索候选，也不宣称它是国服官方套装名。
      const match = /^Hempen (Au Ra|Hyur|Elezen|Miqo'te|Lalafell|Roegadyn|Viera|Hrothgar|Auri|Midlander|Highlander|Lalafellin) (Male|Female)$/.exec(native);
      if (!match) return null;
      const raceAliases = { Auri: 'Au Ra', Lalafellin: 'Lalafell' };
      const race = DICT_EC[raceAliases[match[1]] || match[1]];
      const gender = DICT_EC[match[2]];
      return race && gender ? race + gender + '贴身衣套装' : null;
    }

    // EC drops the item-type word from many official outfit items:
    // "Wintertide Attire (Culottes)" -> displayed "Wintertide (Culottes)".
    // Keep the parenthesized / bracketed variant exactly; the variant distinguishes
    // genuinely different official sets such as Culottes vs Sheath Skirt.
    // Only a real official item with an outfit-style Chinese name is accepted.
    function ecGearsetOfficialPackageZh(native, nameIndex) {
      if (!nameIndex) return null;
      const match = /^(.+?) (\([^)]{1,60}\)|\[[^\]]{1,40}\])$/.exec(native);
      const base = match ? match[1] : native;
      const variant = match ? ' ' + match[2] : '';
      for (const type of [' Attire', ' Armor', ' Set', ' Outfit']) {
        const official = nameIndex[base + type + variant];
        if (official && /(?:套装|装束)$/u.test(official)) return official;
      }
      return null;
    }

    // A visible EC title is evidence that the set exists; official package
    // lookups can translate it without adding speculative search suggestions.
    function ecGearsetObservedTitleZh(native) {
      const exact = DICT_EC[native];
      if (exact && /[\u3400-\u9fff]/u.test(exact)) return exact;
      const parts = EC_GEARSET_TITLE_ROLES.exec(native);
      if (parts) {
        const series = DICT_EC[parts[1]];
        const role = ecGearsetRoleZh(parts[2]);
        if (series && role && /[\u3400-\u9fff]/u.test(series)
            && !/(?:套装|装束)$/u.test(series)) return series + role + '套装';
      }
      const nameIndex = dataGetIndex('nameMap');
      const official = ecGearsetOfficialPackageZh(native, nameIndex);
      if (official) return official;
      // Some EC titles add possessive 's (Royal Seneschal's) while the
      // official game package omits it (Royal Seneschal Attire).
      if (native.endsWith("'s")) {
        const withoutPossessive = ecGearsetOfficialPackageZh(native.slice(0, -2), nameIndex);
        if (withoutPossessive) return withoutPossessive;
      }
      // The site may elide "Far" (Eastern Socialite's vs Far Eastern
      // Socialite's); only apply this to an already observed Gearsets title.
      if (native.startsWith('Eastern ')) {
        return ecGearsetOfficialPackageZh('Far ' + native, nameIndex);
      }
      return null;
    }

    function ecGearsetDisplayName(raw) {
      const text = String(raw || '').trim();
      if (!text || text.length > 110) return null;
      const source = EC_GEARSET_SOURCES.find(s => text.endsWith(' ' + s));
      const title = source ? text.slice(0, -(source.length + 1)) : text;
      const bare = title.endsWith(' Set') ? title.slice(0, -4) : title;
      const row = ecGearsetCatalog().find(r => r.native === bare);
      const zh = row?.zh || ecGearsetDescriptiveName(bare) || ecGearsetObservedTitleZh(bare);
      if (!zh) return null;
      const suffix = source ? ' ' + (DICT_EC[source] || source) : '';
      return zh + suffix;
    }

    // EC /accessories is a *series* catalogue, separate from /gearsets.
    // Its titles omit the slot and often omit "Accessories" on the cards.
    // Infer a shared game-localized series prefix from independent earrings,
    // neckpieces, bracelets and rings rather than hardcoding every new release.
    // Parse native names using strict slot classification rather than a single
    // highly complex alternation regex (Sonar S5843). Unsupported roles are
    // rejected before item names can contribute to a translated series.
    const EC_ACCESSORY_ROLE_SUFFIXES = new Set([
      'Fending', 'Maiming', 'Striking', 'Scouting', 'Aiming', 'Casting',
      'Healing', 'Slaying', 'Crafting', 'Gathering', 'Blood', 'Magic',
    ]);
    // Only strip prefixes confirmed by the game's localized stat-specific names.
    const EC_ACCESSORY_STAT_PREFIX = Object.freeze({ Blood: '力之', Magic: '魔之' });

    // Multiple earring forms count as ONE real slot, not separate accessories.
    function ecAccessoryItemSlot(part) {
      if (/^(?:Earrings?|Ear Cuffs?|Ear Clips?)$/.test(part)) return 'ears';
      if (/^(?:Necklaces?|Chokers?|Collars?|Neckbands?|Necklets?)$/.test(part)) return 'neck';
      if (/^(?:Bracelets?|Wristlets?|Wristbands?|Armillae|Bangles?)$/.test(part)) return 'wrists';
      if (/^Rings?$/.test(part)) return 'rings';
      return null;
    }

    // EC sometimes reverses the order: "Ring of the Sea-folk".
    function ecAccessoryItemDescriptor(native) {
      const pivot = native.indexOf(' of the ');
      if (pivot >= 0) {
        const slot = ecAccessoryItemSlot(native.slice(0, pivot));
        const series = native.slice(pivot + ' of the '.length);
        return slot && series.length >= 2 && series.length <= 80 ? { series, slot } : null;
      }
      const role = / of ([A-Za-z]+)$/.exec(native);
      if (role && !EC_ACCESSORY_ROLE_SUFFIXES.has(role[1])) return null;
      const bare = role ? native.slice(0, -role[0].length) : native;
      const words = bare.split(' ');
      const twoWordPart = words.slice(-2).join(' ');
      const part = ecAccessoryItemSlot(twoWordPart) ? twoWordPart : words.at(-1);
      const slot = ecAccessoryItemSlot(part);
      const series = bare.slice(0, -(part.length + 1));
      if (!slot || !series) return null;
      return { series, slot, stat: role?.[1] };
    }

    function ecAccessoryGroupEntry(groups, native, zh) {
      if (!/^[\u3400-\u9fff]/u.test(zh)) return;
      const item = ecAccessoryItemDescriptor(native);
      if (!item) return;
      const statPrefix = EC_ACCESSORY_STAT_PREFIX[item.stat];
      // "Occult Earrings of Blood" -> "力之新月魔耳饰":
      // only remove the stat label after it matches the official Chinese name.
      if (statPrefix && !zh.startsWith(statPrefix)) return;
      const localized = statPrefix ? zh.slice(statPrefix.length) : zh;
      let entries = groups.get(item.series);
      if (!entries) { entries = new Map(); groups.set(item.series, entries); }
      entries.set(native, { zh: localized, slot: item.slot });
    }

    function ecAccessoryGroupRow(native, entries) {
      if (entries.size < 3 || new Set([...entries.values()].map(x => x.slot)).size < 2) return null;
      const names = [...new Set([...entries.values()].map(x => x.zh))];
      const prefix = ecGearsetCommonZhPrefix(names);
      const roleEndings = ['御敌', '制敌', '强袭', '强攻', '游击', '精准', '咏咒', '治愈', '巧匠', '大地'];
      const role = roleEndings.find(x => prefix.endsWith(x));
      const base = role ? prefix.slice(0, -role.length) : prefix;
      if (base.length < 2 || base.length > 18 || /(?:套装|装束)$/u.test(base)) return null;
      return { native, zh: base };
    }

    function inferECAccessorySeriesFromItems(nameIndex) {
      const groups = new Map();
      for (const [native, zh] of Object.entries(nameIndex || {})) {
        ecAccessoryGroupEntry(groups, native, zh);
      }
      return [...groups].map(([native, entries]) => ecAccessoryGroupRow(native, entries))
        .filter(Boolean);
    }

    // Rare EC variant catalogues have only one physical slot but two independent
    // officially translated stat versions. Translate an OBSERVED title only when
    // both names demonstrate the same localized series stem. This produces a
    // descriptive display label, never a new speculative accessory link.
    function ecAccessoryDeepStatSeriesZh(native, nameIndex) {
      if (!nameIndex || !native.endsWith(' Deep')) return null;
      const base = native.slice(0, -5);
      const blood = /^超力之([\u3400-\u9fff]{2,18})戒指$/u.exec(nameIndex[base + ' Ring of Deep Blood'] || '');
      const magic = /^超魔之([\u3400-\u9fff]{2,18})戒指$/u.exec(nameIndex[base + ' Ring of Deep Magic'] || '');
      return blood?.[1] && blood[1] === magic?.[1] ? '超' + blood[1] : null;
    }

    let _ecAccessoryRows = null;
    let _ecAccessoryRevision = -1;
    let _ecAccessoryHasData = false;
    function ecAccessorySeriesZh(native) {
      // DICT_EC also contains UI labels like "Other" and "Browse All"; they
      // must never be mistaken for verified accessory series names.
      const verified = EC_GEARSET_SINGLE_SERIES.has(native)
        || EC_GEARSET_ROLE_SERIES.some(([series]) => series === native);
      const known = verified ? ecGearsetSeriesZh(native) : null;
      if (known && /[\u3400-\u9fff]/u.test(known)) {
        return known.replace(/(?:装备)?(?:套装|装束)$/u, '') || known;
      }
      const revision = dictGetRevision();
      const nameIndex = dataGetIndex('nameMap');
      const hasData = !!nameIndex;
      if (!_ecAccessoryRows || revision !== _ecAccessoryRevision || hasData !== _ecAccessoryHasData) {
        _ecAccessoryRows = new Map(inferECAccessorySeriesFromItems(nameIndex)
          .map(row => [row.native, row.zh]));
        _ecAccessoryRevision = revision;
        _ecAccessoryHasData = hasData;
      }
      return _ecAccessoryRows.get(native) || ecAccessoryDeepStatSeriesZh(native, nameIndex);
    }

    function ecAccessoryDisplayName(raw) {
      const text = String(raw || '').trim();
      if (!text || text.length > 110) return null;
      const source = EC_GEARSET_SOURCES.find(value => text.endsWith(' ' + value));
      const title = source ? text.slice(0, -source.length - 1) : text;
      const native = title.endsWith(' Accessories') ? title.slice(0, -12) : title;
      const series = ecAccessorySeriesZh(native);
      if (!series) return null;
      return series + '饰品' + (source ? ' ' + (DICT_EC[source] || source) : '');
    }

    // 经 EC Gearsets 页面/套装详情页核验的搜索别名，不把单件装备译名
    // 冒充套装标题。特别是「东方」对应多个套装，用英文公共关键词
    // Eastern 搜索，不能随机选择一套或把它当成单一套装的正式译名。
    const EC_GEARSET_SEARCH_ALIASES = Object.freeze([
      { native: "Loyal Housemaid's", zh: '女仆套装', terms: ['女仆', '女僕', '女佣', '女傭'] },
      { native: "Beastmaster's", zh: '兽王（兽主）套装', terms: ['兽王', '獸王'] },
      { native: 'Eastern', zh: '东方系列套装（全部）', terms: ['东方', '東方'] },
    ]);

    function ecGearsetNormalizedZh(raw) {
      return String(raw || '').normalize('NFKC')
        .replace(/[\s·・.,，、'’"（）()[\]【】_-]/gu, '').toLowerCase();
    }

    function ecGearsetMatchesZh(query) {
      const key = ecGearsetNormalizedZh(query);
      if (key.length < 2 || !/[\u3400-\u9fff]/u.test(key)) return [];
      const matching = ecGearsetCatalog().filter(row => ecGearsetNormalizedZh(row.zh).includes(key));
      // Stronger evidence always wins over provisional official game packages;
      // include alias matches before choosing the fallback candidate tier.
      const rows = matching.filter(row => !row.provisional);
      // 已核实的 EC 英文套装名/公共关键词，兼容用户实际输入的俗称与简繁体。
      // 去重使用英文原生名，避免常见别名与现有国服译名重复展示。
      for (const alias of EC_GEARSET_SEARCH_ALIASES) {
        const matches = [alias.zh, ...alias.terms]
          .some(term => ecGearsetNormalizedZh(term).includes(key));
        if (matches && !rows.some(row => row.native === alias.native)) {
          rows.push({ native: alias.native, zh: alias.zh });
        }
      }
      return rows.length ? rows : matching.filter(row => row.provisional);
    }

    // 搜索实际发送的是英文子串：一个中文词若对应多个套装，应寻找所有
    // 英文标题共同的「完整词序列」，而不是随机选一个套装或拼接单词碎片。
    function ecGearsetCommonNative(rows) {
      if (!rows.length) return null;
      if (rows.length === 1) return rows[0].native;
      const tokens = rows[0].native.split(' ');
      let best = '';
      for (let len = tokens.length; len >= 1; len--) {
        for (let i = 0; i + len <= tokens.length; i++) {
          const candidate = tokens.slice(i, i + len).join(' ');
          const isCommon = rows.every(row => (' ' + row.native + ' ').includes(' ' + candidate + ' '));
          if (isCommon && candidate.length > best.length) best = candidate;
        }
      }
      return best || null;
    }

    function resolveECGearsetSearch(query) {
      return ecGearsetCommonNative(ecGearsetMatchesZh(query));
    }

    function suggestECGearsetsByZh(query) {
      return ecGearsetMatchesZh(query);
    }

    function ecGearsetApplyTitleSuffix(node, raw, title, zh, suffix, hasInlineSuffix, suffixNodes) {
      const splitSuffix = zh.endsWith(suffix) && !hasInlineSuffix;
      node.nodeValue = raw.replace(title, splitSuffix ? zh.slice(0, -suffix.length) : zh);
      // Split H1 labels must contribute the suffix exactly once, including when
      // the title also contains an acquisition source (e.g. Dungeon Drop).
      const redundant = hasInlineSuffix || zh.endsWith('装束') || zh.includes(suffix + ' ');
      if (redundant) for (const trailing of suffixNodes) trailing.nodeValue = '';
    }

    function ecGearsetTranslateTitleNode(node, suffixNodes, type) {
      const raw = node.nodeValue || '';
      const zh = type === 'accessories' ? ecAccessoryDisplayName(raw) : ecGearsetDisplayName(raw);
      if (!zh) return;
      const title = raw.trim();
      const suffix = type === 'accessories' ? '饰品' : '套装';
      const hasInlineSuffix = type === 'accessories'
        ? title.endsWith(' Accessories') : title.endsWith(' Set');
      if (suffixNodes.length) {
        ecGearsetApplyTitleSuffix(node, raw, title, zh, suffix, hasInlineSuffix, suffixNodes);
      } else {
        node.nodeValue = raw.replace(title, zh);
      }
    }

    function ecGearsetTranslateTitleRoot(root, type = 'gearset') {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      const suffixPattern = type === 'accessories' ? /^(?:Accessories|饰品)$/iu : /^(?:Set|套装)$/iu;
      const suffixNodes = nodes.filter(n => suffixPattern.test((n.nodeValue || '').trim()));
      for (const node of nodes) {
        if (!suffixNodes.includes(node)) ecGearsetTranslateTitleNode(node, suffixNodes, type);
      }
      // Preserve separate nested suffix styling and idempotence on repeated scans.
      if (root.tagName === 'H1') {
        const en = type === 'accessories' ? 'Accessories' : 'Set';
        const zh = type === 'accessories' ? '饰品' : '套装';
        for (const trailing of suffixNodes) {
          if (trailing.nodeValue?.trim() === en) trailing.nodeValue = trailing.nodeValue.replace(en, zh);
        }
      }
    }

    function ecGearsetTitleRoots(scope, selector) {
      const found = queryIn(scope, selector);
      // MutationObserver may provide only a nested span, not its containing h1/a.
      const parent = scope?.closest?.(selector);
      if (parent && !found.includes(parent)) found.unshift(parent);
      return found;
    }

    // Gearset link href is never touched; only the verified title text is changed.
    function translateECGearsetNames(rootArg) {
      const scope = localScope(rootArg);
      for (const a of ecGearsetTitleRoots(scope, 'a[href*="/gearset/"]')) ecGearsetTranslateTitleRoot(a);
      for (const a of ecGearsetTitleRoots(scope, 'a[href*="/accessories/"]')) {
        ecGearsetTranslateTitleRoot(a, 'accessories');
      }
      const path = globalThis.location?.pathname || '';
      if (/^\/gearset\/[^/]+\/?$/.test(path)) {
        for (const h1 of ecGearsetTitleRoots(scope, 'h1')) ecGearsetTranslateTitleRoot(h1);
      } else if (/^\/accessories\/[^/]+\/?$/.test(path)) {
        for (const h1 of ecGearsetTitleRoots(scope, 'h1')) ecGearsetTranslateTitleRoot(h1, 'accessories');
      }
    }

    // 用户产出的内容：绝不翻译
    const EC_SKIP_SEL$1 = [
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
      if (p?.closest?.(EC_SKIP_SEL$1)) return;
      // 装备名 / 卡片文本归物品链（zhApply*）处理：文本链避让，否则文本被抢先翻成
      // 中文后物品链会因「原文不再匹配」跳过，导致链接改写 / 包装 / 标记不生效
      if (p?.closest?.(EC_ITEM_SKIP_SEL)) return;
      // Gearset H1 has split name/Set nodes: generic trEC would append 套装 to
      // known series BEFORE the dedicated structure-aware pass can inspect it.
      // Only the Gearsets title translator is allowed to touch this H1.
      if (/^\/(?:gearset|accessories)\/[^/]+\/?$/.test(globalThis.location?.pathname || '')
          && p?.closest?.('h1')) return;
      const next = trEC(raw);
      if (next !== raw) {
        // Keep the original for diagnostics, not as an untranslated English hover tooltip.
        if (p?.dataset && !p.hasAttribute?.('title')) p.dataset.zhixiaSourceText = raw.trim();
        node.nodeValue = next;
      }
    }

    let ecBusy = false; // NOSONAR — 页面扫描期间的重入保护状态

    // Site hydration updates tooltips and accessibility labels after the initial scan.
    // Translate each current attribute value: sticky 'done' flags hide later updates.
    function _translateECAttr(el, attr) {
      if (el.closest?.(EC_SKIP_SEL$1)) return;
      if (attr === 'title' && _zhixiaTitleKeep.has(el)) return;
      const old = el.getAttribute(attr);
      if (!old || old.length > 90) return;
      const translated = trEC(old);
      if (translated !== old) el.setAttribute(attr, translated);
    }

    function translateECAttrs(rootArg) {
      const scope = localScope(rootArg);
      for (const attr of ['title', 'alt', 'aria-label', 'placeholder']) {
        for (const el of queryIn(scope, '[' + attr + ']')) _translateECAttr(el, attr);
      }
    }

    // Translate only recognized UI title segments. Preserve creator names and site branding.
    function translateECTitle() {
      const old = document.title;
      if (!old?.includes(' | Eorzea Collection')) return;
      const parts = old.split(' | ');
      const translated = parts.map((part) => ecAccessoryDisplayName(part) || ecGearsetDisplayName(part)
        || DICT_EC[part] || (part.startsWith('Latest Patch') ? trEC(part) : part)).join(' | ');
      if (translated !== old) document.title = translated;
    }

    function translateECPage(rootArg) {
      if (ecBusy) return;
      ecBusy = true;
      try {
        const root = rootArg || document.body || document.documentElement;
        if (!root) return;
        _markScan(localScope(rootArg));   // v1.4.1：扫描计数（区分全页/局部）
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
          acceptNode: (n) => {
            if (n.nodeType === 1) {
              if (SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
              // 选择器级剪枝：忽略区域整棵子树不再进入（v1.11.1，借 github-chinese FILTER_REJECT）
              if (n.closest?.(EC_SKIP_SEL$1)) return NodeFilter.FILTER_REJECT;
              // 同 trimECNode：物品链管辖的子树（装备名 / 卡片）不在文本链处理
              if (n.closest?.(EC_ITEM_SKIP_SEL)) return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        });
        const batch = [];
        while (w.nextNode()) batch.push(w.currentNode);
        translateECGearsetNames(rootArg);
        for (const n of batch) {
          if (n.nodeType === 3) trimECNode(n);
        }
        translateECAttrs(rootArg);
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
    function bindECPieceTiles(rootArg) {
      let changed = false;
      queryIn(localScope(rootArg), 'a > img[src*="/pages/header/banner-"]').forEach((img) => {
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
      safe(translateECTitle, 'EC 页面标题')();
      safe(bindECPieceTiles, 'EC 部位图')();
      createObserver({
        root: document.documentElement,
        debounce: 300,
        attributes: true,
        attributeFilter: ['title', 'alt', 'aria-label', 'placeholder'],
        handler: (nodes) => {
          for (const n of nodes) {
            safe(translateECPage, 'EC 局部')(n);
            safe(bindECPieceTiles, 'EC 部位图')(n);
          }
          safe(translateECTitle, 'EC 页面标题')();
        },
      });
      // 数据就绪补扫由 Site Adapter 统一登记（见 SITE_REGISTRY 的 onDataReady）
    }

  /* @phase15-module-order:core/dom */
  /* @phase15-order-link:core/dom<-sites/eorzea-collection */


    // 属性翻译：EC 部分导航/图标的文字在 alt / aria-label / title 属性里，
    // 文本节点遍历够不到，这里补齐。（被汉化标记过 title 的元素的 title 不动）
    const _zhixiaTitleKeep = new WeakSet();

    /* @zhixia:core-dom-start */
    /* ── Core DOM（v1.4 Phase 4）：DOM 节点批量处理工具——祖先去重
         （dedupeByAncestor；v1.4 Phase 7 升级为 O(n·depth)）。Phase 15 模块化
         构建时，本区段将原样抽出为 src/core/dom.js。 */
    // 祖先去重（v1.4 Phase 7 升级：原 O(n²) contains 扫描 → O(n·depth) 祖先链查询）：
    // ① 完全去重：同一节点重复入队只保留一次；
    // ② 父子不同队：凡「祖先也在本批次」的节点一律跳过（只处理最上层祖先——其处理范围覆盖后代）。
    function dedupeByAncestor(nodes) {
      const uniq = (nodes.length > 1) ? [...new Set(nodes)] : nodes;
      const elems = new Set();
      for (const n of uniq) if (n.nodeType === 1) elems.add(n);
      if (!elems.size) return uniq;
      // 祖先链查询拆为局部函数（仅降复杂度；语义不变）
      const covered = (n) => {
        let p = n.parentNode;
        while (p) {
          if (elems.has(p)) return true;
          p = p.parentNode;
        }
        return false;
      };
      const out = [];
      for (const n of uniq) {
        if (n.nodeType === 1 && covered(n)) continue;
        out.push(n);
      }
      return out;
    }

    /* ── 局部扫描工具与计数（v1.4.1 Mobile Perf）──
       queryIn / localScope：把「局部回调里的全页扫描」收口为「只扫变化子树」的统一入口；
       _scanStats：Probe 读取的扫描计数（global=整文档级扫描、local=局部子树扫描）。 */
    const _scanStats = { global: 0, local: 0 };

    // 局部根解析：元素 → 自身；文本节点 → 父元素；缺省（全页调用）→ null。
    const localScope = (rootArg) => {
      if (rootArg == null) return null;
      if (rootArg.nodeType === 1) return rootArg;
      return rootArg.parentElement || null;
    };

    // 扫描计数：scopeEl 非空记 local，否则记 global。
    const _markScan = (scopeEl) => { if (scopeEl) _scanStats.local++; else _scanStats.global++; };

    // 统一查询：scopeEl 缺省 → 全页 document；元素 → 自身（若命中；querySelectorAll 不含自身）+ 子树。
    function queryIn(scopeEl, sel) {
      const out = [];
      if (scopeEl) {
        if (scopeEl.matches?.(sel)) out.push(scopeEl);
        scopeEl.querySelectorAll(sel).forEach((el) => out.push(el));
      } else {
        document.querySelectorAll(sel).forEach((el) => out.push(el));
      }
      _markScan(scopeEl);
      return out;
    }

    /* @zhixia:core-dom-end */

  /* @phase15-module-order:sites/mirapri */
  /* @phase15-order-link:sites/mirapri<-core/dom */


    // 部分匹配（长句、带变量文本、placeholder）
    const PATTERNS = [
      [/ユーザーの皆さまにMIRAPRI SNAPを快適にご利用いただくため、/g, '为了让各位用户更舒适地使用 MIRAPRI SNAP，'],
      [/」をご一読いただき、お守りいただきますよう、ご協力をお願いいたします。/g, '」，并请遵守其中的规定。'],
      [/装備品名等を入力/g, '输入装备名等'],
      [/少ない文字で検索するとちょっと時間がかかります/g, '输入较短时检索会稍慢'],
      [/記載されている会社名・製品名・システム名などは、各社の商標、または登録商標です。?/g,
        '文中记载的公司名、产品名、系统名等，均为各公司之商标或注册商标。'],
      [/全身を切り取る/g, '裁切全身'],
      [/Loading\.\.\./g, '加载中…'],
      [/^\s*＊\s*/, '＊'],
    ];

    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);
    // These regions are player-authored; item-name data is handled separately.
    const MIRAPRI_AUTHORED_SEL = [
      '#gallery article .article-info .title',
      '#gallery article figure',
      '#photoDetail article .article-info .title',
      '#photoDetail article .description',
      '#photoDetail article .comment',
      '#photoDetail article .user-comment',
      '.comment-body',
    ].join(',');
    const MIRAPRI_TRANSLATABLE_ATTRS = ['title', 'alt', 'aria-label', 'placeholder'];
    const isMirapriAuthored = (el) => !!el?.closest?.(MIRAPRI_AUTHORED_SEL);
    let busy = false; // NOSONAR — 页面扫描期间的重入保护状态

    function tr(text) {
      if (!text) return text;
      const t = text.trim();
      if (!t) return text;
      if (DICT[t]) {
        const i = text.indexOf(t);
        return text.slice(0, i) + DICT[t] + text.slice(i + t.length);
      }
      let out = text;
      for (const [re, to] of PATTERNS) out = out.replace(re, to);
      return out;
    }

    function trNode(node) {
      const raw = node.nodeValue;
      if (!raw?.trim() || raw.trim().length > 200) return;
      const p = node.parentElement;
      if (isMirapriAuthored(p)) return;
      const next = tr(raw);
      if (next !== raw) {
        // Retain translation diagnostics without creating Japanese hover titles.
        if (p?.dataset && !p.dataset.zhixiaSourceText) p.dataset.zhixiaSourceText = raw.trim();
        node.nodeValue = next;
      }
    }

    function _translateMirapriAttr(el, attr) {
      const original = el.getAttribute(attr);
      if (!original || original.length > 200) return;
      if (attr === 'alt' && el.closest?.('#gallery article, #photoDetail article')) return;
      const translated = tr(original);
      if (translated !== original) el.setAttribute(attr, translated);
    }

    function _translateMirapriButtonValue(el) {
      // Never mutate user-provided input values.
      if (el.tagName !== 'INPUT' || !/^(button|submit|reset)$/i.test(el.getAttribute('type') || '')) return;
      const value = el.getAttribute('value');
      if (!value) return;
      const translated = tr(value);
      if (translated !== value) el.setAttribute('value', translated);
    }

    function trEl(el) {
      if (isMirapriAuthored(el)) return;
      for (const attr of MIRAPRI_TRANSLATABLE_ATTRS) _translateMirapriAttr(el, attr);
      _translateMirapriButtonValue(el);
    }

    function translateMirapriTitle() {
      const old = document.title;
      if (!old) return;
      const translated = old
        .replace('FF14ミラプリSS投稿・共有サイト', 'FF14 幻化截图投稿 · 分享站')
        .replace('ミラプリを投稿', '发布幻化')
        .replace('このサイトについて', '关于本站')
        .replace('ガイドライン', '指南')
        .replace('お問い合わせ', '联系我们');
      // Player-authored article title segments must remain untouched.
      if (translated !== old) document.title = translated;
    }

    function translatePage(rootArg) {
      if (rootArg?.nodeType === 3) { trNode(rootArg); return; }
      if (busy) return;
      busy = true;
      const isFull = !rootArg;
      try {
        const root = rootArg || document.body || document.documentElement;
        if (!root) return;
        _markScan(localScope(rootArg));   // v1.4.1：扫描计数（区分全页/局部）
        if (root.nodeType === 1) trEl(root);
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
          acceptNode: (n) => {
            if (n.nodeType === 1 && (SKIP_TAGS.has(n.tagName) || isMirapriAuthored(n))) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          },
        });
        const batch = [];
        while (w.nextNode()) batch.push(w.currentNode);
        for (const n of batch) {
          if (n.nodeType === 3) trNode(n);
          else if (n.nodeType === 1) trEl(n);
        }
        if (isFull) translateMirapriTitle();
      } finally {
        busy = false;
      }
    }

    function startMirapri() {
      safe(translatePage, 'mirapri 全扫')();
      // Handle newly added UI plus attributes refreshed by PJAX/Turbo widgets.
      createObserver({
        root: document.documentElement,
        attributes: true,
        attributeFilter: MIRAPRI_TRANSLATABLE_ATTRS,
        debounce: 300,
        handler: (nodes) => {
          for (const n of nodes) safe(translatePage, 'mirapri 局部')(n);
          safe(translateMirapriTitle, 'mirapri 标题')();
        },
      });
      document.addEventListener('turbo:load', safe(translatePage, 'turbo'), false);
      document.addEventListener('pjax:end', safe(translatePage, 'pjax'), false);
    }

  /* @phase15-module-order:sites/huiji-wiki */
  /* @phase15-order-link:sites/huiji-wiki<-sites/mirapri */


    /* =====================================================================
     * 第二部分：灰机 FF14 中文维基物品页 → 「在 MIRAPRI 搜索」按钮
     * 依据：mirapri 的搜索关键词 = 日文装备名（与站内「この装備品で検索」一致）
     * ===================================================================== */

    const MIRAPRI_BASE = 'https://mirapri.com/';
    const RONKA_BASE = 'https://lookbook.ronkacloset.com/';
    const EC_BASE = 'https://ffxiv.eorzeacollection.com/glamours?';

    // wiki 装备栏目 → Eorzea Collection 的部位筛选参数
    const EC_SLOT = {
      '头部防具': 'headPiece',
      '身体防具': 'bodyPiece',
      '手部防具': 'handsPiece',
      '腿部防具': 'legsPiece',
      '脚部防具': 'feetPiece',
      '耳饰': 'earringsPiece',
      '项链': 'necklacePiece',
      '手镯': 'braceletsPiece',
      '戒指': 'ringPiece',
      '武器': 'weaponPiece',
      '盾': 'offhandPiece',
      '时尚配饰': 'fashionPiece',
      '面饰': 'facePiece',
    };

    // EC 的部位筛选用的是它自己的装备 ID（不是 wiki 的物品 ID），
    // EC 装备 ID 从内嵌主表第 4 列读取（中文名 -> EC_ID，由离线采集写入），
    // 不再实时调 EC 接口——那个请求会被 Cloudflare 拦，按钮永远等不到回调。

    // 元素在当前视口下是否可见（用于 hide-m / hide-pc 双份结构：
    // 灰机移动版把同一内容渲染两份，仅其中一份对当前端可见）
    function _visible(el) {
      for (let n = el; n?.nodeType === 1; n = n.parentElement) {
        let cs;
        try { cs = getComputedStyle(n); } catch (e) { /* 忽略：样式读取失败不影响判定 */ }
        if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return false;
      }
      return true;
    }

    // 按标题找区块：同名多份时优先返回「当前端可见」的一份，
    // 避免把反查块插进被 CSS 隐藏的副本（手机端不可见 bug 的根因）
    function blockByTitle(title) {
      const blocks = document.querySelectorAll('.ff14-content-box-block');
      let firstAny = null;
      for (const b of blocks) {
        const t = b.querySelector('.ff14-content-box-block--title');
        if (!(t && t.textContent.trim() === title)) continue;
        if (!firstAny) firstAny = b;
        if (_visible(b)) return b;
      }
      return firstAny;
    }

    function getJapaneseName() {
      const block = blockByTitle('各语言名称');
      if (!block) return null;
      for (const li of block.querySelectorAll('li')) {
        const img = li.querySelector('img');
        const key = (img && (img.getAttribute('alt') || img.getAttribute('src'))) || '';
        if (/flag[_\s-]?jp/i.test(key)) {
          const txt = li.textContent.replace(/\s+/g, ' ').trim();
          if (txt) return txt;
        }
      }
      const second = block.querySelectorAll('li')[1];
      return second ? second.textContent.replace(/\s+/g, ' ').trim() : null;
    }

    // 物品 ID：取自「其他站点链接」里的 Garland / 光之收藏家 链接
    function getItemId() {
      const as = document.querySelectorAll(
        'a[href*="garlandtools"], a[href*="ff14risingstones"], a[href*="risingstones"]');
      for (const a of as) {
        const h = a.getAttribute('href') || '';
        const m = /#item\/(\d+)/.exec(h) || /[?&]equipmentid=(\d+)/.exec(h) || m_last(h);
        if (m) return typeof m === 'string' ? m : m[1];
      }
      return null;
    }

    function m_last(h) {
      const m = h.match(/\/item\/(\d+)/);
      return m ? m[1] : null;
    }

    // wiki 页当前物品的国服中文名（页面标题形如「物品:伽拉忒亚吊带袜」）
    // 注意：灰机新版把「XXX 于N个月前修改了此页面。」也塞在 h1 里，
    // 必须先截断再规范化，否则中文名会带上编辑者信息，查表必然失败。
    function getItemZhName() {
      const clean = (v) => {
        let t = (v || '').replace(/^\s*(物品|道具|Item)\s*[:：]\s*/i, '');
        t = t.split(/\n|\r|于.{0,8}(?:前|ago)修改|修改了此页面/)[0];
        return t.replace(/\s+/g, ' ').trim();
      };
      const ok = (v) => {
        const t = clean(v);
        return (t && t.length <= 40 && /[\u4e00-\u9fff]/.test(t)) ? t : null;
      };
      let t = null;
      const main = document.querySelector('#firstHeading .mw-page-title-main, .mw-page-title-main');
      if (main) t = ok(main.textContent);
      const h = document.querySelector('#firstHeading, h1.firstHeading, h1');
      if (!t && h) {
        const it = h.innerText || '';
        const firstLine = it.split('\n').map((x) => x.trim()).find(Boolean) || '';
        t = ok(firstLine) || ok(h.textContent);
      }
      if (!t) {
        const m = /^\s*(?:物品|道具|Item)\s*[:：]\s*([^\-|]{1,40})/i.exec(document.title || '');
        if (m) t = ok(m[1]);
      }
      return t;
    }

    // 装备栏目（部位）
    // v1.3.1：多路回退——移动皮肤/类名变体下也能识别部位（原单选择器在部分皮肤下失效）
    function _slotHit(el) {
      if (!el) return null;
      const t = (el.textContent || '').trim();
      return EC_SLOT[t] ? { key: EC_SLOT[t], label: t } : null;
    }
    function _slotFromList(list) {
      for (const el of list) {
        const r = _slotHit(el);
        if (r) return r;
      }
      return null;
    }
    function _slotFromInfobox() {
      const root = document.querySelector('.infobox, [class*="infobox"]');
      if (!root) return null;
      for (const el of root.querySelectorAll('div, td, dt, dd, li')) {
        if (el.children.length > 2) continue;
        const t = (el.textContent || '').trim();
        if (t.length <= 6 && EC_SLOT[t]) return { key: EC_SLOT[t], label: t };
      }
      return null;
    }
    function getSlot() {
      let r = _slotHit(document.querySelector('.infobox-item--name-category'));
      if (r) return r;
      try { r = _slotFromList(document.querySelectorAll('[class*="name-category"]')); } catch (e) { /* 忽略：类名变体查询失败——继续兜底扫描 */ }
      if (r) return r;
      try { r = _slotFromInfobox(); } catch (e) { /* 忽略：兜底扫描失败——按非装备页处理 */ }
      return r;
    }

    // → Eorzea Collection「已筛好这件装备」的搜索页（零网络：本地表直查）
    function eorzeaLink(cb) {
      const slot = getSlot();
      if (!slot) { cb(null); return; }
      const zh = getItemZhName();
      if (!zh) { cb(null); return; }
      const ecId = resolveEcId(zh);
      if (!ecId) { cb(null); return; }
      cb({ href: EC_BASE + encodeURIComponent('filter[' + slot.key + ']') + '=' + ecId,
           why: slot.label + ' · ' + zh });
    }

    // 「幻化装备反查链接」四站（一条一行，与「其他站点链接」同款区块样式）
    function wikiReverseItems() {
      const items = [];
      // 1) 光之收藏家（国服，已迁入石之家幻化版块；物品 ID 取自页面内 Garland / 光之收藏家链接）
      const id = getItemId();
      if (id) items.push(['https://ff14risingstones.web.sdo.com/pc/index.html#/search?equipmentid=' + id + '&section=glamour', '光之收藏家']);
      const zh = getItemZhName();
      // 2) 日服幻化站（mirapri，关键词=日文名）
      const jp = getJapaneseName();
      const nm = jp || zh;
      if (nm) items.push([MIRAPRI_BASE + '?keyword=' + encodeURIComponent(nm), '日服幻化站（MIRAPRI SNAP）']);
      // 3) 国际服幻化站（Eorzea Collection，内嵌表直查，零网络）
      eorzeaLink((ec) => { if (ec) items.push([ec.href, '国际服幻化站（Eorzea Collection）']); });
      // 4) 韩服幻化站（Ronka LookBook，关键词=韩文名，由中文名反查）
      const ko = resolveKo(zh);
      if (ko) items.push([RONKA_BASE + '?keyword=' + encodeURIComponent(ko), '韩服幻化站（Ronka LookBook）']);
      return items;
    }

    // v1.2.7：DOM 清理/构建/挂载拆为子步骤（降认知复杂度）
    function _removeOldStarlight(src) {
      if (!src) return;
      for (const a of src.querySelectorAll('a')) {
        const h = a.getAttribute('href') || '';
        if (/risingstones/i.test(h) || (a.textContent || '').includes('光之收藏家')) {
          const li = a.closest('li');
          (li || a).remove();
        }
      }
    }

    function _buildReverseBlock(items) {
      const block = document.createElement('div');
      block.className = 'ff14-content-box-block zhixia-reverse-block';
      const title = document.createElement('div');
      title.className = 'ff14-content-box-block--title';
      title.textContent = '幻化装备反查链接';
      block.appendChild(title);
      // 与「其他站点链接」等灰机原生区块同款：标题下一道分隔线（hr）
      block.appendChild(document.createElement('hr'));
      const ul = document.createElement('ul');
      for (const [href, text] of items) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = href;
        a.target = '_blank';
        a.rel = 'nofollow noreferrer noopener';
        a.textContent = text;
        li.appendChild(a);
        ul.appendChild(li);
      }
      block.appendChild(ul);
      return block;
    }

    // 从选择器命中的元素中取第一个「当前端可见」的（无可见项时退回第一项）
    function _pickVisible(sel) {
      const list = document.querySelectorAll(sel);
      let first = null;
      for (const el of list) {
        if (!first) first = el;
        if (_visible(el)) return el;
      }
      return first;
    }

    function _mountReverseBlock(block, src) {
      // 位置：「其他站点链接」之后；无该区块时退回 infobox / 正文顶
      // （双份结构下取当前端可见的那份，避免插进隐藏副本）
      if (src?.parentElement) {
        src.parentElement.insertBefore(block, src.nextSibling);
        return;
      }
      const info = _pickVisible('.infobox, [class*="infobox"]');
      if (info?.parentElement) {
        info.parentElement.insertBefore(block, info.nextSibling);
        return;
      }
      const content = document.querySelector('#mw-content-text, .mw-parser-output, #content');
      if (content) content.insertBefore(block, content.firstChild);
    }

    function injectWikiButton() {
      // 幂等重建：数据晚到时刷新会先移除上一版区块再重建
      const prev = document.querySelector('.zhixia-reverse-block');
      if (prev) prev.remove();

      // 仅在装备页注入：页面 infobox 部位类目须属于幻化装备（与 EC 链接同一判定）。
      // 非装备页（消耗品/素材/家具/任务/NPC 等）直接退出——既不注入反查区块，
      // 也不改动「其他站点链接」。
      if (!getSlot()) return;

      // 原「其他站点链接」列表里的光之收藏家移除（新块内已有，避免重复）
      const src = blockByTitle('其他站点链接');
      _removeOldStarlight(src);

      // 「幻化装备反查链接」区块（与「其他站点链接」同款式：区块 + 标题 + 列表，一行一条）
      const items = wikiReverseItems();
      if (!items.length) return;
      const block = _buildReverseBlock(items);
      _mountReverseBlock(block, src);
      document.documentElement.dataset.zhixiaWikiDone = '1';
    }

    function startWiki() {
      // 灰机页面 DOM 变动极频繁（目录/评论区/懒加载），必须节流并限制重试次数，
      // 否则按钮插不进去时会每次变动都重跑把页面拖死。
      // 移动端（Via 等）首屏渲染慢：放宽总重试次数 + 阶梯定时兜底，避免固定 3 次
      // 尝试在前几秒用尽后永久放弃；注入为纯本地查询（无网络），重试成本极低。
      let tries = 0;
      const MAX_TRIES = 16;
      const attempt = () => {
        if (tries >= MAX_TRIES) return;
        if (document.documentElement.dataset.zhixiaWikiDone) return;
        tries++;
        try { window.__zhxWikiTries = tries; } catch (e) { /* 忽略：探测钩子，失败不影响注入 */ }
        safe(injectWikiButton, 'Wiki 按钮注入')();
      };
      attempt();
      // 阶梯定时：覆盖移动端首屏渲染慢的场景（成功即止，重复触发为幂等重建）；
      // v1.3.1：增补 22s / 30s 两档，覆盖移动端极端慢渲染
      [1500, 4000, 8000, 15000, 22000, 30000].forEach((ms) => setTimeout(attempt, ms));
      // v1.4 Phase 7：经统一观察器（debounce 由统一层管理；尝试次数守卫仍在 attempt 内）
      createObserver({ debounce: 1200, handler: () => attempt() });
      // 数据就绪刷新「幻化装备反查链接」区块由 Site Adapter 统一登记（见 SITE_REGISTRY 的 onDataReady）
    }

  /* @phase15-module-order:core/item-resolver */
  /* @phase15-order-link:core/item-resolver<-sites/huiji-wiki */


    // 英文名 -> 国服中文名（单条查找 + 缓存）。用于 EC 上没进固定词典的
    // 装备名/染剂名等短英文串（如 Tule Tunic、Charcoal Grey）。
    const _en2zhCache = new Map();
    function tryEnToZh(en) {
      if (!en) return null;
      if (_en2zhCache.has(en)) return _en2zhCache.get(en);
      // 物品总表统一索引（英/日/韩名 → 中文名；染剂色名回退已由 V3 names 文件展开）
      const out = resolveByName(en);
      cacheGuard(_en2zhCache, CACHE_CAP_LOOKUP);
      _en2zhCache.set(en, out);
      return out;
    }

    function trEC(text) {
      if (!text) return text;
      const t = text.trim();
      if (!t) return text;
      if (t.length > 90) return text;          // 长句多为用户描述，不动
      if (!/[a-zA-Z]/.test(t)) return text;    // 快速跳过：DICT_EC/PATTERNS_EC 全部含拉丁字母（v1.11.1）
      const hit = DICT_EC[t];
      if (hit) {
        const i = text.indexOf(t);
        return text.slice(0, i) + hit + text.slice(i + t.length);
      }
      // 纯英文短串（字母开头，含有限符号）→ 查主表/染剂表拿国服中文名
      if (/^[A-Za-z]/.test(t) && /^[A-Za-z0-9'\-.,:&!? ()（）]+$/.test(t)) {
        const zhName = tryEnToZh(t);
        if (zhName && zhName !== t) {
          const i2 = text.indexOf(t);
          return text.slice(0, i2) + zhName + text.slice(i2 + t.length);
        }
      }
      let out = text;
      for (const [re, to] of PATTERNS_EC) out = out.replace(re, to);
      return out;
    }


    // 日文 → 中文 单条查找（物品总表统一索引；日文名 → 国服中文名）
    const _jp2zhCache = new Map();
    function lookupJp2Zh(jp) {
      if (!jp || jp.length > 80) return null;   // v1.12.0 放宽
      if (_jp2zhCache.has(jp)) return _jp2zhCache.get(jp);
      const out = resolveByName(jp);
      cacheGuard(_jp2zhCache, CACHE_CAP_LOOKUP);
      _jp2zhCache.set(jp, out);
      return out;
    }
    // v1.2.7：② 剥离 / ③ 前缀匹配拆为子步骤（降认知复杂度）
    function _stripSeriesHit(map, jp) {
      let s = jp;
      for (let guard = 0; guard < 6; guard++) {
        const di = s.lastIndexOf('・');
        if (di >= 2) s = s.slice(0, di);
        else break;
        const hit = map.get(s);
        if (hit) return hit;
      }
      return null;
    }

    function _mutualPrefix(k, jp) {
      return jp.startsWith(k) || k.startsWith(jp);
    }

    function _prefixBest(map, jp) {
      const head = jp.slice(0, 2);
      let bestKey = '', bestVal = null;
      for (const [k, v] of map) {
        if (k.length < 2 || !k.startsWith(head)) continue;
        if (k.length > head.length + 14 && !k.startsWith(jp)) continue;
        if (_mutualPrefix(k, jp) && k.length > bestKey.length) { bestKey = k; bestVal = v; }
      }
      return bestVal;
    }

    function lookupSeries(jp) {
      if (!jp || jp.length < 2 || jp.length > 60) return null;
      const map = _getSeriesMap();
      if (!map.size) return null;
      // ① 精确
      const exact = map.get(jp);
      if (exact) return exact;
      // ② 逐步剥离：优先在 ・ 处剥
      const hit = _stripSeriesHit(map, jp);
      if (hit) return hit;
      // ③ 前缀匹配（桶：首2字）：k 与 jp 互为前缀（双向），取最长键
      return _prefixBest(map, jp);
    }

  /* @phase15-module-order:core/cache */
  /* @phase15-order-link:core/cache<-core/item-resolver */


    // ── 系列名前缀查找（v1.12.0）：从单件装备表自动推导的系列名（如 ファントムヴィジョン・ディフェンダー → 幻境意象御敌）
    let _seriesMap = null; // NOSONAR — 派生缓存按需构建并由 cacheReset 失效
    function _getSeriesMap() {
      if (_seriesMap) return _seriesMap;
      _seriesMap = new Map();
      if (typeof DATA_TEXT.series === 'string' && DATA_TEXT.series) {
        for (const line of DATA_TEXT.series.split('\n')) {
          if (!line) continue;
          const i = line.indexOf('|');
          if (i > 0) _seriesMap.set(line.slice(0, i), line.slice(i + 1));
        }
      }
      return _seriesMap;
    }

    // 子串替换词表：长度 ≥ 2 的键按长→短排序（用于长句/alt 兜底）
    // v1.2.0：改为懒构建函数——词库运行时更新（dict.json）后清缓存即可重算
    let _fcSubstrCache = null; // NOSONAR — 派生缓存按需构建并由 cacheReset 失效
    function _getFCSubstrKeys() {
      if (_fcSubstrCache) return _fcSubstrCache;
      _fcSubstrCache = Object.keys(DICT_FC)
        .filter((k) => k.length >= 2 && !/^[A-Za-z0-9]+$/.test(k))
        .sort((a, b) => b.length - a.length);
      return _fcSubstrCache;
    }

    // v1.1.5：系列名前缀推导（从系列表「系列・职业」条目反推「系列→系列译」）
    // 用途：长标题等「裸前缀」场景（如 H1「ファントムヴィジョン・法系装备」）；严格双验证：
    //   ① 条目尾部是已知职业词（FC_ROLE_ZH）② 译文以该职业译名结尾 → 切出前缀译
    //   仅当同一前缀所有样本译名一致（set.size === 1）才启用；带缓存，数据就绪后懒构建。
    let _seriesPfxCache = null; // NOSONAR — 派生缓存按需构建并由 cacheReset 失效
    let _allKeysCache = null; // NOSONAR — 派生缓存按需构建并由 cacheReset 失效
    // v1.2.7：_seriesPfxCollect 拆为子步骤（降认知复杂度）
    function _seriesPfxCollect(map, cand) {
      for (const [jp, zh] of map) {
        const di = jp.lastIndexOf('・');
        if (di <= 0) continue;
        const roleZh = FC_ROLE_ZH[jp.slice(di + 1)];
        if (!roleZh || !zh.endsWith(roleZh)) continue;
        const zhHead = zh.slice(0, zh.length - roleZh.length);
        if (zhHead.length < 2) continue;
        const key = jp.slice(0, di);
        if (key.length < 3) continue;
        if (!cand.has(key)) cand.set(key, new Set());
        cand.get(key).add(zhHead);
      }
    }

    function _getSeriesPfx() {
      if (_seriesPfxCache) return _seriesPfxCache;
      _seriesPfxCache = new Map();
      try {
        const map = _getSeriesMap();
        if (map.size) {
          const cand = new Map();
          _seriesPfxCollect(map, cand);
          for (const [key, set] of cand) if (set.size === 1) _seriesPfxCache.set(key, [...set][0]);
        }
      } catch (e) { /* 忽略：系列前缀推导 best-effort，失败返回空表 */ }
      return _seriesPfxCache;
    }
    function _getSubstrKeysAll() {
      if (_allKeysCache) return _allKeysCache;
      const keys = _getFCSubstrKeys().slice();
      for (const k of _getSeriesPfx().keys()) if (!DICT_FC[k]) keys.push(k);
      for (const k of _getItemPfx().keys()) if (!DICT_FC[k]) keys.push(k);
      keys.sort((a, b) => b.length - a.length);
      _allKeysCache = keys;
      return keys;
    }

    // v1.1.6：物品系列名前缀推导（从物品表「系列・部件」条目反推「系列→系列译」）
    // 用途：fc 卡片标题等「裸系列名」场景（ネオイシュガルディアン、イディル、キングダムテール 等）
    // 算法：按「・」前段分组，求组内中文名的最长公共子串（≥90% 覆盖、≥2 字）；
    //   处理「改良型×」等修饰词混入（公共子串而非前缀，规避前段差异）。带缓存，数据就绪后懒构建。
    let _itemPfxCache = null; // NOSONAR — 派生缓存按需构建并由 cacheReset 失效
    // v1.2.7：_itemPfxGroup 拆为子步骤（降认知复杂度）
    function _itemPfxGroup(nm) {
      const groups = new Map();
      for (const k in nm) {
        const di = k.indexOf('・');
        if (di <= 0 || di >= k.length - 1) continue;
        const zh = nm[k];
        if (!zh) continue;
        const key = k.slice(0, di);
        if (key.length < 3) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(zh);
      }
      return groups;
    }

    function _getItemPfx() {
      if (_itemPfxCache) return _itemPfxCache;
      _itemPfxCache = new Map();
      try {
        const nameMap = dataGetIndex('nameMap');
        if (!nameMap) return _itemPfxCache;
        const groups = _itemPfxGroup(nameMap);
        for (const [key, list] of groups) {
          if (list.length < 2) continue;
          const sub = _lcs90(list);
          if (sub && sub.length >= 2 && !DICT_FC[key]) _itemPfxCache.set(key, sub);
        }
      } catch (e) { /* 忽略：物品前缀推导 best-effort，失败返回空表 */ }
      return _itemPfxCache;
    }
    // v1.2.7：_shortestStr/_countIncludes 拆为子步骤（降认知复杂度）
    function _shortestStr(list) {
      let shortest = list[0];
      for (const x of list) if (x.length < shortest.length) shortest = x;
      return shortest;
    }

    function _countIncludes(list, sub) {
      let c = 0;
      for (const x of list) if (x.includes(sub)) c++;
      return c;
    }

    function _lcs90(list) {
      const need = Math.ceil(list.length * 0.9);
      const shortest = _shortestStr(list);
      const maxLen = Math.min(12, shortest.length);
      for (let len = maxLen; len >= 2; len--) {
        for (let i = 0; i + len <= shortest.length; i++) {
          const sub = shortest.slice(i, i + len);
          if (_countIncludes(list, sub) >= need) return sub;
        }
      }
      return null;
    }
    let _ronkaCacheN = 0; // NOSONAR — 缓存容量计数器随缓存写入/清理变化
    function ronkaItemLookup(ko) {
      if (!ko || ko.length > 80) return null;
      if (ko in RONKA_ITEM_CACHE) return RONKA_ITEM_CACHE[ko];
      const v = resolveByName(ko);
      if (cacheGuard(RONKA_ITEM_CACHE, CACHE_CAP_LOOKUP, _ronkaCacheN)) _ronkaCacheN = 0;
      RONKA_ITEM_CACHE[ko] = v;
      _ronkaCacheN++;
      return v;
    }

    /* @zhixia:core-cache-start */
    /* ── Core Cache（v1.4 Phase 4，段1/2）：缓存策略——每日至多一次版本探测、
         数据探测周期常量。本模块仅保留内存派生缓存相关逻辑；
         Phase 15 模块化构建时，原样抽出为 src/core/cache.js。 */

    const DAY_MS = 24 * 60 * 60 * 1000;

    /* @zhixia:core-cache-end */


    /* @zhixia:core-cache-registry-start */
    /* ── Core Cache Registry（v1.4 Phase 14）：缓存体系集中登记 ─────────────
       目标：每类缓存的「职责 / 生命周期 / 容量 / 失效」在此唯一登记，
       禁止散落的手工 reset。新增缓存时，在本段 cacheRegister 一行登记即可，
       并由 unit/test-cache.mjs 守卫（登记数量断言）。

       四类缓存（按职责划分，不强制统一数据结构）：
         · data      数据缓存（持久，GM 存储）：zhx.v3.*
                     生命周期：跨会话；由 V3 manifest 与 dataInvalidate 管理（不在此登记）
         · lookup    查找缓存（内存，页面生命周期）：名称 → 中文 的直查结果（含负缓存）
                     失效：数据到达（_fireTablesReady）/ 容量防线（CACHE_CAP_LOOKUP）
         · translate 翻译缓存（内存，页面生命周期）：由词典派生的子串键与组合键表
                     失效：词典更新（dictInvalidate）/ 数据到达
         · derived   派生缓存（内存，页面生命周期）：由数据表派生的映射与前缀表
                     失效：数据到达（_fireTablesReady）；容量由数据表规模界定
       统一入口：cacheReset(kind) 按类清理；cacheInfo() 观测（修订号 + 条目数）。 */
    const _cacheReg = new Map();
    const CACHE_CAP_LOOKUP = 5000;   // lookup 类容量防线：超出即清空重建（避免长会话无界增长）
    function cacheRegister(name, kind, reset, size) { _cacheReg.set(name, { kind, reset, size }); }
    function cacheReset(kind) {
      for (const e of _cacheReg.values()) {
        if (kind && e.kind !== kind) continue;
        try { e.reset(); } catch (error_) { /* 忽略：单个缓存清理失败不阻断其余 */ }
      }
    }
    function cacheInfo() {
      const entries = {};
      for (const [name, e] of _cacheReg) {
        try { entries[name] = e.size ? e.size() : null; } catch (error_) { entries[name] = null; /* 忽略：单项尺寸读取失败记 null（诊断不中断） */ }
      }
      return {
        entries,
        rev: {
          data: (typeof DATA_VER === 'string' ? DATA_VER : ''),
          dict: (typeof dictGetRevision === 'function' ? dictGetRevision() : 0),
        },
      };
    }
    /* 容量防线：条目数达到上限时清空缓存（清空即重建，不影响正确性）。
       count 供无 size 的对象型缓存（如 RONKA 物品表）传入计数器。 */
    function cacheGuard(cache, cap, count) {
      if (!cache) return false;
      let n = (typeof count === 'number') ? count : cache.size;
      if (typeof n !== 'number') n = Object.keys(cache).length;
      if (n < cap) return false;
      if (typeof cache.clear === 'function') { try { cache.clear(); } catch (e) { /* 忽略：清空失败则重建继续（正确性不受影响） */ } return true; }
      for (const k in cache) { try { delete cache[k]; } catch (e) { /* 忽略：同上（清空失败无碍） */ } }
      return true;
    }
    /* ── 登记（新增缓存必须在此加一行；kind 见四类划分）── */
    cacheRegister('en2zh', 'lookup', () => { _en2zhCache.clear(); }, () => _en2zhCache.size);
    cacheRegister('jp2zh', 'lookup', () => { _jp2zhCache.clear(); }, () => _jp2zhCache.size);
    cacheRegister('ronkaItems', 'lookup', () => { for (const k in RONKA_ITEM_CACHE) { delete RONKA_ITEM_CACHE[k]; } _ronkaCacheN = 0; }, () => _ronkaCacheN);
    cacheRegister('seriesMap', 'derived', () => { _seriesMap = null; }, () => (_seriesMap ? _seriesMap.size : 0));
    cacheRegister('seriesPfx', 'derived', () => { _seriesPfxCache = null; }, () => (_seriesPfxCache ? _seriesPfxCache.size : 0));
    cacheRegister('itemPfx', 'derived', () => { _itemPfxCache = null; }, () => (_itemPfxCache ? _itemPfxCache.size : 0));
    cacheRegister('fcSubstr', 'translate', () => { _fcSubstrCache = null; }, () => (_fcSubstrCache ? _fcSubstrCache.length : 0));
    cacheRegister('allKeys', 'translate', () => { _allKeysCache = null; }, () => (_allKeysCache ? _allKeysCache.length : 0));
    /* @zhixia:core-cache-registry-end */

  /* @phase15-module-order:sites/ff14-fc */
  /* @phase15-order-link:sites/ff14-fc<-core/cache */


    // v1.12.3：职能/类别词（・复合名逐段翻译用）
    const FC_ROLE_ZH = {
      'ディフェンダー': '御敌', 'スレイヤー': '制敌', 'ストライカー': '强袭',
      'スカウト': '游击', 'ヒーラー': '治愈', 'キャスター': '咏咒',
      'レンジャー': '精准', 'ファイター': '战斗', 'ソーサラー': '法系',
    };

    // v1.12.3：「・」复合名逐段翻译（ダークマホガニー・スレイヤー → 深红木·制敌）
    function trFCSegments(t) {
      if (!t?.includes('・')) return null;
      const parts = t.split('・');
      if (parts.length < 2 || parts.length > 5) return null;
      let hit = 0;
      const zh = parts.map((p) => {
        const z = FC_ROLE_ZH[p] || DICT_FC[p] || lookupJp2Zh(p) || lookupSeries(p);
        if (z) { hit++; return z; }
        return null;
      });
      if (hit < 1) return null;
      // Unknown Japanese equipment segments must not be rendered as half-translated names.
      if (parts.some((p, i) => zh[i] == null && !/^[A-Za-z0-9 ]{1,15}$/.test(p))) return null;
      const out = parts.map((p, i) => (zh[i] != null ? zh[i] : p));
      return out.join('·');
    }

    // 装饰性首尾符号（菜单里的 ≫ ▶ » ✨ 😊 等，不参与查表）
    // v1.2.2：加 u 标志——emoji（星面字符）在无 u 的字符类里按代理对拆半匹配
    // v1.2.3：TAIL 量词改有界 {1,64}——消除 S8786 潜在超线性回溯（>64 个连续装饰的输入不现实）
    const FC_DECOR_HEAD = /^[\s|｜<＜≪«◀◁▷●○★☆🎉✨👗💍🛡💬]+/u;
    const FC_DECOR_TAIL = /[\s|｜>＞≫»▶▽◆■□●○★☆♪！!。、…😊✨🎉]{1,64}$/u;

    // 逐条替换：整串精确 → 剥离装饰 → 当日文装备名 → 子串兜底
    // v1.2.8：四步链拆为子步骤（降认知复杂度）
    // ① 整串精确（v1.12.11：空白归一化回退，防空格式差异）
    function _trFCExact(text, t0) {
      let hit0 = DICT_FC[t0];
      if (!hit0) {
        const norm = t0.replace(/[ \t\u00a0]+/g, ' ').trim();
        if (norm !== t0) hit0 = DICT_FC[norm];
      }
      if (!hit0) return null;
      const i = text.indexOf(t0);
      return text.slice(0, i) + hit0 + text.slice(i + t0.length);
    }

    // ② 剥离装饰符号后再试
    function _trFCDecor(text, t0, core) {
      if (!core || core === t0) return null;
      const hit1 = DICT_FC[core];
      if (!hit1) return null;
      const head = t0.slice(0, t0.indexOf(core));
      const tail = t0.slice(t0.indexOf(core) + core.length);
      const i = text.indexOf(t0);
      return text.slice(0, i) + head + hit1 + tail + text.slice(i + t0.length);
    }

    // ③ 日文装备名（剥「画像」等后缀）；失败再试系列名（v1.12.0）
    // v1.12.2：含假名 OR 纯汉字串（≤20字，如 夜桜上衣）都试查
    // v1.2.1：判定前剥【…】标记——「春日半頬【想】」等「纯汉字+全角标记」名此前两条件都不满足，整名不查表
    function _trFCName(text, t0, core) {
      const c3 = core || t0;
      const c3p = c3.replace(/【[^【】]*】/g, '').trim() || c3;
      const isKana = /[\u3040-\u30ff]/.test(c3p);
      const isKanji = /^[\u3005\u3006\u4e00-\u9fff]+$/.test(c3p) && c3p.length >= 2 && c3p.length <= 20;
      if (!isKana && !isKanji) return null;
      const cand = c3.replace(/(の画像|画像|イメージ|の見た目)$/, '').trim();
      // v1.1.3：数据就绪前不跑逐段翻译——「系列・职业」半翻译（ファントムヴィジョン·御敌）会破坏原文，
      // 数据到后的补扫将无法再识别（整体译名依赖完整日文名）；等数据齐由补扫统一处理
      let zh = lookupJp2Zh(cand) || lookupSeries(cand);
      if (!zh && _tablesReady) zh = trFCSegments(cand);
      if (!zh || zh === cand) return null;
      const i2 = text.indexOf(t0);
      return text.slice(0, i2) + zh + text.slice(i2 + t0.length);
    }

    // ④ 子串兜底：含菜单词/装备名的片段（v1.14.5：门槛 6→2，覆盖被 <br> 等拆分的短节点如「で制作」）
    // v1.1.3：数据就绪前不跑——避免对「系列・职业」复合名做部分替换破坏原文（如 ファントムヴィジョン・御敌）；补扫时统一处理
    function _fcCanReplaceAt(out, at, key) {
      // Avoid translating ドレス inside メールアドレス or ノート inside ノートゥング.
      if (!/[ぁ-んァ-ヶー]/.test(key)) return true;
      const kana = /[ぁ-んァ-ヶー]/;
      return !kana.test(out[at - 1] || '') && !kana.test(out[at + key.length] || '');
    }
    function _fcReplaceSubstr(out, key, value) {
      let at = out.indexOf(key);
      let changed = false;
      while (at !== -1) {
        if (_fcCanReplaceAt(out, at, key)) {
          out = out.slice(0, at) + value + out.slice(at + key.length);
          changed = true;
          at = out.indexOf(key, at + value.length);
        } else {
          at = out.indexOf(key, at + key.length);
        }
      }
      return { out, changed };
    }
    function _trFCSubstr(text, t0, core) {
      if (!_tablesReady || (core || t0).length < 2 || !/[^\x00-\x7F]/.test(t0)) return null;
      // Avoid corrupting arbitrary Japanese prose with dictionary word fragments.
      if (/[。！？]/.test(t0) && /[ぁ-ん]/.test(t0)) return null;
      let out = text;
      let changed = false;
      // 长词优先，避免短词先替换（v1.1.6：含系列 + 物品前缀推导）
      for (const k of _getSubstrKeysAll()) {
        if (!out.includes(k)) continue;
        const v = DICT_FC[k] != null ? DICT_FC[k] : _getSeriesPfx().get(k) || _getItemPfx().get(k);
        if (v == null) continue;
        const replaced = _fcReplaceSubstr(out, k, v);
        out = replaced.out;
        changed ||= replaced.changed;
      }
      return changed ? out : null;
    }

    // 逐条替换：整串精确 → 剥离装饰 → 当日文装备名 → 子串兜底
    function trFC(text) {
      if (!text) return text;
      const t0 = text.trim();
      if (!t0) return text;
      if (t0.length > 120) return text;
      const core = t0.replace(FC_DECOR_HEAD, '').replace(FC_DECOR_TAIL, '').trim();
      const s1 = _trFCExact(text, t0);
      if (s1 !== null) return s1;
      const s2 = _trFCDecor(text, t0, core);
      if (s2 !== null) return s2;
      const s3 = _trFCName(text, t0, core);
      if (s3 !== null) return s3;
      const s4 = _trFCSubstr(text, t0, core);
      if (s4 !== null) return s4;
      return text;
    }

    // #zhx-chinese-suggest-list：中文搜索候选（native span 有意保留日文原名，不参与汉化）
    const FC_SKIP_SEL = 'script, style, noscript, textarea, .sns, .twitter, .line, #zhx-chinese-suggest-list';

    function trimFCNode(node) {
      const raw = node.nodeValue;
      if (!raw?.trim()) return;
      const p = node.parentElement;
      if (p?.closest?.(FC_SKIP_SEL)) return;
      const next = trFC(raw);
      if (next !== raw) node.nodeValue = next;
    }

    // v1.2.8：节点分派拆为子步骤（降认知复杂度）
    function _fcAcceptNode(n) {
      if (n.nodeType === 1) {
        if (SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
        if (n.closest?.(FC_SKIP_SEL)) return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }

    function _wowFCInput(n) {
      const ph = n.getAttribute('placeholder');
      if (ph) { const nn = trFC(ph); if (nn !== ph) n.setAttribute('placeholder', nn); }
      // v1.2.1：合并原被 2882 分支遮蔽的 input[value] 处理（v1.12.7 起从未生效；仅 submit/button/reset 防误伤）
      const v0 = n.getAttribute('value');
      if (v0 && v0.length <= 24 && /^(submit|button|reset)$/i.test(n.getAttribute('type') || '')) {
        const tv = trFC(v0);
        if (tv && tv !== v0) n.setAttribute('value', tv);
      }
    }

    function _trFCAttr(n, key) {
      const value = n.getAttribute(key);
      if (!value || value.length > 160) return;
      const match = key === 'title' && value.match(/^View all posts in (.+)$/);
      const group = match && DICT_FC[match[1]];
      const translated = group ? '查看“' + group + '”分类下的全部文章' : trFC(value);
      if (translated !== value) n.setAttribute(key, translated);
    }
    function _procFCImg(n) {
      const alt = n.getAttribute('alt');
      if (alt && alt.length >= 2 && alt.length <= 90) _trFCAttr(n, 'alt');
      if (n.hasAttribute('title')) _trFCAttr(n, 'title');
      if (n.hasAttribute('aria-label')) _trFCAttr(n, 'aria-label');
    }

    function _procFCNode(n) {
      if (n.nodeType === 3) { trimFCNode(n); return; }
      if (n.tagName === 'INPUT') { _wowFCInput(n); return; }
      if (n.tagName === 'A' && /lodestone|finalfantasyxiv|garland|eriones|ffxivdb|gamerescape/i.test(n.getAttribute('href') || '')) {
        // v1.12.1：外服链接 → 直接改写为灰机 wiki（文字查表；已中文则直接用）
        rewriteFCForeignLink(n);
        return;
      }
      if (n.tagName === 'IMG' || n.hasAttribute('alt')) _procFCImg(n);
      else {
        if (n.hasAttribute('title')) _trFCAttr(n, 'title');
        if (n.hasAttribute('aria-label')) _trFCAttr(n, 'aria-label');
      }
    }

    function translateFCPage(rootArg) {
      const isFull = !rootArg;
      if (isFull) {
        if (window.__zhixiaFcBusy) return;
        window.__zhixiaFcBusy = true;
      }
      try {
        if (rootArg?.nodeType === 3) { trimFCNode(rootArg); return; }
        const root = rootArg || document.body || document.documentElement;
        if (!root) return;
        _markScan(localScope(rootArg));   // v1.4.1：扫描计数（区分全页/局部）
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
          acceptNode: _fcAcceptNode,
        });
        const batch = [];
        while (w.nextNode()) batch.push(w.currentNode);
        for (const n of batch) _procFCNode(n);
      } finally {
        if (isFull) window.__zhixiaFcBusy = false;
      }
    }

    // <title> 汉化（子页标题：装备一覧＆検索 | ミラプリライフ 等）
    function translateFCTitle() {
      const t = document.title;
      if (!t || !/[\u3040-\u30ff]/.test(t)) return;
      let out = t;
      const parts = out.split(/[|｜\-–—]/).map((x) => x.trim()).filter(Boolean);
      const mapped = parts.map((pp) => {
        const hit = DICT_FC[pp];
        if (hit) return hit;
        const zh = lookupJp2Zh(pp.replace(/(の一覧|一覧|まとめ)$/, ''));
        return zh || pp;
      });
      out = mapped.join(' | ');
      if (out !== t && out.length <= 80) document.title = out;
    }

    // v1.12.1：外服装备链接（Lodestone 等）→ 改写为灰机 wiki 链接
    function fcLinkZhName(a) {
      const t = (a.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t || t.length < 2 || t.length > 60) return null;
      // v1.2.1：① Lodestone hash 直查（hash→物品表中文名，不受文本侧子串替换污染，如「春日护手【想】」）
      const hm = (a.getAttribute('href') || '').match(/lodestone\/playguide\/db\/item\/([0-9a-f]+)/i);
      if (hm) {
        const z = resolveByHash(hm[1]);
        if (z && z !== t) return z;
      }
      // v1.2.1：② 判定前剥【…】标记（「春日半頬【想】」等「纯汉字+全角标记」名此前不查表）
      const tp = t.replace(/【[^【】]*】/g, '').trim() || t;
      if (/[\u3040-\u30ff]/.test(tp) || (/^[\u3005\u3006\u4e00-\u9fff]+$/.test(tp) && tp.length <= 20)) {
        const z = lookupJp2Zh(t) || lookupSeries(t) || DICT_FC[t];
        if (z && z !== t) return z;
      }
      // 已是中文（或中日共用汉字）→ 去掉空格直接用
      if (/^[\u4e00-\u9fff·\u3040-\u30ffA-Za-z0-9'\- ]+$/.test(t) && /[\u4e00-\u9fff]/.test(t)) {
        return t;
      }
      return null;
    }
    function rewriteFCForeignLink(a) {
      if (a.dataset.zhixiaFcHref) return;
      const zh = fcLinkZhName(a);
      if (!zh) return;
      a.dataset.zhixiaFcHref = '1';
      a.setAttribute('href', WIKI_ITEM + encodeURIComponent(zh));
      a.removeAttribute('target');
    }

    // v1.12.7：菜单「ID」→「副本装备」
    function fixFCMenu(rootArg) {
      let changed = false;
      queryIn(localScope(rootArg), 'a[href*="/summary_equipment_id/"]').forEach((a) => {
        if (a.dataset.zhixiaMenu) return;
        const t = (a.textContent || '').trim();
        if (t === 'ID' || t === 'id') {
          a.dataset.zhixiaMenu = '1';
          a.textContent = '副本装备';
          changed = true;
        }
      });
      return changed;
    }

    // 装备名点击 → 灰机 wiki（fc 站装备名多为纯文本/链接，统一兜底）
    // v1.2.8：click 回调拆为子步骤（降认知复杂度）
    function _fcJumpName(probe, t, isForeign) {
      // v1.2.1：① Lodestone hash 直查（不受文本污染）
      if (probe.tagName === 'A') {
        const hm = (probe.getAttribute('href') || '').match(/lodestone\/playguide\/db\/item\/([0-9a-f]+)/i);
        if (hm) { const z = resolveByHash(hm[1]); if (z) return z; }
      }
      // v1.2.1：② 判定前剥【…】标记（同 fcLinkZhName）
      const tp = t.replace(/【[^【】]*】/g, '').trim() || t;
      if (/[\u3040-\u30ff]/.test(tp) || (/^[\u3005\u3006\u4e00-\u9fff]+$/.test(tp) && tp.length <= 20)) {
        const z = lookupJp2Zh(t) || lookupSeries(t) || DICT_FC[t];
        if (z) return z;
      }
      if (isForeign && /^[\u4e00-\u9fff·・A-Za-z0-9'\- ]+$/.test(t) && /[\u4e00-\u9fff]/.test(t)) return t;
      return null;
    }

    function _fcJumpResolve(el0, isForeign) {
      // 向上探测 5 层找可译名
      let probe = el0;
      let guard = 0;
      while (probe && guard < 5) {
        const t = (probe.textContent || '').replace(/\s+/g, ' ').trim();
        if (t && t.length >= 2 && t.length <= 60) {
          const z = _fcJumpName(probe, t, isForeign);
          if (z && z !== t) return z;
        }
        probe = probe.parentElement;
        guard++;
      }
      return null;
    }

    function _fcJumpClick(e) {
      const el0 = e.target;
      if (!el0?.closest) return;
      // ① 站内导航/卡片链接放行（非外服）
      if (el0.closest('a[href*="/equipment/"], a[href*="/equipment_"], a[href*="/summary/"], a[href*="/fashion_accessories/"], a[href*="/modern_aesthetics/"]')) return;
      // ② 已是灰机的链接放行
      const a = el0.closest('a');
      if (a && /huijiwiki\.com/i.test(a.getAttribute('href') || '')) return;
      // ③ 外服链接（Lodestone 等）→ 拦截改跳灰机
      const aHref = a ? (a.getAttribute('href') || '') : '';
      const isForeign = /lodestone|finalfantasyxiv\.com|garland|eriones|ffxivdb|gamerescape/i.test(aHref);
      const zh = _fcJumpResolve(el0, isForeign);
      if (!zh || !isForeign) return;
      e.preventDefault();
      e.stopPropagation();
      window.open(WIKI_ITEM + encodeURIComponent(zh), '_blank', 'noopener');
    }

    // 装备名点击 → 灰机 wiki（fc 站装备名多为纯文本/链接，统一兜底）
    function bindFCWikiJump() {
      if (window.__zhixiaFcJump) return;
      window.__zhixiaFcJump = true;
      document.addEventListener('click', _fcJumpClick, true);
    }

    // v1.12.6：横幅汉化 —— 左侧图区不遮，右侧文字区：原日文模糊(亚克力) + 中文双行
    // v1.12.8：武器页职业卡中文（slug → 职业·武器）
    const FC_WEAPON_CARDS = {
      gladiators_arm: '骑士·单手剑', shield: '骑士·盾',
      marauders_arm: '战士·大斧', dark_knights_arm: '暗黑骑士·双手剑',
      gunbreakers_arm: '绝枪战士·枪盾', skyltborg: '特殊职业',
      lancers_arm: '龙骑士·长枪', reapers_arm: '钐镰客·双手镰刀',
      pugilists_arm: '武僧·格斗武器', samurais_arm: '武士·刀',
      rogues_arm: '忍者·双剑', vipers_arm: '蝰蛇剑士·蝰蛇对剑',
      one_handed_axe: '单手斧',
      archers_arm: '吟游诗人·弓', machinists_arm: '机工士·火枪',
      dancers_arm: '舞者·投掷武器', evercoldranges_arm: '远敏职业',
      thaumaturges_arm: '黑魔法师·咒杖', arcanists_grimoire: '召唤师·魔导书',
      red_mages_arm: '赤魔法师·刺剑', pictomancers_arm: '绘灵法师·画笔',
      blue_mages_arm: '青魔法师·青魔法', conjurers_arm: '白魔法师·幻杖',
      scholars_arm: '学者·魔导书', astrologians_arm: '占星术士·天球仪',
      sages_arm: '贤者·咒杖',
    };

    const FC_BANNER_RULES = [
      { match: /banner_001|equipment_search_parts|部位ごと/i, zh: '部位分类' },
      { match: /banner_002|equipment_series_search|装備シリーズ/i, zh: '装备系列' },
      { match: /banner_003|fashion_accessories|ファッションアクセ/i, zh: '时尚配饰' },
      { match: /banner_004|hair_catalog|ヘアカタログ/i, zh: '发型图鉴' },
      { match: /banner_005|weapon_search|武器シリーズ/i, zh: '武器系列' },
    ];
    function fcBannerMatch(a, img) {
      const probe = ((img && (img.dataset.src || img.getAttribute('src') || img.getAttribute('title') || img.getAttribute('alt'))) || '') + ' ' + (a.getAttribute('href') || '');
      for (const r of FC_BANNER_RULES) if (r.match.test(probe)) return r;
      return null;
    }
    function bindFCBanners(rootArg) {
      let changed = false;
      const scope = localScope(rootArg);
      queryIn(scope, 'div.banner-wrap a').forEach((a) => {
        if (a.dataset.zhixiaBanner) return;
        const img = a.querySelector('img');
        if (!img) return;
        const rule = fcBannerMatch(a, img);
        if (!rule) return;
        a.dataset.zhixiaBanner = '1';
        changed = true;
        a.style.position = a.style.position || 'relative';
        a.style.display = a.style.display || 'block';
        a.style.overflow = 'hidden';
        const big = !!a.closest('.banner-wrap');
        const span = document.createElement('span');
        span.dataset.zhixiaBannerSpan = '1';
        if (big) {
          // 右侧文字区：亚克力（模糊日文）+ 中文双行
          span.style.cssText = 'position:absolute;top:0;bottom:0;right:0;width:42%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:linear-gradient(160deg,rgba(255,255,255,.34),rgba(255,255,255,.12));backdrop-filter:blur(7px) saturate(1.4);-webkit-backdrop-filter:blur(7px) saturate(1.4);border-left:1px solid rgba(255,255,255,.45);pointer-events:none;z-index:2;';
          const l1 = document.createElement('strong');
          l1.textContent = rule.zh;
          l1.style.cssText = 'font-size:20px;font-weight:900;letter-spacing:1px;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.65),0 0 14px rgba(0,0,0,.4);line-height:1.15;';
          const l2 = document.createElement('em');
          l2.textContent = '一览与搜索';
          l2.style.cssText = 'font-style:normal;font-size:12px;font-weight:700;letter-spacing:.5px;color:rgba(255,255,255,.95);text-shadow:0 1px 4px rgba(0,0,0,.6);';
          span.appendChild(l1); span.appendChild(l2);
        } else {
          // 小按钮：整块亚克力 + 中文
          span.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.14);backdrop-filter:blur(6px) saturate(1.3);-webkit-backdrop-filter:blur(6px) saturate(1.3);font-weight:800;font-size:12px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.75);pointer-events:none;z-index:2;';
          span.textContent = rule.zh;
        }
        a.appendChild(span);
      });
      // v1.12.8：武器页职业卡（26 张 SVG，文字为矢量路径无法改）→ 右侧叠中文
      queryIn(scope, 'li.weapon-banner-item a').forEach((a) => {
        if (a.dataset.zhixiaWeapon) return;
        const img = a.querySelector('img');
        if (!img) return;
        const href = a.getAttribute('href') || '';
        const mm = /weapon_search\/([a-z_0-9]+)\//.exec(href);
        if (!mm) return;
        const zh = FC_WEAPON_CARDS[mm[1]];
        if (!zh) return;
        a.dataset.zhixiaWeapon = '1';
        changed = true;
        a.style.position = 'relative';
        a.style.display = a.style.display || 'block';
        a.style.overflow = 'hidden';
        const sp = document.createElement('span');
        const parts = zh.split('·');
        sp.style.cssText = 'position:absolute;top:0;bottom:0;right:0;width:54%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;background:linear-gradient(160deg,rgba(255,255,255,.32),rgba(255,255,255,.1));backdrop-filter:blur(6px) saturate(1.4);-webkit-backdrop-filter:blur(6px) saturate(1.4);border-left:1px solid rgba(255,255,255,.4);pointer-events:none;z-index:2;';
        const b1 = document.createElement('strong');
        b1.textContent = parts[0];
        b1.style.cssText = 'font-size:13px;font-weight:900;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.75),0 0 10px rgba(0,0,0,.45);line-height:1.15;letter-spacing:.5px;';
        sp.appendChild(b1);
        if (parts[1]) {
          const b2 = document.createElement('em');
          b2.textContent = parts[1];
          b2.style.cssText = 'font-style:normal;font-size:10px;font-weight:700;color:rgba(255,255,255,.95);text-shadow:0 1px 3px rgba(0,0,0,.65);';
          sp.appendChild(b2);
        }
        a.appendChild(sp);
      });
      return changed;
    }

    function startFC() {
      safe(translateFCPage, 'FC 全扫')();
      safe(translateFCTitle, 'FC 标题')();
      bindFCWikiJump();
      safe(fixFCMenu, 'FC 菜单')();
      safe(bindFCBanners, 'FC 横幅')();
      observeLocal((nodes) => {
        for (const n of nodes) {
          safe(translateFCPage, 'FC 局部')(n);
          safe(fixFCMenu, 'FC 菜单')(n);
          safe(bindFCBanners, 'FC 横幅')(n);
        }
      }, 300);
      // 数据就绪补扫由 Site Adapter 统一登记（见 SITE_REGISTRY 的 onDataReady）
    }

  /* @phase15-module-order:sites/ffxiv-collection */
  /* @phase15-order-link:sites/ffxiv-collection<-sites/ff14-fc */


    /* ===================================================================== */
    /* =====================================================================
     * ffxivcollection.com（FFXIV ARMOURY COLLECTION，日文装备图鉴站）— 全站汉化
     * 界面/筛选器走 DICT_ACL；装备名单件走物品总表统一索引（日文→国服名，单条查找）；
     * 套装名按「系列・职能アタイア[RE]」组合规则生成（系列/职能词在 DICT_ACL）。
     * 站为 WordPress 服务端渲染（jQuery 增强），observer 覆盖筛选/懒加载。
     */

    const ACL_DECOR_HEAD = /^[\s\u00a0※◆■□●○▼▽☆★]+/;
    const ACL_DECOR_TAIL = /[\s\u00a0※◆■□●○▲△☆★]{1,64}$/;
    const ACL_SET_RE = /^(.+?)・(ディフェンダー|スレイヤー|ストライカー|スカウト|レンジャー|キャスター|ヒーラー)アタイア(RE|ＲＥ)?$/;

    // v1.2.x：四步链拆为子步骤（降认知复杂度）
    // ① 词典精确（含空白归一化回退）
    function _trACLExact(text, t0) {
      let hit = DICT_ACL[t0];
      if (!hit) {
        const norm = t0.replace(/[ \t\u00a0]+/g, ' ').trim();
        if (norm !== t0) hit = DICT_ACL[norm];
      }
      if (!hit) return null;
      const i = text.indexOf(t0);
      return text.slice(0, i) + hit + text.slice(i + t0.length);
    }

    // ② 套装名规则：系列・职能アタイア[RE] → （改良型）系列职能套装
    //    优先 lookupSeries（与主站系列表口径一致：方舟天使御敌），兜底 DICT_ACL 逐词
    function _trACLSet(text, t0) {
      const m = t0.match(ACL_SET_RE);
      if (!m) return null;
      const series = lookupSeries(m[1] + '・' + m[2])
        || ((DICT_ACL[m[1]] || m[1]) + (DICT_ACL[m[2]] || m[2]));
      const zh = (m[3] ? '改良型' : '') + series + '套装';
      const i = text.indexOf(t0);
      return text.slice(0, i) + zh + text.slice(i + t0.length);
    }

    // ③ 日文装备名（JP2ZH 对照表单条查找）
    // v1.2.1：判定前剥【…】标记（与 trFC 同修；「纯汉字+全角标记」名此前不查表）
    function _trACLItem(text, t0) {
      const core = (t0.replace(ACL_DECOR_HEAD, '').replace(ACL_DECOR_TAIL, '')).trim() || t0;
      const corep = core.replace(/【[^【】]*】/g, '').trim() || core;
      const isKana = /[\u3040-\u30ff]/.test(corep);
      const isKanji = /^[\u3005\u3006\u4e00-\u9fff]+$/.test(corep) && corep.length >= 2 && corep.length <= 30;
      if (!isKana && !isKanji) return null;
      const zh = lookupJp2Zh(core);
      if (!zh || zh === core) return null;
      const i = text.indexOf(t0);
      return text.slice(0, i) + zh + text.slice(i + t0.length);
    }

    // ④ 副本名（保留「Lv.NN 」前缀，查 ACL_CFC 表）
    function _trACLCfc(text, t0) {
      const mLv = t0.match(/^(Lv\.\d+ )(.+)$/);
      if (!mLv) return null;
      const zh = lookupAclCfc(mLv[2]);
      if (!zh || zh === mLv[2]) return null;
      const zhFull = mLv[1] + zh;
      const i = text.indexOf(t0);
      return text.slice(0, i) + zhFull + text.slice(i + t0.length);
    }

    function trACL(text) {
      if (!text) return text;
      const t0 = text.trim();
      if (!t0) return text;
      if (t0.length > 120) return text;
      const s1 = _trACLExact(text, t0);
      if (s1 !== null) return s1;
      const s2 = _trACLSet(text, t0);
      if (s2 !== null) return s2;
      const s3 = _trACLItem(text, t0);
      if (s3 !== null) return s3;
      const s4 = _trACLCfc(text, t0);
      if (s4 !== null) return s4;
      return text;
    }

    // 副本名单条查找：「日文名|中文名」表（DATA_TEXT.acl）
    function lookupAclCfc(ja) {
      if (!ja || typeof DATA_TEXT.acl !== 'string' || !DATA_TEXT.acl) return null;
      const key = '\n' + ja + '|';
      const at = DATA_TEXT.acl.indexOf(key);
      if (at < 0) return null;
      const s0 = at + 1 + ja.length + 1;
      const e0 = DATA_TEXT.acl.indexOf('\n', s0);
      const v = DATA_TEXT.acl.slice(s0, e0 < 0 ? undefined : e0).trim();
      return v || null;
    }

    const ACL_SKIP_SEL = 'script, style, noscript, textarea, ins, .adsbygoogle, [class*="ads-"], [id*="aswift"]';

    // ===== 装备名点击跳转灰机 wiki（v1.16.1）=====
    // 详情页单件装备名：div.item-name > p（套装名在 h2/h3，不标记）
    function markACLItem(node, translated) {
      if (!translated || translated.length > 50) return;
      const p = node.parentElement;
      if (p?.tagName !== 'P') return;
      const wrap = p.parentElement;
      if (!wrap?.classList?.contains('item-name')) return;
      // 排除部位名（<p class="region-name">頭防具</p>），只标记装备名
      if (p.classList.contains('region-name')) return;
      if (p.dataset.zhxItem === translated) return;
      p.dataset.zhxItem = translated;
      p.setAttribute('title', '点击查看灰机 wiki 物品页');
    }

    function ensureZhxItemStyle(id) {
      if (document.getElementById(id)) return;
      const st = document.createElement('style');
      st.id = id;
      st.textContent = '[data-zhx-item]{cursor:pointer;transition:text-decoration-color .15s}[data-zhx-item]:hover{text-decoration:underline;text-underline-offset:3px}';
      (document.head || document.documentElement).appendChild(st);
    }

    function bindZhxItemClick(flag) {
      if (window[flag]) return;
      window[flag] = true;
      document.addEventListener('click', (e) => {
        const el = e.target?.closest?.('[data-zhx-item]') ?? null;
        if (!el) return;
        const zh = el.dataset.zhxItem;
        if (!zh) return;
        e.preventDefault();
        e.stopPropagation();
        window.open(WIKI_ITEM + encodeURIComponent(zh), '_blank', 'noopener');
      }, true);
    }

    // 装备块的 The Lodestone 图标链接 → 灰机 wiki（图标 + 中文物品页）
    // 站点每个装备条目带 a.item-link-1（日服 Lodestone）与 a.item-link-2（MIRAPRI）。
    // 选择器只匹配 href 含 lodestone 的链接 → 替换后不再命中，天然幂等。
    // v1.2.x：子步骤拆出（降认知复杂度）
    function _aclItemNameEl(box) {
      for (const p of box.querySelectorAll('p')) if (!p.classList.contains('region-name')) return p;
      return null;
    }

    function _aclZhName(nameEl) {
      const cached = nameEl.dataset.zhxItem;
      if (cached) return cached;
      const t0 = (nameEl.textContent || '').trim();
      if (!t0) return null;
      const t1 = trACL(t0);
      if (!t1 || t1 === t0) return null;   // 未获得中文名则跳过（保守）
      return t1;
    }

    function _aclSwapIcon(a, zh) {
      a.setAttribute('href', WIKI_ITEM + encodeURIComponent(zh));
      a.setAttribute('title', '灰机 wiki：' + zh);
      const img = a.querySelector('img');
      if (img) {
        img.removeAttribute('loading');   // 原图 lazy，data URI 无需延迟（未滚动时懒加载不解码）
        img.setAttribute('src', ZHX_WIKI_ICON);
        img.setAttribute('alt', '灰机 wiki');
        img.style.width = '18px';
        img.style.height = '18px';
        img.style.objectFit = 'contain';
      }
      if (!a.querySelector('.zhx-wiki-text')) {
        const lb = document.createElement('span');
        lb.className = 'zhx-wiki-text';
        lb.textContent = '灰机 wiki';
        lb.style.cssText = 'margin-left:4px;font-size:12px;vertical-align:middle;color:inherit';
        a.appendChild(lb);
      }
    }

    function replaceACLLodestone(rootArg) {
      const links = queryIn(localScope(rootArg), 'a.item-link-1[href*="lodestone"]');
      for (const a of links) {
        const box = a.closest('.item-name');
        if (!box) continue;
        const nameEl = _aclItemNameEl(box);
        if (!nameEl) continue;
        const zh = _aclZhName(nameEl);
        if (!zh) continue;
        _aclSwapIcon(a, zh);
      }
    }

    function trimACLNode(node) {
      const raw = node.nodeValue;
      if (!raw?.trim()) return;
      const pe = node.parentElement;
      if (pe?.closest?.(ACL_SKIP_SEL)) return;
      const next = raw.trim() === 'of' && pe?.closest?.('#navigation')
        ? raw.replace('of', '/') : trACL(raw);
      if (next !== raw) {
        node.nodeValue = next;
        markACLItem(node, next);
      }
    }

    // v1.2.x：节点分派拆为子步骤（降认知复杂度）
    function _aclAcceptNode(n) {
      if (n.nodeType === 1) {
        if (SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
        if (n.closest?.(ACL_SKIP_SEL)) return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }

    function _trACLGearsetAlt(value) {
      const match = value.match(/^(.+?)'s gearset image(?: (female|male) model)?\.$/i);
      if (!match) return null;
      const setName = trACL(match[1]);
      if (setName === match[1] || /[ぁ-んァ-ヶー]/.test(setName)) return null;
      let model = '';
      if (match[2]) {
        const gender = match[2].toLowerCase() === 'female' ? '女性' : '男性';
        model = '（' + gender + '角色）';
      }
      return setName + '的装备展示图' + model;
    }
    function _trACLLabel(n, key) {
      const value = n.getAttribute(key);
      if (!value || value.length > 160) return;
      let translated = null;
      if (key === 'alt') translated = _trACLGearsetAlt(value);
      // Search-menu yes/no/male/female titles are UI controls, not general prose.
      if (key === 'title' && n.closest?.('#search-menu')) {
        const filterValues = { yes: '是', no: '否', male: '男性', female: '女性' };
        translated = filterValues[value.toLowerCase()] || null;
      }
      if (!translated) translated = trACL(value);
      if (translated !== value) n.setAttribute(key, translated);
    }
    function _procACLNode(n) {
      if (n.nodeType === 3) { trimACLNode(n); return; }
      if (!n.hasAttribute) return;
      if (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA') {
        const ph = n.getAttribute('placeholder');
        if (ph) { const nn = trACL(ph); if (nn !== ph) n.setAttribute('placeholder', nn); }
      }
      for (const key of ['title', 'aria-label', 'alt']) {
        if (n.hasAttribute(key)) _trACLLabel(n, key);
      }
    }

    function translateACLPage(rootArg) {
      if (rootArg?.nodeType === 3) { trimACLNode(rootArg); return; }
      const root = rootArg || document.body || document.documentElement;
      if (!root) return;
      _markScan(localScope(rootArg));   // v1.4.1：扫描计数（区分全页/局部）
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode: _aclAcceptNode,
      });
      const batch = [];
      while (w.nextNode()) batch.push(w.currentNode);
      for (const n of batch) _procACLNode(n);
      safe(replaceACLLodestone, 'ACL lodestone 替换')(rootArg);
    }

    function translateACLTitle() {
      const t = document.title;
      if (!t || !/[\u3040-\u30ff]/.test(t)) return;
      const parts = t.split('｜');
      const nt = parts.map((x) => trACL(x.trim())).join(' ｜ ');
      if (nt && nt !== t && nt.length <= 160) document.title = nt;
    }

    function startACL() {
      ensureZhxItemStyle('zhx-acl-item-style');
      bindZhxItemClick('__zhxAclItemBound');
      safe(translateACLPage, 'ACL 全扫')();
      safe(translateACLTitle, 'ACL 标题')();
      observeLocal((nodes) => {
        for (const n of nodes) safe(translateACLPage, 'ACL 局部')(n);
        safe(translateACLTitle, 'ACL 标题')();
      }, 300);
      // 数据就绪补扫由 Site Adapter 统一登记（见 SITE_REGISTRY 的 onDataReady）
    }

  /* @phase15-module-order:sites/ronka */
  /* @phase15-order-link:sites/ronka<-sites/ffxiv-collection */


    /* ===================================================================== */
    /* =====================================================================
     * ronka（lookbook.ronkacloset.com，韩语幻化站）— 全站汉化
     * 界面/染剂走 DICT_RONKA；装备名走物品总表统一索引（韩文→国服名）。
     * 站点为 Next.js SPA（React 拆文本节点、频繁重渲染），observer 覆盖
     * childList 与 characterData；翻译幂等（不含韩文即跳过）防循环。
     * ===================================================================== */

    const RONKA_SKIP_SEL = 'script, style, noscript, textarea, .zhx-skip';
    const RONKA_KR = /[\uac00-\ud7a3]/;

    // 装备名单条查找（缓存 + 名称索引直查）；_ronkaCacheN = 条目计数（容量防线用）
    const RONKA_ITEM_CACHE = Object.create(null);

    // 逐条翻译：UI/染剂精确 → "N-染剂" → 装备名 → "X아이콘" → 版本前缀 → 空白归一化
    // v1.2.x：子步骤拆出（降认知复杂度）——② 染剂 "N-名称"
    function _trRonkaDye(t0) {
      const m = t0.match(/^([1-9])-(.+)$/);
      if (!m) return null;
      const s = DICT_RONKA[m[2].trim()];
      if (!s) return null;
      return m[1] + '-' + s;
    }

    // ④ "X아이콘" 组合（img alt，如 "머리 방어구아이콘"）
    function _trRonkaIcon(t0) {
      if (t0.length <= 3 || t0.slice(-3) !== '아이콘') return null;
      const base = t0.slice(0, -3).trim();
      const bz = DICT_RONKA[base] || ronkaItemLookup(base);
      if (!bz) return null;
      return bz + '图标';
    }

    // ⑤ 补丁版本前缀
    function _trRonkaPatch(t0) {
      if (t0.indexOf('현재 적용된 패치 데이터 버전') !== 0) return null;
      return t0.replace('현재 적용된 패치 데이터 버전(KOR): ', '当前应用的补丁数据版本(KOR): ');
    }

    function trRonka(text) {
      if (!text) return text;
      const t0 = text.trim();
      if (!t0 || t0.length > 120) return text;
      const hasKR = RONKA_KR.test(t0);
      // ① 无韩文：仅查词典（GALLERY/GENERATOR/ABOUT/LOGIN/JOIN 等）
      if (!hasKR) return DICT_RONKA[t0] || text;
      let zh = DICT_RONKA[t0] || null;
      // ② 染剂 "N-名称"（如 "1-하얀눈색"；React 拆分时 "하얀눈색" 单独命中 ①）
      if (zh == null) zh = _trRonkaDye(t0);
      // ③ 装备名（韩文 → 国服名）
      if (zh == null) zh = ronkaItemLookup(t0);
      // ④ "X아이콘" 组合
      if (zh == null) zh = _trRonkaIcon(t0);
      // ⑤ 补丁版本前缀
      if (zh == null) zh = _trRonkaPatch(t0);
      // ⑥ 空白归一化回退
      if (zh == null) {
        const norm = t0.replace(/[ \t\u00a0]+/g, ' ');
        if (norm !== t0) zh = DICT_RONKA[norm] || null;
      }
      if (zh == null || zh === t0) return text;
      const i = text.indexOf(t0);
      return text.slice(0, i) + zh + text.slice(i + t0.length);
    }

    // ===== 装备名点击跳转灰机 wiki（v1.15.0）=====
    // 详情页装备名：div.item-searcher > div.post-item-information > p
    // React 会重渲染冲掉 DOM 改动，故用「打标记 + document 级 capture 点击委托」，
    // 不包裹 <a>（避免嵌套冲突与重渲染闪烁）；样式另注入一次。
    function markRonkaItem(node, translated) {
      if (!translated || translated.length > 40) return;
      const p = node.parentElement;
      if (p?.tagName !== 'P') return;
      const wrap = p.parentElement;
      if (!wrap?.classList?.contains('post-item-information')) return;
      if (p.dataset.zhxItem === translated) return;
      p.dataset.zhxItem = translated;
      p.setAttribute('title', '点击查看灰机 wiki 物品页');
    }

    // 装备块 lodestone（官方指南）链接 → 灰机 wiki（图标 + 中文物品页）
    // 选择器只匹配 href 含 lodestone 的 <a>，替换后不再匹配 → 天然幂等；
    // React 若恢复原 href 会自动再次命中重替换。装备中文名来自同块 [data-zhx-item]。
    function replaceRonkaLodestone(rootArg) {
      const links = queryIn(localScope(rootArg), '.post-search-modal a[href*="lodestone"]');
      for (const a of links) {
        const box = a.closest('.item-searcher');
        const itemEl = box?.querySelector('[data-zhx-item]');
        const zh = itemEl?.dataset?.zhxItem;
        if (!zh) continue;
        a.setAttribute('href', WIKI_ITEM + encodeURIComponent(zh));
        a.textContent = '';
        const img = document.createElement('img');
        img.src = ZHX_WIKI_ICON;
        img.alt = '';
        img.style.cssText = 'width:14px;height:14px;vertical-align:-2px;margin-right:4px;border-radius:3px';
        img.onerror = function () { this.style.display = 'none'; };
        a.appendChild(img);
        a.appendChild(document.createTextNode('灰机 wiki'));
      }
    }

    // 规则区整行翻译（about 页 rule-list：逐节点拼接会语序错位的行，整行替换）
    // 仅对命中词典的 li 生效；标记防重入，React 重渲染后韩文重现时会再次命中。
    const RONKA_RULE_FULL = {
      '반드시 파이널판타지14 게임 내 배경을 사용해야 합니다.': '必须使用最终幻想14游戏内背景。',
      '게시물 중 파이널판타지14 운영정책 제7.4항 에 해당하는 ‘홈페이지 제재 항목’ 대상의 경우 작성자에게 사전통지 없이 해당 게시물을 삭제할 수 있으며, 이를 작성한 계정은 경고 1회 후 게시글 삭제': '帖子中属于最终幻想14运营政策第 7.4 条「官网处罚事项」的，可在不事先通知作者的情况下删除该帖子，相关账号警告 1 次后删除帖子',
    };
    function translateRonkaRules() {
      const lis = queryIn(null, '.rule-list-wrap li, .rule-block-wrap li');   // v1.4.1：统一查询入口（全页调用）
      for (const li of lis) {
        if (li.dataset.zhxRule) continue;
        const key = (li.textContent || '').trim();
        if (!key || !RONKA_KR.test(key)) continue;
        const zh = RONKA_RULE_FULL[key];
        if (zh) { li.textContent = zh; li.dataset.zhxRule = '1'; }
      }
    }

    function trimRonkaNode(node) {
      const raw = node.nodeValue;
      if (!raw?.trim()) return;
      const p = node.parentElement;
      if (p?.closest?.(RONKA_SKIP_SEL)) return;
      const next = trRonka(raw);
      if (next !== raw) {
        node.nodeValue = next;
        markRonkaItem(node, next);
      }
    }

    // v1.2.x：节点分派拆为子步骤（降认知复杂度）
    function _ronkaAcceptNode(n) {
      if (n.nodeType === 1) {
        if (SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
        if (n.closest?.(RONKA_SKIP_SEL)) return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }

    function _ronkaInput(n) {
      const ph = n.getAttribute('placeholder');
      if (ph) { const nn = trRonka(ph); if (nn !== ph) n.setAttribute('placeholder', nn); }
    }

    function _ronkaImgAlt(n) {
      const alt = n.getAttribute('alt');
      if (alt && alt.length >= 2 && alt.length <= 90) {
        const nn = trRonka(alt);
        if (nn !== alt && !n.dataset.zhixiaRonkaAlt) { n.setAttribute('alt', nn); n.dataset.zhixiaRonkaAlt = '1'; }
      }
      const ti = n.getAttribute('title');
      if (ti) { const nn = trRonka(ti); if (nn !== ti) n.setAttribute('title', nn); }
    }

    function _ronkaAria(n) {
      const al = n.getAttribute('aria-label');
      if (al) { const nn = trRonka(al); if (nn !== al) n.setAttribute('aria-label', nn); }
    }

    function _procRonkaNode(n) {
      if (n.nodeType === 3) { trimRonkaNode(n); return; }
      if (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA') { _ronkaInput(n); return; }
      if (n.tagName === 'IMG' || n.hasAttribute('alt')) { _ronkaImgAlt(n); return; }
      if (n.hasAttribute?.('aria-label')) _ronkaAria(n);
    }

    function translateRonkaPage(rootArg) {
      if (rootArg?.nodeType === 3) { trimRonkaNode(rootArg); return; }
      if (!rootArg) safe(translateRonkaRules, 'Ronka 规则整行')();
      const root = rootArg || document.body || document.documentElement;
      if (!root) return;
      _markScan(localScope(rootArg));   // v1.4.1：扫描计数（区分全页/局部）
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode: _ronkaAcceptNode,
      });
      const batch = [];
      while (w.nextNode()) batch.push(w.currentNode);
      for (const n of batch) _procRonkaNode(n);
      safe(replaceRonkaLodestone, 'Ronka lodestone 替换')(rootArg);
    }

    function translateRonkaTitle() {
      const t = document.title;
      if (!t || !RONKA_KR.test(t)) return;
      const nt = trRonka(t);
      if (nt && nt !== t && nt.length <= 120) document.title = nt;
    }

    function startRonka() {
      ensureZhxItemStyle('zhx-ronka-item-style');
      bindZhxItemClick('__zhxRonkaItemBound');
      safe(translateRonkaPage, 'Ronka 全扫')();
      safe(translateRonkaTitle, 'Ronka 标题')();
      // v1.4 Phase 7：经统一观察器（本站必须保留 characterData——韩文文本变更很常见）
      createObserver({
        root: document.documentElement,
        characterData: true,
        filter: (m) => !!(m.target?.nodeValue && RONKA_KR.test(m.target.nodeValue)),
        debounce: 120,
        handler: (nodes) => {
          for (const n of nodes) safe(translateRonkaPage, 'Ronka 局部')(n);
          safe(translateRonkaTitle, 'Ronka 标题')();
        },
      });
      // 数据就绪补扫由 Site Adapter 统一登记（见 SITE_REGISTRY 的 onDataReady）
      console.log('Ronka（韩服幻化站）汉化已启用');
    }

  /* @phase15-module-order:core/constants */
  /* @phase15-order-link:core/constants<-sites/ronka */


    /* =====================================================================
     * 第四部分：装备名 / 染剂名 → 国服中文名 + 国服 wiki 物品页
     * 对照数据以四语 datamining（中/英/日/韩）为权威源融合生成，以纯文本
     * 数据文件（非可执行代码）托管在 zhixia-data.pages.dev；
     * 按站点所需下载，并按版本缓存于用户脚本管理器本地存储（跨站共享、
     * 每日至多检查一次更新）。脚本只读数据，不上传任何用户信息。
     * 两站装备链接都带 class="eorzeadb_link"、href 内含 Lodestone hash：
     * 优先用 hash 精确匹配，退化用日文名 / 英文名匹配。
     * ===================================================================== */

    // 灰机 wiki 物品页前缀；灰机 favicon 48×48（data URI 内嵌，用于把外服
    // 链接图标替换为灰机 wiki 标识，免外部请求；图标版权归灰机 wiki）
    const WIKI_ITEM = 'https://ff14.huijiwiki.com/wiki/物品:';
    const ZHX_WIKI_ICON = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBwgHBgkIBwgKCgkLDRYPDQwMDRsUFRAWIB0iIiAdHx8kKDQsJCYxJx8fLT0tMTU3Ojo6Iys/RD84QzQ5OjcBCgoKDQwNGg8PGjclHyU3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3N//AABEIADAAMAMBIgACEQEDEQH/xAAZAAEAAwEBAAAAAAAAAAAAAAAGBAUHAQL/xAAzEAACAgEDAQUFBwUBAAAAAAABAgMEEQAFEiEGIjFBURMyYYGRByNSYnFygkNzobHwFP/EABgBAAMBAQAAAAAAAAAAAAAAAAECBAAD/8QAGBEBAQEBAQAAAAAAAAAAAAAAAQARAiH/2gAMAwEAAhEDEQA/ANt1G3C2KVYy8eb+CIDjk3pqTo5dtx293ljZvu6zCFfjIVLNj9Bj6HQJaBbs3rmRatyxA/06zGMD+Q7x+uo0cTw9YLd2J/HmLLt9QxIPzGp3cECSP4zHu9PX/v8Aeo9d45LVuJ2UCDALZwOoGmyR2tdr3qY246t7DrNkRTKvHvAZ4sPiM4Pwx6aQaGKP/VBdiiKhoXZYm/C4AIPyYf40r220t7b61tfdniWQD0yM6CTlW7jv61Z5q8VG1NNF48AuOo6HGc4+OPI6FRWLkd2hBaRRK80s2A2e8R3ifMe8x6+un+8bRV3aAx2AySBSEnibhJHn8LDqNZlYWLYphRbcGuHb7Ucft5GIdY2J7pHUEAs4z+X4DS+7N5ke3/7S60FmCpFHYElGxIko4gBsEr0OfTOuW/tK7PiGBKkd9mCL7ZmiUc2D8yfe8yT9dOOwNKluT7jblgjaSK6WVSoPRk5D9R94300it7r2epyPHOIOUZIfjVL8SPHJCnQewYnOnlkEn2k7PGZlqi8FkjZuZRQTMVUBiOXhkHWw9gr62+ztOD2cqyVq8aSF1wpPHyPnon2p2+lvHaijtu3mNDZj5SvGgIwwB5fJUHT851pNWCKpWir10VIolCoqjAAGjsre5kaSJ0WRo2YEB1xlfiM9NDt17BU3pyrQkMUjxhXeVsmTvFmZm8z1Ok+57tR2uNWuzhC2eEags8mPHioyT8hqukDbtD7S+QlIjpUVslv7hHj+0dPXOsuWDY/2d2oUqXOlbYL7UvWmQdGjwBgg+8pIJx8ehHjqVboxzE2JqNU3HYcpDM4iLeAYx+f7fPoM+erCbmziRPeGe74Aj01wcZQpKnAOeLdCCPUan6dao5wqnsT2f5XG36zalksNLIEDY93LghunqSemnOicNavHJLPAJ6ztI3I1nKmQ+vHwJznxGrKM74kYlE1WXrn2E0fFsenNTjP8ca66NP1w8t//2Q==';

    /* @zhixia:data-layer-start */
    /* ── 外置数据版（Greasy Fork 发布版）：按需下载 + 版本化本地缓存 ──
       内嵌自用版构建链已退役（v1.4），仅维护本外置版。 */
    /* @zhixia:core-constants-start */
    /* ── Core Constants（v1.4 Phase 4）：数据源与网络契约（V3 数据端点，https）。Phase 15 模块化构建时，本区段将原样抽出为
         src/core/constants.js。 */
    const DATA_REMOTE = true;
    const DATA_BASE_V3 = 'https://zhixia-data.pages.dev/ff14/v3/';
    /* @zhixia:core-constants-end */

  /* @phase15-module-order:core/data-manager */
  /* @phase15-order-link:core/data-manager<-core/constants */


    /* ── 数据就绪广播（外置版 / 内嵌版共用）────────────────────────────
       外置版：数据异步到达并建表后触发；内嵌版：建表完成时触发。
       需要等数据就绪的补扫 / 刷新，通过 onTablesReady(fn) 登记。 */
    // 数据版本（外置版由加载器在版本清单到达后赋值；内嵌版保持空 = 随脚本版本）
    let DATA_VER = ''; // NOSONAR — 数据版本由远程 manifest 生命周期更新
    const DATA_REFRESH_EPOCH_KEY = 'zhx.data.refresh.epoch';
    const DATA_REFRESH_EPOCH = 'v3-only-1-force-refresh';
    let _forceDataRefresh = false;
    let _forceDataClearSucceeded = false;
    let _forceDataCacheWritesOk = true;
    let _manifestRefreshRequested = false;
    let _manifestNeedsCommit = false;
    let _manifestRejected = false;

    const _readyCbs = [];
    let _tablesReady = false; // NOSONAR — ready 状态由数据完成生命周期更新
    function onTablesReady(fn) {
      if (typeof fn !== 'function') return;
      if (_tablesReady) { try { fn(); } catch (e) { _zhxErr('readyCb', e); } return; }
      _readyCbs.push(fn);
    }
    function _fireTablesReady() {
      if (_tablesReady) return;
      _tablesReady = true;
      // 清空「查不到」负缓存与派生缓存：外置版中数据到达前生成的结果必须作废
      //（新增缓存时在 Core Cache Registry 登记即被本处按类清理，勿在此手工追加）
      try { cacheReset('lookup'); } catch (e) { /* 忽略：单类缓存清理失败不阻断其余 */ }
      try { cacheReset('translate'); } catch (e) { /* 忽略：单类缓存清理失败不阻断其余 */ }
      try { cacheReset('derived'); } catch (e) { /* 忽略：单类缓存清理失败不阻断其余 */ }
      const cbs = _readyCbs.splice(0);
      for (const f of cbs) { try { f(); } catch (e) { _zhxErr('readyCb', e); } }
      __zhxMark('fireDone');   // Phase 19：就绪广播完成
    }
    // （站点 → 数据表/索引/页面入口配置：见下方「Site Registry」单一配置源）
    let SERIES_TEXT = '';
    let ACL_CFC_TEXT = '';
    const DATA_TEXT = {
      get series() { return SERIES_TEXT; },
      get acl() { return ACL_CFC_TEXT; },
    };


    const itemHash = Object.create(null);   // hash -> 中文名（EC / mirapri 用） // NOSONAR
    const ecidMap = Object.create(null);    // 中文名 -> EC_ID（wiki / EC 链接用） // NOSONAR
    const nameMap = Object.create(null);    // 英/日/韩名 -> 中文名（含染剂色名回退；各站共用） // NOSONAR
    const koByZh = Object.create(null);     // 中文名 -> 韩文名（ronka 反查用） // NOSONAR

    // （EC 装备 ID 单条查找已并入 Item Resolver：resolveEcId，v1.4 Phase 10）
    function _replaceMap(target, source) {
      for (const k of Object.keys(target)) delete target[k];
      if (source && typeof source === 'object') Object.assign(target, source);
    }

    /* @zhixia:core-data-manager-start */
    /* V3 manifest、缓存、ready 广播与 dataManager API。 */
    let _ensurePromise = null; // NOSONAR — ensure 生命周期 promise 可被 invalidate 重置
    // V3 文件由 _applyV3 直接建立索引。无论网络或清单是否失败，Finalize 都会释放站点等待回调。
    const _dlStats = { cache: 0, net: 0, fallback: 0 };
    function _ensureFinalize() {
      __zhxMark('finalize');
      try { _fireTablesReady(); } catch (e) { _zhxErr('fireReady', e); }
      __zhxMark('ready');
      return Promise.resolve();
    }

    // ── Runtime Data v3（v1.4 Phase 12）：按站最小数据 + manifest ——
    // 只加载 V3；失败时保留空物品索引，并继续广播就绪。
    // v3 文件清单/格式由 build/make-runtime-data.py 生成（生成器侧已完成首行胜、
    // 染剂回退展开、'-' 行跳过等语义等价处理；此处直接建索引一次赋值）。
    // 缓存：manifest（zhx.v3.manifest = t + '\n' + 原文）；文件（zhx.v3.f.<site>.<name>
    // = sha256 + '\n' + 文本）。sha256 校验在 crypto.subtle 可用时执行，不可用不阻塞。

    // 「键\t值...」文本 → 映射（多值模式收集为数组；行内/键首列已由生成器去重）
    function _v3Pairs(txt, multi) {
      const m = Object.create(null);
      // 多值收集拆为局部函数（仅降复杂度；判定与产物不变）
      const collectMulti = (d, parts) => {
        for (let i = 1; i < parts.length; i++) { if (parts[i] && !d.includes(parts[i])) d.push(parts[i]); }
      };
      for (const ln of String(txt).split('\n')) {
        if (!ln) continue;
        const p = ln.split('\t');
        if (!p[0]) continue;
        if (multi) {
          if (!m[p[0]]) m[p[0]] = [];
          collectMulti(m[p[0]], p);
        } else if (p[1] !== undefined && m[p[0]] === undefined) {
          m[p[0]] = p[1];
        }
      }
      return m;
    }

    // names 文本 → {原生名: 候选允许标记('1'/'0'/'')}——行级、首见记录。
    // 仅用于智能候选：只有明确允许的装备、时尚配饰、鸟甲进入倒排。
    function _v3Glam(txt, requireFlags = false) {
      const m = Object.create(null);
      let sawRow = false;
      for (const ln of String(txt || '').split('\n')) {
        if (!ln) continue;
        const p = ln.split('\t');
        if (!p[0]) continue;
        if (requireFlags && (p[2] === undefined || !['0', '1'].includes(p[2].trim()))) return null;
        if (p[2] === undefined) continue;
        sawRow = true;
        if (m[p[0]] === undefined) m[p[0]] = p[2].trim();
      }
      return requireFlags && !sawRow ? null : m;
    }

    // names 第四列为 EquipSlotCategory 派生的展示组（0头 1身 2手 3腿 4脚 5其余）。
    // 旧 V3 文件只有前三列，全部归入其余，绝不从译名猜测分类。
    function _v3SearchSlots(txt) {
      const slots = Object.create(null);
      for (const ln of String(txt || '').split('\n')) {
        if (!ln) continue;
        const p = ln.split('\t');
        if (p.length < 4 || !p[0] || slots[p[0]] !== undefined) continue;
        if (/^[0-4]$/.test(p[3])) slots[p[0]] = Number(p[3]);
      }
      return slots;
    }

    // V3 数据直接映射为运行时索引；模块内状态由本 IIFE 共享。
    function _applyV3(files) {
      // 取值包装拆为局部函数（仅降复杂度；取值顺序与语义不变）
      const take = (key, multi) => (files[key] ? _v3Pairs(files[key], multi) : null);
      try {
        const names = take('names') || Object.create(null);
        const requireCandidateFlags = files.candidatePolicy === 1 && typeof files.names === 'string';
        const glam = _v3Glam(files.names, requireCandidateFlags);
        if (requireCandidateFlags && !glam) return false;
        const hash = take('hash') || Object.create(null);
        const ecid = take('ecid') || Object.create(null);
        const ko = take('ko') || Object.create(null);
        const ali = take('alias', true) || Object.create(null);
        const dup = take('dup', true) || Object.create(null);
        _replaceMap(nameMap, names);
        _replaceMap(itemHash, hash);
        _irSearchByZh = null;
        _irSearchKind = null;
        _irSearchCanonicalKeys = null;
        _irSearchAliasKeys = null;
        _replaceMap(ecidMap, ecid);
        _replaceMap(koByZh, ko);
        _irAliasMap = ali;
        _irDupMap = dup;
        _irGlamMap = glam || Object.create(null);
        _irSearchSlotByNative = _v3SearchSlots(files.names);
        _irCandidatePolicy = files.candidatePolicy === 1 ? 1 : 0;
        SERIES_TEXT = files.series ? '\n' + files.series : '';
        ACL_CFC_TEXT = files.acl ? '\n' + files.acl : '';
        if (files.dict) applyRuntimeDict(files.dict);
        return true;
      } catch (e) {
        _zhxErr('v3apply', e);
        return false;
      }
    }

    async function _v3ReadCachedFile(key, fingerprint) {
      try {
        const raw = await storeGetAsync(key);
        if (!raw) return null;
        const split = raw.indexOf('\n');
        return split > 0 && raw.slice(0, split) === fingerprint ? raw.slice(split + 1) : null;
      } catch (e) {
        _zhxErr('v3cacheRead', e);
        return null; // 缓存损坏时继续尝试网络下载。
      }
    }

    async function _v3VerifyFile(text, fingerprint) {
      if (!fingerprint || typeof crypto === 'undefined' || !crypto?.subtle || typeof TextEncoder !== 'function') return true;
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        const actual = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
        return actual === fingerprint;
      } catch (e) {
        _zhxErr('v3verify', e);
        return false; // A failed SHA-256 operation must never count as a verified download.
      }
    }

    async function _v3WriteFileCache(key, value, force) {
      if (force) {
        const ok = await storeSetAsync(key, value);
        if (!ok) _forceDataCacheWritesOk = false;
        return ok;
      }
      const ok = await storeSetAsync(key, value);
      return ok;
    }

    async function _v3FindCachedFile(baseKey, fingerprint) {
      let cached = await _v3ReadCachedFile(baseKey + '.' + fingerprint, fingerprint);
      if (cached === null) cached = await _v3ReadCachedFile(baseKey, fingerprint);
      return cached !== null && await _v3VerifyFile(cached, fingerprint) ? cached : null;
    }

    // V3 单文件缓存按站点、文件名和 SHA-256 指纹寻址；旧无指纹 key 只读兼容。
    async function _v3FetchFile(siteId, name, meta, force = false, staged = null, networkAllowed = true) {
      if (!meta?.url || !/^[a-f0-9]{64}$/i.test(meta.sha256 || '')) return null;
      const baseKey = 'zhx.v3.f.' + siteId + '.' + name;
      const key = baseKey + '.' + meta.sha256;
      const cached = force ? null : await _v3FindCachedFile(baseKey, meta.sha256);
      if (cached !== null) {
        _dlStats.cache++;
        if (staged) staged.set(key, meta.sha256 + '\n' + cached);
        return cached;
      }
      if (!networkAllowed) return null;
      let text = null;
      try { text = await httpGet(DATA_BASE_V3 + meta.url, 25000, force ? { fresh: true } : undefined); }
      catch (e) { text = null; /* 请求失败返回 null，由更新流程选择重试或其他数据通道 */ }
      if (typeof text !== 'string' || !text) return null;
      if (!await _v3VerifyFile(text, meta.sha256)) return null;
      _dlStats.net++;
      if (staged) staged.set(key, meta.sha256 + '\n' + text);
      else await _v3WriteFileCache(key, meta.sha256 + '\n' + text, force);
      return text;
    }

    // v3 manifest 读取链（PR#16 审查：自 _ensureTryV3 提升为模块级，纯 IO 无外部捕获）。
    // 缓存 manifest 读取（读取/解析失败视为无缓存；返回 {manT, man}）
    async function readCachedManifest(siteId = '') {
      try {
        const key = siteId ? 'zhx.v3.manifest.' + siteId : 'zhx.v3.manifest';
        const mraw = await storeGetAsync(key);
        if (mraw) {
          const i = mraw.indexOf('\n');
          if (i > 0) return { manT: Number(mraw.slice(0, i)) || 0, man: JSON.parse(mraw.slice(i + 1)) };
        }
      } catch (e) { _zhxErr('v3manifest', e); }
      return { manT: 0, man: null };
    }

    // 网络刷新 manifest（每日至多一次探测路径；失败返回 null）
    function _validV3Manifest(man) {
      if (man?.schema !== 3 || ![0, 1].includes(man.candidatePolicy) || !man.sites || typeof man.sites !== 'object') return false;
      const validFile = (meta) => typeof meta?.url === 'string' && /^[a-f0-9]{64}$/i.test(meta?.sha256 || '');
      for (const site of Object.values(man.sites)) {
        if (!site?.files || typeof site.files !== 'object') return false;
        for (const meta of Object.values(site.files)) if (!validFile(meta)) return false;
      }
      if (man.shared?.dict && !validFile(man.shared.dict)) return false;
      return true;
    }

    async function fetchManifest(force = false) {
      _manifestNeedsCommit = false;
      _manifestRejected = false;
      let txt = null;
      try { txt = await httpGet(DATA_BASE_V3 + 'manifest.json', 10000, force ? { fresh: true } : undefined); }
      catch (e) { txt = null; /* 请求失败时由 loadManifest 决定是否复用旧清单 */ }
      if (typeof txt !== 'string' || !txt) return null;
      try {
        const manifest = JSON.parse(txt);
        if (_validV3Manifest(manifest)) { _manifestNeedsCommit = true; return manifest; }
      } catch (e) { /* manifest 解析或 schema/policy 校验失败 */ }
      _manifestRejected = true;
      return false;
    }

    // 缓存优先 → 必要时网络（站点是否在列由 _ensureTryV3 统一判断）
    async function loadManifest(force = false, refresh = false) {
      _manifestNeedsCommit = false;
      if (force) return await fetchManifest(true);
      const c = await readCachedManifest();
      const fresh = !!(c.manT && (Date.now() - c.manT < DAY_MS));
      const valid = _validV3Manifest(c.man);
      if (!refresh && valid && fresh && c.man.candidatePolicy === 1) return c.man;
      const latest = await fetchManifest();
      if (latest === false) return null;
      if (latest) return latest;
      return valid ? c.man : null;
    }

    // 站点文件并行获取（含共享词库）
    async function fetchStationFiles(siteId, names, sm, sharedDict, force = false, staged = null, networkAllowed = true) {
      const files = {};
      const jobs = names.map((n) => _v3FetchFile(siteId, n, sm[n], force, staged, networkAllowed)
        .then((t) => { files[n] = t; }, () => { files[n] = null; }));
      if (sharedDict) {
        jobs.push(_v3FetchFile(siteId, 'dict', sharedDict, force, staged, networkAllowed)
          .then((t) => { files.dict = t; }, () => { files.dict = null; }));
      }
      await Promise.all(jobs);
      return files;
    }

    function allFilesReady(names, files, sharedDict) {
      for (const n of names) { if (files[n] == null) return false; }
      return !(sharedDict && files.dict == null);
    }

    function _requiredV3Files(site) {
      const required = [];
      if (site.indexes?.includes('nameMap')) required.push('names', 'alias', 'dup');
      if (site.indexes?.includes('itemHash')) required.push('hash');
      if (site.indexes?.includes('ecidMap')) required.push('ecid');
      if (site.indexes?.includes('koByZh')) required.push('ko');
      if (site.tables?.includes('series')) required.push('series');
      if (site.tables?.includes('acl')) required.push('acl');
      return required;
    }

    // v3 主流程：manifest（24h 缓存）→ 站点文件（缓存优先）→ 应用。
    // 任何一步失败或缺文件均返回 false；调用方保持安全空索引。
    async function _commitV3Bundle(staged, manifest, siteId, force, commitSnapshot, commitManifest) {
      for (const [key, value] of staged) {
        if (!await _v3WriteFileCache(key, value, force)) return false;
      }
      const value = String(Date.now()) + '\n' + JSON.stringify(manifest);
      if (commitSnapshot && !await storeSetAsync('zhx.v3.manifest.' + siteId, value)) {
        if (force) _forceDataCacheWritesOk = false;
        return false;
      }
      if (commitManifest && !await storeSetAsync('zhx.v3.manifest', value)) {
        if (force) _forceDataCacheWritesOk = false;
        return false;
      }
      return true;
    }

    function _v3SiteCacheKeepKeys(siteId, manifest) {
      const keys = new Set();
      const files = manifest?.sites?.[siteId]?.files || {};
      for (const [name, meta] of Object.entries(files)) {
        if (meta?.sha256) keys.add('zhx.v3.f.' + siteId + '.' + name + '.' + meta.sha256);
      }
      const dict = manifest?.shared?.dict;
      if (dict?.sha256) keys.add('zhx.v3.f.' + siteId + '.dict.' + dict.sha256);
      return keys;
    }

    function _v3SiteCacheStaleFromList(siteId, keep, listed) {
      const prefix = 'zhx.v3.f.' + siteId + '.';
      return new Set(listed.filter((key) => key.startsWith(prefix) && !keep.has(key)));
    }

    function _v3SiteCacheStaleFromManifest(siteId, previousManifest, currentManifest) {
      const stale = new Set();
      const oldFiles = previousManifest?.sites?.[siteId]?.files || {};
      const currentFiles = currentManifest?.sites?.[siteId]?.files || {};
      for (const [name, meta] of Object.entries(oldFiles)) {
        const current = currentFiles[name];
        if (current && current.sha256 === meta?.sha256) continue;
        stale.add('zhx.v3.f.' + siteId + '.' + name);
        if (meta?.sha256) stale.add('zhx.v3.f.' + siteId + '.' + name + '.' + meta.sha256);
      }
      const oldDict = previousManifest?.shared?.dict;
      const currentDict = currentManifest?.shared?.dict;
      if (oldDict?.sha256 && oldDict.sha256 !== currentDict?.sha256) {
        stale.add('zhx.v3.f.' + siteId + '.dict.' + oldDict.sha256);
      }
      return stale;
    }

    async function _pruneV3SiteCache(siteId, previousManifest, currentManifest) {
      const keep = _v3SiteCacheKeepKeys(siteId, currentManifest);
      let listed = null;
      try { listed = await storeListAsync(); } catch (e) { listed = null; }
      const stale = Array.isArray(listed)
        ? _v3SiteCacheStaleFromList(siteId, keep, listed)
        : _v3SiteCacheStaleFromManifest(siteId, previousManifest, currentManifest);
      await Promise.all([...stale].map((key) => storeDeleteAsync(key)));
    }

    function _manifestSiteFiles(manifest, site, need) {
      const sm = manifest?.sites?.[site.id]?.files;
      if (!sm || typeof sm !== 'object') return null;
      const names = Object.keys(sm);
      const required = _requiredV3Files(site);
      if (!names.length || required.some((name) => !sm[name])) return null;
      const sharedDict = (need.includes('dict') && manifest.shared?.dict) || null;
      if (need.includes('dict') && !sharedDict) return null;
      return { sm, names, sharedDict };
    }

    async function _readPreviousV3Manifest(siteId) {
      const siteSnapshot = await readCachedManifest(siteId);
      const globalSnapshot = await readCachedManifest();
      const siteSnapshotValid = _validV3Manifest(siteSnapshot.man);
      const previous = siteSnapshotValid ? siteSnapshot : globalSnapshot;
      return { siteSnapshot, siteSnapshotValid, globalSnapshot, previous, previousValid: _validV3Manifest(previous.man) };
    }

    async function _selectV3Manifest(force, refreshManifest, snapshots) {
      let manifest = await loadManifest(force, refreshManifest);
      const { siteSnapshot, siteSnapshotValid, globalSnapshot } = snapshots;
      const pinnedNewer = siteSnapshotValid && siteSnapshot.manT > globalSnapshot.manT;
      const canUseSiteCache = !force && !_manifestRejected && siteSnapshotValid;
      if (canUseSiteCache && (!manifest || (pinnedNewer && !_manifestNeedsCommit))) manifest = siteSnapshot.man;
      return _validV3Manifest(manifest) && (!force || manifest.candidatePolicy === 1) ? manifest : null;
    }

    async function _tryV3Bundle(site, manifest, need, force, staged, networkAllowed) {
      const selected = _manifestSiteFiles(manifest, site, need);
      if (!selected) return null;
      const files = await fetchStationFiles(site.id, selected.names, selected.sm, selected.sharedDict, force, staged, networkAllowed);
      if (!allFilesReady(selected.names, files, selected.sharedDict)) return null;
      files.candidatePolicy = manifest.candidatePolicy;
      return _applyV3(files) ? { files } : null;
    }

    async function _tryV3WithCachedFallback(site, manifest, need, force, snapshots, staged) {
      let loaded = await _tryV3Bundle(site, manifest, need, force, staged, true);
      if (loaded || force || !snapshots.previousValid) return { loaded, manifest };
      staged.clear();
      loaded = await _tryV3Bundle(site, snapshots.previous.man, need, false, null, false);
      if (!loaded) return { loaded: null, manifest };
      _dlStats.fallback++;
      return { loaded, manifest: snapshots.previous.man };
    }

    async function _commitV3Selection(siteId, manifest, snapshots, force, staged) {
      const snapshotNewer = snapshots.siteSnapshotValid
        && snapshots.siteSnapshot.manT > snapshots.globalSnapshot.manT;
      const commitSnapshot = force || _manifestNeedsCommit || !snapshots.siteSnapshotValid
        || (!snapshotNewer && snapshots.siteSnapshot.man?.version !== manifest.version);
      const committed = await _commitV3Bundle(staged, manifest, siteId, force, commitSnapshot, _manifestNeedsCommit);
      if (committed) await _pruneV3SiteCache(siteId, snapshots.previous.man, manifest);
      return committed;
    }

    async function _ensureTryV3(force = false, refreshManifest = false) {
      const site = findSite();
      if (!site?.id) return false;
      try {
        const snapshots = await _readPreviousV3Manifest(site.id);
        const manifest = await _selectV3Manifest(force, refreshManifest, snapshots);
        if (!manifest) return false;
        const staged = new Map();
        const result = await _tryV3WithCachedFallback(site, manifest, neededTables(), force, snapshots, staged);
        if (!result.loaded) return false;
        if (result.manifest === manifest) await _commitV3Selection(site.id, manifest, snapshots, force, staged);
        if (result.manifest.version) DATA_VER = String(result.manifest.version);
        return true;
      } catch (e) {
        _zhxErr('v3', e);
        return false;
      }
    }



    // 旧缓存键只在此处保留，用于 V3 一次性迁移清理。
    const LEGACY_META_KEY = 'zhx.meta';
    const LEGACY_DT_PREFIX = 'zhx.dt.';
    function _isDataCacheKey(key) {
      return key === LEGACY_META_KEY || key === 'zhx.v3.manifest' || key.startsWith('zhx.v3.manifest.')
        || key === 'zhx.candidate.policy' || key.startsWith(LEGACY_DT_PREFIX) || key.startsWith('zhx.v3.f.');
    }

    function _knownDataCacheKeys() {
      const keys = new Set([LEGACY_META_KEY, 'zhx.v3.manifest', 'zhx.candidate.policy']);
      for (const siteId of ['mirapri', 'ec', 'fc', 'ronka', 'collection', 'wiki', 'endcloset']) {
        keys.add('zhx.v3.manifest.' + siteId);
      }
      for (const name of ['items', 'series', 'acl', 'dict']) keys.add(LEGACY_DT_PREFIX + name);
      const sites = ['mirapri', 'ec', 'fc', 'ronka', 'collection', 'wiki', 'endcloset'];
      const files = ['names', 'hash', 'alias', 'dup', 'ecid', 'ko', 'series', 'acl', 'dict'];
      for (const site of sites) for (const file of files) keys.add('zhx.v3.f.' + site + '.' + file);
      return keys;
    }

    function _addSiteManifestCacheKeys(keys, siteId, site, sharedDictHash) {
      for (const [name, meta] of Object.entries(site.files || {})) {
        const base = 'zhx.v3.f.' + siteId + '.' + name;
        keys.add(base);
        if (meta?.sha256) keys.add(base + '.' + meta.sha256);
      }
      if (sharedDictHash) keys.add('zhx.v3.f.' + siteId + '.dict.' + sharedDictHash);
    }

    function _addManifestCacheKeys(keys, manifest) {
      if (!_validV3Manifest(manifest)) return;
      const sharedDictHash = manifest.shared?.dict?.sha256;
      for (const [siteId, site] of Object.entries(manifest.sites)) {
        _addSiteManifestCacheKeys(keys, siteId, site, sharedDictHash);
      }
    }

    async function _readCachedManifests() {
      const sites = ['mirapri', 'ec', 'fc', 'ronka', 'collection', 'wiki', 'endcloset'];
      return Promise.all([readCachedManifest(), ...sites.map((siteId) => readCachedManifest(siteId))]);
    }

    async function _clearDataCaches() {
      let listed = null;
      try { listed = await storeListAsync(); } catch (e) { listed = null; }
      const keys = _knownDataCacheKeys();
      for (const stored of await _readCachedManifests()) _addManifestCacheKeys(keys, stored.man);
      if (Array.isArray(listed)) {
        for (const key of listed) if (_isDataCacheKey(key)) keys.add(key);
      }
      const results = await Promise.all([...keys].map((key) => storeDeleteAsync(key)));
      return results.every(Boolean);
    }

    async function _prepareDataRefresh() {
      let epoch = null;
      try { epoch = await storeGetAsync(DATA_REFRESH_EPOCH_KEY); } catch (e) { epoch = null; }
      if (epoch === DATA_REFRESH_EPOCH) {
        _forceDataClearSucceeded = true;
        _forceDataCacheWritesOk = true;
        return false;
      }
      _forceDataRefresh = true;
      _forceDataCacheWritesOk = true;
      _forceDataClearSucceeded = await _clearDataCaches();
      return true;
    }

    async function _completeDataRefresh() {
      if (!_forceDataClearSucceeded || !_forceDataCacheWritesOk) return false;
      const stored = await storeSetAsync(DATA_REFRESH_EPOCH_KEY, DATA_REFRESH_EPOCH);
      if (stored) _forceDataRefresh = false;
      return stored;
    }

    async function _ensureMain() {
      _irCandidatePolicy = 0;
      _forceDataRefresh = await _prepareDataRefresh();
      if (!neededTables().length) return;
      const refreshManifest = _manifestRefreshRequested;
      _manifestRefreshRequested = false;
      const loaded = await _ensureTryV3(_forceDataRefresh, refreshManifest);
      if (loaded && _forceDataRefresh && _irCandidatePolicy === 1) await _completeDataRefresh();
    }

    function ensureTables() {
      if (_ensurePromise) return _ensurePromise;
      _ensurePromise = _ensureMain().catch((e) => { _zhxErr('ensureMain', e); }).then(_ensureFinalize);
      return _ensurePromise;
    }
    function itemDbReady(cb) {
      ensureTables().then(() => { try { if (typeof cb === 'function') cb(); } catch (e) { _zhxErr('readyCb', e); } });
    }

    // ── DataManager 统一 API（v1.4 Phase 11）─────────────────────────────
    // 说明：既有 ensureTables / itemDbReady / onTablesReady 行为与调用点全部保留；
    // 本对象为别名与扩展入口，新代码统一经 dataManager 访问。site 参数为将来按站
    // 数据链预留（现状六站共享同一数据链，忽略该参数）。
    function dataGetTable(name) {
      // 表文本（只读引用）：items / series / acl；未就绪或未知表 → null
      switch (name) {
        case 'series': return SERIES_TEXT || null;
        case 'acl': return ACL_CFC_TEXT || null;
        default: return null;
      }
    }
    function dataGetIndex(name) {
      // 索引引用（数据层与核心模块内部/调试用途；业务侧查询一律走 Item Resolver）
      switch (name) {
        case 'itemHash': return _tablesReady ? itemHash : null;
        case 'nameMap': return _tablesReady ? nameMap : null;
        case 'ecidMap': return _tablesReady ? ecidMap : null;
        case 'koByZh': return _tablesReady ? koByZh : null;
        default: return null;
      }
    }
    function dataInvalidate() {
      // 重新检查 V3 manifest，同时保留按指纹校验的文件缓存供离线复用。
      _ensurePromise = null;
      DATA_VER = '';
      _manifestRefreshRequested = true;
      _replaceMap(itemHash, null); _replaceMap(ecidMap, null); _replaceMap(nameMap, null); _replaceMap(koByZh, null);
      _irDupMap = null; _irAliasMap = null; _irGlamMap = null; _irSearchSlotByNative = null; _irCandidatePolicy = 0;
      _irSearchByZh = null; _irSearchKind = null; _irSearchCanonicalKeys = null; _irSearchAliasKeys = null;
      SERIES_TEXT = ''; ACL_CFC_TEXT = '';
    }
    const dataManager = {   // NOSONAR —— 接口层：tests/unit 经 dist 区段装配调用（冻结契约）；生产路径暂不直呼
      ensure(site) { return ensureTables(); },                       // site：预留（见上）
      ready(cb) {
        const p = ensureTables();
        if (typeof cb === 'function') p.then(() => { try { cb(); } catch (e) { _zhxErr('readyCb', e); } });
        return p;
      },
      getTable(name) { return dataGetTable(name); },
      getIndex(name) { return dataGetIndex(name); },
      invalidate() { dataInvalidate(); },
    };
    /* @zhixia:core-data-manager-end */
    /* @zhixia:data-layer-end */

    /* @zhixia:core-item-resolver-start */
    /* ── Core Item Resolver（v1.4 Phase 6）：物品索引统一解析层——对 hash / 名称索引
         与衍生注册表（重名 / 别名）的集中访问。解析语义与既有查询完全一致（同名键
         首行胜）；重名键（同键多译）经 resolveAllByName 取全量，顺序=TSV 行序
         （历史优先，禁止随机）。Phase 15 模块化构建时，本区段将原样抽出为
         src/core/item-resolver.js。 */

    let _irDupMap = null;     // 重名键（同键多译）: key → zh[]（含首行=nameMap 现值，按行序） // NOSONAR
    let _irGlamMap = null;
    let _irSearchSlotByNative = null; // 源自 V3 names 可选第四列；旧缓存默认其余
    let _irCandidatePolicy = 0;    // names 行级候选允许标记；仅明确的 '1' 进入中文搜索倒排 // NOSONAR
    let _irAliasMap = null;   // 别名表: alias → zh[]（按行序；alias 列以全角分号拆分） // NOSONAR

    // 中文装备搜索反向索引：国服中文名/中文别名 → 当前站点原生名称。
    // 仅构建当前站点所需的原生语言映射，不扩大现有 v3 数据文件。
    let _irSearchByZh = null; // NOSONAR — 数据就绪后按当前站点数据重建
    let _irSearchKind = null;  // 0=正式名称，1=中文别名
    let _irSearchCanonicalKeys = null;
    let _irSearchAliasKeys = null;

    function _irNormZhSearch(value) {
      return String(value ?? '').trim().replace(/[ \t\u00a0]+/g, ' ');
    }

    function _irSearchPut(map, zh, native, kind, kindMap) {
      if (!map || !zh || !native) return;
      const key = _irNormZhSearch(zh);
      const value = _irNormZhSearch(native);
      if (!key || !value) return;
      if (map[key] === undefined) {
        map[key] = value;
        if (kindMap) kindMap[key] = kind;
      }
    }

    function _irBuildSearchFromNames(names, ali, glam) {
      const out = Object.create(null);
      const kind = Object.create(null);
      if (_irCandidatePolicy !== 1) return { map: out, kind };
      for (const [native, zh] of Object.entries(names || {})) {
        if (glam?.[native] !== '1') continue;   // 仅明确允许的装备、时尚配饰、鸟甲进入中文候选
        _irSearchPut(out, zh, native, 0, kind);
      }
      for (const [alias, zhs] of Object.entries(ali || {})) {
        const key = _irNormZhSearch(alias);
        if (!key || out[key] !== undefined) continue;
        const list = Array.isArray(zhs) ? zhs : [zhs];
        for (const zh of list) {
          const native = out[_irNormZhSearch(zh)];
          if (native) {
            out[key] = native;
            kind[key] = 1;
            break;
          }
        }
      }
      return { map: out, kind };
    }

    function _ensureIrSearch() {
      if (_irSearchByZh !== null) return _irSearchByZh;
      const built = _irBuildSearchFromNames(nameMap, _irAliasMap, _irGlamMap);
      _irSearchByZh = built.map;
      _irSearchKind = built.kind;
      _irSearchCanonicalKeys = null;
      _irSearchAliasKeys = null;
      return _irSearchByZh;
    }

    function _getIrSearchKeysByKind(kind) {
      if (kind === 0 && _irSearchCanonicalKeys !== null) return _irSearchCanonicalKeys;
      if (kind === 1 && _irSearchAliasKeys !== null) return _irSearchAliasKeys;
      const out = Object.keys(_irSearchByZh || {}).filter((k) => _irSearchKind?.[k] === kind);
      out.sort((a, b) => a.localeCompare(b));
      if (kind === 0) _irSearchCanonicalKeys = out;
      else _irSearchAliasKeys = out;
      return out;
    }

    function _irSearchLowerBound(keys, target) {
      let lo = 0, hi = keys.length;
      while (lo < hi) {
        const mid = lo + ((hi - lo) >> 1);
        if (keys[mid].localeCompare(target) < 0) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    }

    function _irSearchCollectPrefix(keys, target, limit, out, excluded) {
      const start = _irSearchLowerBound(keys, target);
      for (let i = start; i < keys.length && out.length < limit; i++) {
        const candidate = keys[i];
        if (!candidate.startsWith(target)) break;
        if (candidate !== excluded) out.push(candidate);
      }
    }

    // 除前缀外也支持中文装备名中间连续片段；保持允许名单、按站语言映射不变。
    function _irSearchCollectContains(keys, target, limit, out, excluded) {
      for (const candidate of keys) {
        if (out.length >= limit) break;
        if (candidate !== excluded && !candidate.startsWith(target) && candidate.includes(target)) out.push(candidate);
      }
    }

    // 解析统计（v1.4 Phase 10：Probe 读取——整数自增，无行为影响）
    const _irStats = { hit: 0, miss: 0 };
    function resolveByHash(hash) { const z = (hash && itemHash?.[hash]) ? itemHash[hash] : null; _irStats[z ? 'hit' : 'miss']++; return z; }
    function resolveByName(name) { const z = (name && nameMap?.[name]) ? nameMap[name] : null; _irStats[z ? 'hit' : 'miss']++; return z; }
    function resolveByZh(zh) {
      const key = _irNormZhSearch(zh);
      const map = _ensureIrSearch();
      const z = (key && map?.[key]) ? map[key] : null;
      _irStats[z ? 'hit' : 'miss']++;
      return z;
    }

    // 部分词解析的外层收集：kind 0/1（主名 + 别名）两类键各收集一轮，
    // 合计超过 1000 条即停（防病态输入把收集循环拖长）。
    function _zhPartialCollect(key, map) {
      const natives = [];
      for (const kind of [0, 1]) {
        _zhPartialCollectKind(natives, key, map, kind);
        if (natives.length > 1000) break;
      }
      return natives;
    }

    // 单类收集：键含部分词且非键本身时，取对应原生名入列。
    function _zhPartialCollectKind(natives, key, map, kind) {
      for (const k of _getIrSearchKeysByKind(kind)) {
        if (k === key || !k.includes(key)) continue;
        const native = map[k];
        if (native) natives.push(native);
        if (natives.length > 1000) return;
      }
    }

    // v1.4.2 后续：部分词解析（完整名失败时兜底）——子串收集 + 公共子串提取（复用系列名推导 _lcs90 经验）。
    // 场景：「女仆」→ 收集所有含「女仆」的中文名 → 提取原生名（按站裁剪）的公共子串「メイド」→ 交给站内部分匹配搜索。
    // 提取不到公共子串（各族原生名互异）时返回 null，保持「不转换」原行为。
    function resolvePartialByZh(zh) {
      const key = _irNormZhSearch(zh);
      if (key.length < 2 || !/[\u3400-\u9fff]/u.test(key)) return null;
      const map = _ensureIrSearch();
      if (!map) return null;
      const natives = _zhPartialCollect(key, map);
      let z = null;
      if (natives.length === 1) z = natives[0];
      else if (natives.length > 1) z = _lcs90(natives);
      // 英文（非 CJK）片段质量门：如 "ai"、"Loyal Housem" 这类词中片段判为不合格，
      // 保持不转换——避免把无意义的片段当搜索词（英文站数据混杂时 _lcs90 会产出此类结果）。
      if (z && /[A-Za-z]/.test(z) && !_zhPartialEdgeOk(z, natives)) z = null;
      _irStats[z ? 'hit' : 'miss']++;
      return z;
    }

    // 部分词提取的英文片段边界校验：含 ASCII 字母的片段必须在某个样本中存在「合格窗口」
    // ——左端为串首或前邻非字母数字；右端为串尾、后邻非字母数字、或末字符本身即分隔符
    // （如「Housemaid 」尾随空格）；否则视为词中片段（如 "ai"、"Loyal Housem"）判不合格。
    function _zhPartialEdgeOk(seg, list) {
      for (const s of list) {
        let i = s.indexOf(seg);
        while (i !== -1) {
          const left = i === 0 || !/[0-9A-Za-z]/.test(s[i - 1]);
          const end = i + seg.length;
          const right = end >= s.length
            || !/[0-9A-Za-z]/.test(s[end])
            || !/[0-9A-Za-z]/.test(s[end - 1]);
          if (left && right) return true;
          i = s.indexOf(seg, i + 1);
        }
      }
      return false;
    }

    // 智能输入候选的防御性上限：实测当前数据最大前缀组 2450 条（「改良」）；
    // 3 千条兜底，防止病态输入把候选列表渲染到卡顿（正常输入远低于此）。
    const SUGGEST_ABS_MAX = 3000;
    // 匹配度在每个装备部位内计算：精确 / 正式名前缀 / 正式名包含 /
    // 别名前缀 / 别名包含；非匹配项返回 -1。
    function _irSuggestionScore(name, query, kind) {
      if (name === query) return 0;
      if (name.startsWith(query)) return kind === 0 ? 1 : 3;
      if (name.includes(query)) return kind === 0 ? 2 : 4;
      return -1;
    }

    // 每个部位设五个有序匹配桶；先采集完整匹配，再进行最终限流，
    // 否则高优先级部位可能被词典顺序和 limit 提前截断。
    // Scope before bucketing and limiting, not after truncating 3,000 results.
    // A set represents exact official native-name membership (e.g. bardings);
    // a numeric value represents the official V3 equipment slot group.
    function _irSuggestionCollect(buckets, query, kind, limit, map, scope) {
      for (const name of _getIrSearchKeysByKind(kind)) {
        const score = _irSuggestionScore(name, query, kind);
        if (score < 0) continue;
        const native = map[name];
        if (!native) continue;
        const group = _irSearchSlotByNative?.[native] ?? 5;
        if (scope instanceof Set && !scope.has(native)) continue;
        if (typeof scope === 'number' && scope !== group) continue;
        const bucket = buckets[group][score];
        if (bucket.length < limit) bucket.push({ zh: name, native });
      }
    }

    function _irSuggestionFlatten(buckets, limit) {
      const rows = [];
      for (const bucket of buckets.flat()) {
        for (const row of bucket) {
          rows.push(row);
          if (rows.length >= limit) return rows;
        }
      }
      return rows;
    }

    // 先按头、身、手、腿、脚、其余；组内按匹配度排序，保持已存在的
    // 正式名、别名、limit、旧 V3 缓存及六站原生名行为。
    function suggestByZh(zh, limit = 0, scope = null) {
      const key = _irNormZhSearch(zh);
      if (key.length < 2 || !/[\u3400-\u9fff]/u.test(key)) return [];
      const map = _ensureIrSearch();
      if (!map) return [];
      const raw = Number(limit);
      const max = Number.isFinite(raw) && raw > 0 ? Math.min(raw, SUGGEST_ABS_MAX) : SUGGEST_ABS_MAX;
      const buckets = Array.from({ length: 6 }, () => Array.from({ length: 5 }, () => []));
      _irSuggestionCollect(buckets, key, 0, max, map, scope);
      _irSuggestionCollect(buckets, key, 1, max, map, scope);
      return _irSuggestionFlatten(buckets, max);
    }

    function resolveAllByName(name) {   // NOSONAR —— 接口层：tests/unit 经 dist 区段装配调用（冻结契约）；生产路径暂不直呼
      const first = nameMap?.[name];
      if (!first) return [];
      const d = _irDupMap?.[name];
      return d ? d.slice() : [first];
    }
    function resolveAlias(alias) {
      const d = _irAliasMap?.[alias];
      return d ? d.slice() : [];
    }
    // 统一优先级（计划书 6.4，以现有实际行为为准）：
    // 1) hash → 2) 名称 → 3) 历史兼容 fallback（latinFallback：外文名自动查物品总表）。
    // 注：EC_ID / 韩文名反查见 resolveEcId / resolveKo（v1.4 Phase 10：Wiki 唯一数据入口）。
    function resolve(input, opts) {
      if (!input) return null;
      if (input.hash) { const z = resolveByHash(input.hash); if (z) return z; }
      if (input.name) {
        const z = resolveByName(input.name); if (z) return z;
        if (opts?.latinFallback) { const z2 = tryEnToZh(input.name); if (z2) return z2; }
      }
      if (input.alias) { const zs = resolveAlias(input.alias); if (zs.length) return zs[0]; }
      return null;
    }
    // EC_ID / 韩文名反查（zh → 值）——v1.4 Phase 10：Wiki 与 Probe 的唯一数据入口
    function resolveEcId(zh) { const z = (zh && ecidMap?.[zh]) ? String(ecidMap[zh]) : null; _irStats[z ? 'hit' : 'miss']++; return z; }
    function resolveKo(zh) { const z = (zh && koByZh?.[zh]) ? koByZh[zh] : null; _irStats[z ? 'hit' : 'miss']++; return z; }

  /* @phase15-module-order:core/storage */
  /* @phase15-order-link:core/storage<-core/data-manager */


    /* @zhixia:core-storage-start */
    /* ── Core Storage（v1.4 Phase 4）：GM 存储读写封装——同步 / Promise 双
         兼容，存储不可用时静默降级（无持久缓存仍可工作）。Phase 15 模块化
         构建时，本区段将原样抽出为 src/core/storage.js。 */
    /* ── 存储封装：优先用户脚本管理器存储（跨站共享）；不可用时退化为
          无持久缓存（本次页面内仍可工作）────────────────────────────── */
    function _storeNorm(x) { if (typeof x === 'string') { return x; } return x == null ? null : String(x); }
    function storeGetAsync(k) {
      return new Promise((resolve) => {
        try {
          if (typeof GM_getValue === 'function') {
            const v = GM_getValue(k, null);
            if (v && typeof v.then === 'function') { v.then((x) => resolve(_storeNorm(x)), () => resolve(null)); }
            else resolve(_storeNorm(v));
            return;
          }
          if (typeof GM !== 'undefined' && GM && typeof GM.getValue === 'function') {
            GM.getValue(k, null).then((x) => resolve(_storeNorm(x)), () => resolve(null));
            return;
          }
        } catch (e) { /* 忽略：存储读取失败按无缓存处理 */ }
        resolve(null);
      });
    }
    function storeSetAsync(k, v) {
      return new Promise((resolve) => {
        try {
          if (typeof GM_setValue === 'function') {
            const result = GM_setValue(k, v);
            if (result && typeof result.then === 'function') result.then(() => resolve(true), () => resolve(false));
            else resolve(result !== false);
            return;
          }
          if (typeof GM !== 'undefined' && GM && typeof GM.setValue === 'function') {
            Promise.resolve(GM.setValue(k, v)).then(() => resolve(true), () => resolve(false));
            return;
          }
        } catch (e) { /* persistence failure must be observable to callers */ }
        resolve(false);
      });
    }
    function storeSet(k, v) {
      void storeSetAsync(k, v);
    }
    function storeListAsync() {
      return new Promise((resolve) => {
        try {
          let result;
          if (typeof GM_listValues === 'function') result = GM_listValues();
          else if (typeof GM !== 'undefined' && GM && typeof GM.listValues === 'function') result = GM.listValues();
          else { resolve(null); return; }
          Promise.resolve(result).then((keys) => {
            resolve(Array.isArray(keys) && keys.every((k) => typeof k === 'string') ? keys : null);
          }, () => resolve(null));
        } catch (e) {
          console.warn('[zhixia] GM storage key enumeration unavailable; falling back to known data keys', e);
          resolve(null); // A failure never grants access to stale candidate caches.
        }
      });
    }
    async function storeDeleteAsync(k) {
      try {
        if (typeof GM_deleteValue === 'function') {
          const result = GM_deleteValue(k);
          const ok = result && typeof result.then === 'function'
            ? await result.then(() => true, () => false) : result !== false;
          if (ok) return true;
        } else if (typeof GM !== 'undefined' && GM && typeof GM.deleteValue === 'function') {
          const ok = await Promise.resolve(GM.deleteValue(k)).then(() => true, () => false);
          if (ok) return true;
        } else {
          return await storeSetAsync(k, '');
        }
      } catch (e) { /* fall through to empty-value invalidation */ }
      return await storeSetAsync(k, '');
    }

    /* @zhixia:core-storage-end */

  /* @phase15-module-order:core/http */
  /* @phase15-order-link:core/http<-core/storage */


    /* @zhixia:core-http-start */
    /* ── Core HTTP（v1.4 Phase 4）：GM_xmlhttpRequest 优先（不受页面 CSP /
         CORS 限制），无则 fetch 兜底；统一 timeout 与错误策略。Phase 15 模块化
         构建时，本区段将原样抽出为 src/core/http.js。 */

    /* ── 网络：优先 GM_xmlhttpRequest（不受页面 CSP/CORS 限制），无则 fetch ── */
    let _httpFreshSequence = 0;
    function _httpFreshUrl(url) {
      const hashAt = url.indexOf('#');
      const base = hashAt < 0 ? url : url.slice(0, hashAt);
      const hash = hashAt < 0 ? '' : url.slice(hashAt);
      const sep = base.includes('?') ? '&' : '?';
      const token = Date.now().toString(36) + '-' + (++_httpFreshSequence).toString(36);
      return base + sep + '_zhx_refresh=' + token + hash;
    }

    function httpGet(url, timeout, options) {
      const fresh = options?.fresh === true;
      const requestUrl = fresh ? _httpFreshUrl(url) : url;
      const headers = fresh ? { 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' } : undefined;
      return new Promise((resolve, reject) => {
        let done = false;
        const ok = (t) => { if (!done) { done = true; resolve(t); } };
        const bad = (e) => { if (!done) { done = true; reject(e instanceof Error ? e : new Error(String(e))); } };
        try {
          if (typeof GM_xmlhttpRequest === 'function') {
            GM_xmlhttpRequest({
              method: 'GET', url: requestUrl, headers,
              timeout: timeout || 20000,
              onload: (r) => { (r?.status >= 200 && r.status < 300) ? ok(r.responseText || '') : bad(new Error('HTTP ' + r?.status)); },
              onerror: () => bad(new Error('network')),
              ontimeout: () => bad(new Error('timeout')),
            });
            return;
          }
        } catch (e) { /* 忽略：GM 通道不可用——按序尝试 fetch 兜底 */ }
        try {
          if (typeof fetch === 'function') {
            let ctl = null, tm = null;
            try {
              if (typeof AbortController === 'function') {
                ctl = new AbortController();
                tm = setTimeout(() => { try { ctl.abort(); } catch (e) { /* 忽略：abort 清理调用失败无碍 */ } }, timeout || 20000);
              }
            } catch (e) { /* 忽略：无 AbortController——不设置取消 */ }
            const fetchOptions = ctl ? { signal: ctl.signal } : {};
            if (fresh) fetchOptions.cache = 'no-store';
            fetch(requestUrl, fetchOptions).then(
              (r) => { if (tm) { clearTimeout(tm); } return r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status)); },
              (e) => { if (tm) { clearTimeout(tm); } throw e; }
            ).then(ok, bad);
            return;
          }
        } catch (e) { /* 忽略：fetch 不可用——走最后兜底 */ }
        bad(new Error('no http transport'));
      });
    }

    /* @zhixia:core-http-end */

  /* @phase23-module-order:core/chinese-search */
  /* @phase23-order-link:core/chinese-search<-core/data-manager */

  // 站点能力表：统一交互由 Core 调度；form 与 SPA 输入的提交路径各用原站行为。
  const SEARCH_SITES = Object.freeze({
    mirapri: { vueSelect: false },
    fc: { vueSelect: false },
    ronka: { vueSelect: false },
    collection: { vueSelect: false },
    ec: { vueSelect: true },
    endcloset: { vueSelect: false },
  });
  let _activeSearchSiteId = null;

  // BEGIN GENERATED EC SEARCH CATEGORIES — tools/update-ec-search-categories.py
  // EC specialty candidates are game-data classifications, never fuzzy name guesses.
  // Bird bardings: en/Item.csv -> ItemAction.csv Action=1013 (includes Shaffron/Harness).
  // Facewear: en/Glasses.csv Style unique -> CN/Glasses.csv same record ID.
  // Accessory slots: en/Item.csv EquipSlotCategory 9/10/11/12.
  // Facewear is an independent game sheet, NOT a subset of helmet equipment.
  const EC_BARDING_NATIVES = new Set(["Abigail Barding","Abyssal Barding","Ala Mhigan Barding","Allagan Barding","Angelic Barding","Authentic Egg Barding","Authentic Paramour Barding","Authentic Starlight Barding","Barding of Divine Light","Barding of Eternal Darkness","Barding of Light","Barding of Naught","Barding of the Dead","Behemoth Barding","Black Mage Barding","Blissful Barding","Bluefeather Barding","Bozjan Barding","Butlery Barding","Byakko Barding","Chocobo Raincoat","Cosmic Barding","Dancer Barding","Deepshadow Barding","Demonic Barding","Diamond Barding","Eerie Barding","Egg Harness","Egg Hunter Barding","Electrope Barding","Emerald Barding","Eternal Barding","Expanse Barding","Far Eastern Barding","Felicitous Barding","Flamecloaked Barding","Flyer Shaffron","Gambler Barding","Gridanian Barding","Gridanian Crested Barding","Gridanian Half Barding","Hades Barding","Highland Barding","Hingan Barding","Hive Barding","Horde Barding","Ice Barding","Innocence Barding","Ishgardian Barding","Ishgardian Half Barding","Isle Pioneer's Barding","Ixion Barding","Levin Barding","Lominsan Barding","Lominsan Crested Barding","Lominsan Half Barding","Lunar Barding","Machinist Barding","Mandervillian Barding","Nezha Barding","Noble Barding","Oriental Barding","Orthodox Barding","Paramour Barding","Picnicker's Barding","Pilgrim's Barding","Plumed Barding","Postmoogle Barding","Queen's Guard Barding","Queen's Knight Barding","Race Barding","Red Mage Barding","Reveler's Barding","Round Table Barding","Ruby Barding","Runaway Barding","Saintly Barding","Samurai Barding","Seiryu Barding","Sephirotic Barding","Shinryu Barding","Skyruin Barding","Sleipnir Barding","Sophic Barding","Sovereign Barding","Starlight Barding","Starlight Stalls Barding","Suzaku Barding","Thavnairian Barding","Tidal Barding","Titania Barding","True Barding of Light","Turali Barding","Ul'dahn Barding","Ul'dahn Crested Barding","Ul'dahn Half Barding","Voidcast Barding","Wayfarer's Barding","Wild Ride Barding","Wild Rose Barding","Windswept Barding","Wolf Barding","Yojimbo Barding","Zurvanite Barding"]);
  const EC_FACEWEAR_ROWS = Object.freeze([{"native":"Antique Monocle","zh":"古董单眼镜"},{"native":"Blindfold Eyepatch (Left)","zh":"左侧折布眼罩"},{"native":"Blindfold Eyepatch (Right)","zh":"右侧折布眼罩"},{"native":"Blooming Eyeglasses","zh":"彩花装饰眼镜"},{"native":"Bold-rimmed Glasses","zh":"厚框眼镜"},{"native":"Brass Goggles","zh":"黄铜护目镜"},{"native":"Cat Eye Glasses","zh":"猫眼眼镜"},{"native":"Cat Eye Reading Glasses","zh":"猫眼读书眼镜"},{"native":"Chicken Eyeglasses","zh":"彩蛋小鸡眼镜"},{"native":"Classic Spectacles","zh":"经典眼镜"},{"native":"Coeurl Eyeglasses","zh":"豹目眼镜"},{"native":"Comfortable Eye Mask","zh":"纯色眼罩"},{"native":"Contemporary Pince-nez","zh":"现代鼻眼镜"},{"native":"Dark Glasses","zh":"黑色墨镜"},{"native":"Elegant Rimless Glasses","zh":"典雅无框眼镜"},{"native":"Eyepatch (Left)","zh":"左侧眼罩"},{"native":"Eyepatch (Right)","zh":"右侧眼罩"},{"native":"Groovy Glasses","zh":"时髦眼镜"},{"native":"Half-rim Spectacles","zh":"半框眼镜"},{"native":"Holospecs","zh":"全息眼镜"},{"native":"Holovisor","zh":"全息护目镜"},{"native":"Magnifiers","zh":"作业眼镜"},{"native":"Metallic Eyepatch (Left)","zh":"左侧金属眼罩"},{"native":"Metallic Eyepatch (Right)","zh":"右侧金属眼罩"},{"native":"Minstrel's Spectacles","zh":"艺术眼镜"},{"native":"Monocle","zh":"单眼镜"},{"native":"Mythril-edged Eyepatch (Left)","zh":"左侧秘银镶边眼罩"},{"native":"Mythril-edged Eyepatch (Right)","zh":"右侧秘银镶边眼罩"},{"native":"Ornamented Leather Eyepatch (Left)","zh":"左侧皮饰眼罩"},{"native":"Ornamented Leather Eyepatch (Right)","zh":"右侧皮饰眼罩"},{"native":"Oval Reading Glasses","zh":"椭圆读书眼镜"},{"native":"Oval Spectacles","zh":"椭圆眼镜"},{"native":"Painted Eggy Eyeglasses","zh":"装饰彩蛋眼镜"},{"native":"Party Eggy Eyeglasses","zh":"四颗彩蛋眼镜"},{"native":"Petite Pince-nez","zh":"小夹鼻眼镜"},{"native":"Pince-nez","zh":"鼻眼镜"},{"native":"Professorial Glasses","zh":"教授眼镜"},{"native":"Reading Glasses","zh":"阅读眼镜"},{"native":"Rectangular Glasses","zh":"渐变色镜框眼镜"},{"native":"Rimless Glasses","zh":"无框眼镜"},{"native":"Rose-colored Spectacles","zh":"玫瑰色眼镜"},{"native":"Sash Blinder (Left)","zh":"左侧皮带眼罩"},{"native":"Sash Blinder (Right)","zh":"右侧皮带眼罩"},{"native":"Scaevan Headgear","zh":"斯卡艾瓦头甲"},{"native":"Shaded Spectacles","zh":"金边墨镜"},{"native":"Shaded Visor","zh":"遮光面罩"},{"native":"Simple Oval Spectacles","zh":"基础款椭圆眼镜"},{"native":"Simple Spectacles","zh":"基础款眼镜"},{"native":"Slim Frame Eggy Eyeglasses","zh":"窄框彩蛋眼镜"},{"native":"Slim Frame Glasses","zh":"窄框眼镜"},{"native":"Spriggan Eyeglasses","zh":"魔石精眼镜"},{"native":"Studded Eyepatch (Left)","zh":"左侧钉扣眼罩"},{"native":"Studded Eyepatch (Right)","zh":"右侧钉扣眼罩"},{"native":"Tactical Goggles","zh":"战术护目镜"},{"native":"Teardrop Glasses","zh":"泪滴形眼镜"},{"native":"Thick-rimmed Glasses","zh":"粗框眼镜"},{"native":"Thick-rimmed Goggles","zh":"厚框护目镜"},{"native":"Tinted Goggles","zh":"彩色护目镜"},{"native":"Tinted Sunglasses","zh":"淡色眼镜"},{"native":"Under-rim Glasses","zh":"下框眼镜"},{"native":"Wrap-around Sunglasses","zh":"罩眼式墨镜"}]);
  const EC_ACCESSORY_SLOT_NATIVES = Object.freeze({"ears":new Set(["Abyssos Earrings of Aiming","Abyssos Earrings of Casting","Abyssos Earrings of Fending","Abyssos Earrings of Healing","Abyssos Earrings of Slaying","Acacia Earrings","Aesthete's Ear Cuffs of Crafting","Aesthete's Earrings of Gathering","Aetherial Amber Earrings","Aetherial Amethyst Earrings","Aetherial Aquamarine Earrings","Aetherial Black Pearl Earrings","Aetherial Brass Ear Cuffs","Aetherial Danburite Earrings","Aetherial Electrum Ear Cuffs","Aetherial Fluorite Earrings","Aetherial Garnet Earrings","Aetherial Goshenite Earrings","Aetherial Heliodor Earrings","Aetherial Lapis Lazuli Earrings","Aetherial Malachite Earrings","Aetherial Mythril Ear Cuffs","Aetherial Pearl Earrings","Aetherial Peridot Earrings","Aetherial Rubellite Earrings","Aetherial Silver Ear Cuffs","Aetherial Sphene Earrings","Aetherial Spinel Earrings","Aetherial Sunstone Earrings","Aetherial Tourmaline Earrings","Aetherial Turquoise Earrings","Aetherial Zircon Earrings","Aetheryte Earring","Ala Mhigan Earrings","Ala Mhigan Earrings of Aiming","Ala Mhigan Earrings of Casting","Ala Mhigan Earrings of Fending","Ala Mhigan Earrings of Healing","Ala Mhigan Earrings of Slaying","Alexandrian Earrings of Aiming","Alexandrian Earrings of Casting","Alexandrian Earrings of Fending","Alexandrian Earrings of Healing","Alexandrian Earrings of Slaying","Allagan Earrings of Aiming","Allagan Earrings of Casting","Allagan Earrings of Fending","Allagan Earrings of Healing","Allagan Earrings of Maiming","Allagan Earrings of Striking","Alliance Earring of Aiming","Alliance Earring of Casting","Alliance Earring of Fending","Alliance Earring of Healing","Alliance Earring of Slaying","Alpaca Earring","Alpha Wolf Earrings","Amaurotine Earrings of Aiming","Amaurotine Earrings of Casting","Amaurotine Earrings of Fending","Amaurotine Earrings of Healing","Amaurotine Earrings of Slaying","Amber Earrings","Amethyst Earrings","Ametrine Ear Cuffs of Crafting","Ametrine Earrings of Aiming","Ametrine Earrings of Casting","Ametrine Earrings of Fending","Ametrine Earrings of Healing","Ametrine Earrings of Slaying","Anabaseios Earring of Aiming","Anabaseios Earring of Casting","Anabaseios Earring of Fending","Anabaseios Earring of Healing","Anabaseios Earring of Slaying","Anamnesis Earrings of Aiming","Anamnesis Earrings of Casting","Anamnesis Earrings of Fending","Anamnesis Earrings of Healing","Anamnesis Earrings of Slaying","Aquamarine Earrings","Archeo Kingdom Earrings of Aiming","Archeo Kingdom Earrings of Casting","Archeo Kingdom Earrings of Fending","Archeo Kingdom Earrings of Healing","Archeo Kingdom Earrings of Slaying","Ardent Earrings of Aiming","Ardent Earrings of Casting","Ardent Earrings of Fending","Ardent Earrings of Healing","Ardent Earrings of Slaying","Arhat Earring of Aiming","Arhat Earring of Casting","Arhat Earring of Fending","Arhat Earring of Healing","Arhat Earring of Slaying","Artful Afflatus Earrings","Ascension Earring of Aiming","Ascension Earring of Casting","Ascension Earring of Fending","Ascension Earring of Healing","Ascension Earring of Slaying","Asphodelos Earrings of Aiming","Asphodelos Earrings of Casting","Asphodelos Earrings of Fending","Asphodelos Earrings of Healing","Asphodelos Earrings of Slaying","Asuran Earring of Aiming","Asuran Earring of Casting","Asuran Earring of Fending","Asuran Earring of Healing","Asuran Earring of Slaying","Augmented Archeo Kingdom Earrings of Aiming","Augmented Archeo Kingdom Earrings of Casting","Augmented Archeo Kingdom Earrings of Fending","Augmented Archeo Kingdom Earrings of Healing","Augmented Archeo Kingdom Earrings of Slaying","Augmented Bygone Brass Earrings of Aiming","Augmented Bygone Brass Earrings of Casting","Augmented Bygone Brass Earrings of Fending","Augmented Bygone Brass Earrings of Healing","Augmented Bygone Brass Earrings of Slaying","Augmented Ceremonial Earring of Aiming","Augmented Ceremonial Earring of Casting","Augmented Ceremonial Earring of Fending","Augmented Ceremonial Earring of Healing","Augmented Ceremonial Earring of Slaying","Augmented Classical Earrings of Aiming","Augmented Classical Earrings of Casting","Augmented Classical Earrings of Fending","Augmented Classical Earrings of Healing","Augmented Classical Earrings of Slaying","Augmented Courtly Lover's Earrings of Aiming","Augmented Courtly Lover's Earrings of Casting","Augmented Courtly Lover's Earrings of Fending","Augmented Courtly Lover's Earrings of Healing","Augmented Courtly Lover's Earrings of Slaying","Augmented Credendum Earrings of Aiming","Augmented Credendum Earrings of Casting","Augmented Credendum Earrings of Fending","Augmented Credendum Earrings of Healing","Augmented Credendum Earrings of Slaying","Augmented Cryptlurker's Earring of Aiming","Augmented Cryptlurker's Earring of Casting","Augmented Cryptlurker's Earring of Fending","Augmented Cryptlurker's Earring of Healing","Augmented Cryptlurker's Earring of Slaying","Augmented Crystarium Earrings of Aiming","Augmented Crystarium Earrings of Casting","Augmented Crystarium Earrings of Fending","Augmented Crystarium Earrings of Healing","Augmented Crystarium Earrings of Slaying","Augmented Deepshadow Earring of Aiming","Augmented Deepshadow Earring of Casting","Augmented Deepshadow Earring of Fending","Augmented Deepshadow Earring of Healing","Augmented Deepshadow Earring of Slaying","Augmented Diadochos Earring of Aiming","Augmented Diadochos Earring of Casting","Augmented Diadochos Earring of Fending","Augmented Diadochos Earring of Healing","Augmented Diadochos Earring of Slaying","Augmented Exarchic Earrings of Aiming","Augmented Exarchic Earrings of Casting","Augmented Exarchic Earrings of Fending","Augmented Exarchic Earrings of Healing","Augmented Exarchic Earrings of Slaying","Augmented Facet Earrings of Aiming","Augmented Facet Earrings of Casting","Augmented Facet Earrings of Fending","Augmented Facet Earrings of Healing","Augmented Facet Earrings of Slaying","Augmented Handmaster's Earrings","Augmented Historia Earrings of Aiming","Augmented Historia Earrings of Casting","Augmented Historia Earrings of Fending","Augmented Historia Earrings of Healing","Augmented Historia Earrings of Slaying","Augmented Ironworks Earrings of Aiming","Augmented Ironworks Earrings of Casting","Augmented Ironworks Earrings of Fending","Augmented Ironworks Earrings of Healing","Augmented Ironworks Earrings of Slaying","Augmented Landmaster's Earrings","Augmented Lost Allagan Earrings of Aiming","Augmented Lost Allagan Earrings of Casting","Augmented Lost Allagan Earrings of Fending","Augmented Lost Allagan Earrings of Healing","Augmented Lost Allagan Earrings of Slaying","Augmented Lunar Envoy's Earring of Aiming","Augmented Lunar Envoy's Earring of Casting","Augmented Lunar Envoy's Earring of Fending","Augmented Lunar Envoy's Earring of Healing","Augmented Lunar Envoy's Earring of Slaying","Augmented Neo-Ishgardian Earring of Aiming","Augmented Neo-Ishgardian Earring of Casting","Augmented Neo-Ishgardian Earring of Fending","Augmented Neo-Ishgardian Earring of Healing","Augmented Neo-Ishgardian Earring of Slaying","Augmented Primal Earrings of Aiming","Augmented Primal Earrings of Casting","Augmented Primal Earrings of Fending","Augmented Primal Earrings of Healing","Augmented Primal Earrings of Slaying","Augmented Quetzalli Ear Cuffs of Aiming","Augmented Quetzalli Ear Cuffs of Casting","Augmented Quetzalli Ear Cuffs of Fending","Augmented Quetzalli Ear Cuffs of Healing","Augmented Quetzalli Ear Cuffs of Slaying","Augmented Radiant's Earrings of Aiming","Augmented Radiant's Earrings of Casting","Augmented Radiant's Earrings of Fending","Augmented Radiant's Earrings of Healing","Augmented Radiant's Earrings of Slaying","Augmented Rinascita Earring of Aiming","Augmented Rinascita Earring of Casting","Augmented Rinascita Earring of Fending","Augmented Rinascita Earring of Healing","Augmented Rinascita Earring of Slaying","Augmented Scaevan Ear Cuff of Aiming","Augmented Scaevan Ear Cuff of Casting","Augmented Scaevan Ear Cuff of Fending","Augmented Scaevan Ear Cuff of Healing","Augmented Scaevan Ear Cuff of Slaying","Augmented Shire Conservator's Earrings","Augmented Shire Custodian's Earrings","Augmented Shire Pankratiast's Earring","Augmented Shire Philosopher's Earring","Augmented Shire Preceptor's Earrings","Augmented Silvergrace Earring of Aiming","Augmented Silvergrace Earring of Casting","Augmented Silvergrace Earring of Fending","Augmented Silvergrace Earring of Healing","Augmented Silvergrace Earring of Slaying","Auroral Earrings","Aurum Regis Earrings of Aiming","Aurum Regis Earrings of Casting","Aurum Regis Earrings of Crafting","Aurum Regis Earrings of Fending","Aurum Regis Earrings of Gathering","Aurum Regis Earrings of Healing","Aurum Regis Earrings of Slaying","Avalanche Brawler's Earring","Avalanche Leader's Earring","Azeyma's Earrings","Azurite Earrings of Aiming","Azurite Earrings of Casting","Azurite Earrings of Fending","Azurite Earrings of Healing","Azurite Earrings of Slaying","Babyface Champion's Earring of Aiming","Babyface Champion's Earring of Casting","Babyface Champion's Earring of Fending","Babyface Champion's Earring of Healing","Babyface Champion's Earring of Slaying","Baron Earrings","Battleliege Earrings of Aiming","Battleliege Earrings of Casting","Battleliege Earrings of Fending","Battleliege Earrings of Healing","Battleliege Earrings of Slaying","Beastmaster's Earrings","Behemoth Earring","Berserker's Earrings","Black Carnation Earring","Black Moth Orchid Earring","Black Paperflower Earring","Black Pearl Earrings","Black Star Ear Cuff of Aiming","Black Star Ear Cuff of Casting","Black Star Ear Cuff of Fending","Black Star Ear Cuff of Healing","Black Star Ear Cuff of Slaying","Black Star Earrings of Crafting","Black Star Earrings of Gathering","Black Triteleia Earring","Blessed Earrings","Blue Carnation Earring","Blue Moth Orchid Earring","Blue Paperflower Earring","Blue Triteleia Earring","Blue Zircon Earrings of Aiming","Blue Zircon Earrings of Casting","Blue Zircon Earrings of Fending ","Blue Zircon Earrings of Healing","Blue Zircon Earrings of Slaying","Bluebird Earring","Bogatyr's Earrings of Aiming","Bogatyr's Earrings of Casting","Bogatyr's Earrings of Healing","Bomb Earrings","Bonewicca Earring of Aiming","Bonewicca Earring of Casting","Bonewicca Earring of Fending","Bonewicca Earring of Healing","Bonewicca Earring of Slaying","Botanist's Earrings","Bozjan Earring","Brass Ear Cuffs","Brass Earrings","Brilliant Egg Earrings","Bronze Lone Wolf Earrings","Bronze Pack Wolf Earrings","Buuz Earring","Bygone Brass Earrings of Aiming","Bygone Brass Earrings of Casting","Bygone Brass Earrings of Fending","Bygone Brass Earrings of Healing","Bygone Brass Earrings of Slaying","Cactuar Earring","Carborundum Earring of Aiming","Carborundum Earring of Casting","Carborundum Earring of Fending","Carborundum Earring of Healing","Carborundum Earring of Slaying","Cassie Earring","Ceremonial Earring of Aiming","Ceremonial Earring of Casting","Ceremonial Earring of Fending","Ceremonial Earring of Healing","Ceremonial Earring of Slaying","Chrysolite Earrings of Aiming","Chrysolite Earrings of Casting","Chrysolite Earrings of Fending","Chrysolite Earrings of Healing","Chrysolite Earrings of Slaying","Classical Earrings of Aiming","Classical Earrings of Casting","Classical Earrings of Fending","Classical Earrings of Healing","Classical Earrings of Slaying","Coblyn Earring","Coffee Cup Earring","Cookie Earring","Copper Ear Cuffs","Copper Earrings","Corgi Earring","Courtly Lover's Earrings of Aiming","Courtly Lover's Earrings of Casting","Courtly Lover's Earrings of Fending","Courtly Lover's Earrings of Healing","Courtly Lover's Earrings of Slaying","Credendum Earrings of Aiming","Credendum Earrings of Casting","Credendum Earrings of Fending","Credendum Earrings of Healing","Credendum Earrings of Slaying","Crested Earrings of Crafting","Crested Earrings of Gathering","Crimson Standard Earrings","Cruiser Earring of Aiming","Cruiser Earring of Casting","Cruiser Earring of Fending","Cruiser Earring of Healing","Cruiser Earring of Slaying","Cryptlurker's Earring of Aiming","Cryptlurker's Earring of Casting","Cryptlurker's Earring of Fending","Cryptlurker's Earring of Healing","Cryptlurker's Earring of Slaying","Crystarium Earrings of Aiming","Crystarium Earrings of Casting","Crystarium Earrings of Fending","Crystarium Earrings of Healing","Crystarium Earrings of Slaying","Dai-ryumyaku Earring of Aiming","Dai-ryumyaku Earring of Casting","Dai-ryumyaku Earring of Fending","Dai-ryumyaku Earring of Healing","Dai-ryumyaku Earring of Slaying","Danburite Earrings","Darbar Earrings of Aiming","Darbar Earrings of Casting","Darbar Earrings of Fending","Darbar Earrings of Healing","Darbar Earrings of Slaying","Dark Horse Champion's Earring of Aiming","Dark Horse Champion's Earring of Casting","Dark Horse Champion's Earring of Fending","Dark Horse Champion's Earring of Healing","Dark Horse Champion's Earring of Slaying","Darklight Earrings of Aiming","Darklight Earrings of Casting","Darklight Earrings of Fending","Darklight Earrings of Healing","Darklight Earrings of Maiming","Darklight Earrings of Striking","Dated Amethyst Earrings","Dated Aquamarine Earrings","Dated Black Pearl Earrings","Dated Brass Earrings","Dated Copper Earrings","Dated Danburite Earrings","Dated Electrum Earrings","Dated Fang Earrings","Dated Fluorite Earrings","Dated Garnet Earrings","Dated Goshenite Earrings","Dated Heliodor Earrings","Dated Lapis Lazuli Earrings","Dated Malachite Earrings","Dated Pearl Earrings","Dated Peridot Earrings","Dated Silver Earrings","Dated Sphene Earrings","Dated Sunstone Earrings","Daystar Earrings","Deepmist Earrings of Aiming","Deepmist Earrings of Casting","Deepmist Earrings of Fending","Deepmist Earrings of Healing","Deepmist Earrings of Slaying","Deepshadow Earring of Aiming","Deepshadow Earring of Casting","Deepshadow Earring of Fending","Deepshadow Earring of Healing","Deepshadow Earring of Slaying","Demagogue Earrings","Demon Brick Earring","Diadochos Earring of Aiming","Diadochos Earring of Casting","Diadochos Earring of Fending","Diadochos Earring of Healing","Diadochos Earring of Slaying","Diamond Earring of Aiming","Diamond Earring of Casting","Diamond Earring of Fending","Diamond Earring of Healing","Diamond Earring of Slaying","Diamond Earrings","Diamond Lone Wolf Earrings","Diamond Pack Wolf Earrings","Diaspore Earrings of Aiming","Diaspore Earrings of Casting","Diaspore Earrings of Fending","Diaspore Earrings of Healing","Diaspore Earrings of Slaying","Direwolf Earrings of Aiming","Direwolf Earrings of Casting","Direwolf Earrings of Fending","Direwolf Earrings of Healing","Direwolf Earrings of Slaying","Distance Earring of Aiming","Distance Earring of Casting","Distance Earring of Fending","Distance Earring of Healing","Distance Earring of Slaying","Dodo Earring","Donut Earring","Dragon Fang Earrings","Dravanian Earrings of Aiming","Dravanian Earrings of Casting","Dravanian Earrings of Fending","Dravanian Earrings of Healing","Dravanian Earrings of Slaying","Dreadwyrm Earring of Aiming","Dreadwyrm Earring of Casting","Dreadwyrm Earring of Fending","Dreadwyrm Earring of Healing","Dreadwyrm Earring of Slaying","Dwarven Mythril Ear Cuffs","Earrings of Divine Death","Earrings of Divine Wisdom","Earrings of the Daring Duelist","Earrings of the Defiant Duelist","Earrings of the Divine Harvest","Earrings of the Divine Light","Earrings of the Divine War","Earrings of the First Light","Earrings of the Lost Thief","Earrings of the Sea-folk","Edencall Earrings of Aiming","Edencall Earrings of Casting","Edencall Earrings of Fending","Edencall Earrings of Healing","Edencall Earrings of Slaying","Edenchoir Earrings of Aiming","Edenchoir Earrings of Casting","Edenchoir Earrings of Fending","Edenchoir Earrings of Healing","Edenchoir Earrings of Slaying","Edengate Earring of Aiming","Edengate Earring of Casting","Edengate Earring of Fending","Edengate Earring of Healing","Edengate Earring of Slaying","Edengrace Earring of Aiming","Edengrace Earring of Casting","Edengrace Earring of Fending","Edengrace Earring of Healing","Edengrace Earring of Slaying","Edenmete Earrings of Aiming","Edenmete Earrings of Casting","Edenmete Earrings of Fending","Edenmete Earrings of Healing","Edenmete Earrings of Slaying","Edenmorn Earrings of Aiming","Edenmorn Earrings of Casting","Edenmorn Earrings of Fending","Edenmorn Earrings of Healing","Edenmorn Earrings of Slaying","Egg Earrings","Eikon Iron Earring of Aiming","Eikon Iron Earring of Casting","Eikon Iron Earring of Fending","Eikon Iron Earring of Healing","Eikon Iron Earring of Slaying","Electrum Ear Cuffs","Electrum Earrings","Emerald Carbuncle Earring","Emerald Earrings","Empyrean Earring","En Fortune-teller's Earrings","Enaretos Earrings","Epochal Earrings of Aiming","Epochal Earrings of Casting","Epochal Earrings of Fending","Epochal Earrings of Healing","Epochal Earrings of Slaying","Eternal Dark Earrings of Aiming","Eternal Dark Earrings of Casting","Eternal Dark Earrings of Fending","Eternal Dark Earrings of Healing","Eternal Dark Earrings of Slaying","Etheirys Earring of Aiming","Etheirys Earring of Casting","Etheirys Earring of Fending","Etheirys Earring of Healing","Etheirys Earring of Slaying","Evenstar Earrings","Eversharp Earring","Exarchic Earrings of Aiming","Exarchic Earrings of Casting","Exarchic Earrings of Fending","Exarchic Earrings of Healing","Exarchic Earrings of Slaying","Explorer's Earrings","Fabled Earrings of Aiming","Fabled Earrings of Casting","Fabled Earrings of Fending","Fabled Earrings of Healing","Fabled Earrings of Slaying","Facet Earrings of Aiming","Facet Earrings of Casting","Facet Earrings of Fending","Facet Earrings of Healing","Facet Earrings of Slaying","Fang Earrings","Farlander Earrings of Aiming","Farlander Earrings of Casting","Farlander Earrings of Fending","Farlander Earrings of Healing","Farlander Earrings of Slaying","Fat Cat Earrings","Faux Commander Earring","Filibuster's Earring of Aiming","Filibuster's Earring of Casting","Filibuster's Earring of Fending","Filibuster's Earring of Healing","Filibuster's Earring of Slaying","Firecrest Earring","Fisher's Earrings","Flame Sergeant's Ear Cuffs","Flame Sergeant's Earrings","Fluorite Earrings","Garnet Earrings","Gazelleskin Earrings","Genji Earrings of Aiming","Genji Earrings of Casting","Genji Earrings of Fending","Genji Earrings of Healing","Genji Earrings of Slaying","Genta Earrings of Aiming","Genta Earrings of Casting","Genta Earrings of Fending","Genta Earrings of Healing","Genta Earrings of Slaying","Ghost Barque Earrings of Aiming","Ghost Barque Earrings of Casting","Ghost Barque Earrings of Fending","Ghost Barque Earrings of Healing","Ghost Barque Earrings of Slaying","Ginseng Earring of Aiming","Ginseng Earring of Casting","Ginseng Earring of Fending","Ginseng Earring of Healing","Ginseng Earring of Slaying","Ginseng Earrings","Glass Pumpkin Earring","Gloam Earrings","Gold Lone Wolf Earrings","Gold Pack Wolf Earrings","Gomphotherium Earrings","Goobbue Earring","Gordian Earrings of Aiming","Gordian Earrings of Casting","Gordian Earrings of Fending","Gordian Earrings of Healing","Gordian Earrings of Slaying","Goshenite Earrings","Grand Champion's Ear Cuff of Aiming","Grand Champion's Ear Cuff of Casting","Grand Champion's Ear Cuff of Fending","Grand Champion's Ear Cuff of Healing","Grand Champion's Ear Cuff of Slaying","Green Carnation Earring","Green Moth Orchid Earring","Green Paperflower Earring","Green Triteleia Earring","Gyuki Leather Earrings","Halone's Earring","Halonic Auditor's Earrings","Halonic Exorcist's Earrings","Halonic Friar's Earrings","Halonic Inquisitor's Earrings","Halonic Priest's Earrings","Handking's Earring","Handmaster's Earrings","Handsaint's Earrings","Hardsilver Earrings of Aiming","Hardsilver Earrings of Casting","Hardsilver Earrings of Fending","Hardsilver Earrings of Gathering","Hardsilver Earrings of Healing","Hardsilver Earrings of Slaying","Hatchling Earring","Heavyweight Ear Cuff of Aiming","Heavyweight Ear Cuff of Casting","Heavyweight Ear Cuff of Fending","Heavyweight Ear Cuff of Healing","Heavyweight Ear Cuff of Slaying","Heirloom Earring of Aiming","Heirloom Earring of Casting","Heirloom Earring of Fending","Heirloom Earring of Healing","Heirloom Earring of Slaying","Heliodor Earrings","Hellwolf Earrings of Aiming","Hellwolf Earrings of Casting","Hellwolf Earrings of Fending","Hellwolf Earrings of Healing","Hellwolf Earrings of Slaying","Hematite Earrings of Aiming","Hematite Earrings of Casting","Hematite Earrings of Fending","Hematite Earrings of Healing","Hematite Earrings of Slaying","Hero's Earrings of Aiming","Hero's Earrings of Casting","Hero's Earrings of Fending","Hero's Earrings of Healing","Hero's Earrings of Slaying","High Allagan Earrings of Aiming","High Allagan Earrings of Casting","High Allagan Earrings of Fending","High Allagan Earrings of Healing","High Allagan Earrings of Slaying","Historia Earrings of Aiming","Historia Earrings of Casting","Historia Earrings of Fending","Historia Earrings of Healing","Historia Earrings of Slaying","Hoplite Earrings","Horn Earrings","Horse Chestnut Earrings of Gathering","Ihuykanite Earring of Aiming","Ihuykanite Earring of Casting","Ihuykanite Earring of Fending","Ihuykanite Earring of Healing","Ihuykanite Earring of Slaying","Immaculate Ear Cuffs of Aiming","Immaculate Ear Cuffs of Casting","Immaculate Ear Cuffs of Fending","Immaculate Ear Cuffs of Healing","Immaculate Ear Cuffs of Slaying","Imperial Earring of Aiming","Imperial Earring of Casting","Imperial Earring of Fending","Imperial Earring of Healing","Imperial Earring of Slaying","Imperial Jade Earrings of Aiming","Imperial Jade Earrings of Casting","Imperial Jade Earrings of Fending","Imperial Jade Earrings of Healing","Imperial Jade Earrings of Slaying","Indagator's Earrings of Crafting","Indagator's Earrings of Gathering","Integral Earrings of Crafting","Iolite Earrings","Ironwood Earrings of Crafting","Ironworks Earring of Crafting","Ironworks Earring of Gathering","Ironworks Earrings of Aiming","Ironworks Earrings of Casting","Ironworks Earrings of Fending","Ironworks Earrings of Healing","Ironworks Earrings of Slaying","Ishgardian Chaplain's Earrings","Ishgardian Historian's Earrings","Ishgardian Knight's Earrings","Ishgardian Monastic's Earrings","Ishgardian Outrider's Earrings","Koppranickel Earrings of Aiming","Koppranickel Earrings of Casting","Koppranickel Earrings of Fending","Koppranickel Earrings of Healing","Koppranickel Earrings of Slaying","Ktiseos Earring of Aiming","Ktiseos Earring of Casting","Ktiseos Earring of Fending","Ktiseos Earring of Healing","Ktiseos Earring of Slaying","Kumbhiraskin Earrings of Gathering","Lakeland Earring of Aiming","Lakeland Earring of Casting","Lakeland Earring of Fending","Lakeland Earring of Healing","Lakeland Earring of Slaying","Lakshmi's Earrings of Aiming","Lakshmi's Earrings of Casting","Lakshmi's Earrings of Fending","Lakshmi's Earrings of Healing","Lakshmi's Earrings of Slaying","Landking's Earring","Landmaster's Earrings","Landsaint's Earrings","Lapis Lazuli Earrings","Lar Ear Cuffs","Larch Earrings","Light-heavy Earring of Aiming","Light-heavy Earring of Casting","Light-heavy Earring of Fending","Light-heavy Earring of Healing","Light-heavy Earring of Slaying","Lignum Vitae Earrings","Lily and Serpent Earrings","Limbo Earrings of Aiming","Limbo Earrings of Casting","Limbo Earrings of Fending","Limbo Earrings of Healing","Limbo Earrings of Slaying","Lone Faehound Earring","Lone Hellhound Earring","Loporrit Earrings","Lost Allagan Earrings of Aiming","Lost Allagan Earrings of Casting","Lost Allagan Earrings of Fending","Lost Allagan Earrings of Healing","Lost Allagan Earrings of Slaying","Lunar Envoy's Earring of Aiming","Lunar Envoy's Earring of Casting","Lunar Envoy's Earring of Fending","Lunar Envoy's Earring of Healing","Lunar Envoy's Earring of Slaying","Mage's Earrings","Makai Earring of Aiming","Makai Earring of Casting","Makai Earring of Fending","Makai Earring of Healing","Makai Earring of Slaying","Malachite Earrings","Mameshiba Earring","Manalis Earrings of Aiming","Manalis Earrings of Casting","Manalis Earrings of Fending","Manalis Earrings of Healing","Manalis Earrings of Slaying","Manasilver Ear Cuffs","Manderville Earrings","Manusya Earrings of Aiming","Manusya Earrings of Casting","Manusya Earrings of Fending","Manusya Earrings of Healing","Manusya Earrings of Slaying","Marid Leather Earrings","Menphina's Earring","Midan Earrings of Aiming","Midan Earrings of Casting","Midan Earrings of Fending","Midan Earrings of Healing","Midan Earrings of Slaying","Midnight Egg Earrings","Militia Earrings","Miner's Earring","Mirage Earring","Mistbreak Earrings of Aiming","Mistbreak Earrings of Casting","Mistbreak Earrings of Fending","Mistbreak Earrings of Healing","Mistbreak Earrings of Slaying","Mistfall Earrings of Aiming","Mistfall Earrings of Casting","Mistfall Earrings of Fending","Mistfall Earrings of Healing","Mistfall Earrings of Slaying","Mistic Memory Earrings of Aiming","Mistic Memory Earrings of Casting","Mistic Memory Earrings of Fending","Mistic Memory Earrings of Healing","Mistic Memory Earrings of Slaying","Mistwake Earring of Aiming","Mistwake Earring of Casting","Mistwake Earring of Fending","Mistwake Earring of Healing","Mistwake Earring of Slaying","Molybdenum Earring of Aiming","Molybdenum Earring of Casting","Molybdenum Earring of Fending","Molybdenum Earring of Healing","Molybdenum Earring of Slaying","Moogle Earrings","Moonlet","Moonward Earring of Aiming","Moonward Earring of Casting","Moonward Earring of Fending","Moonward Earring of Healing","Moonward Earring of Slaying","Mosshorn Earrings","Mythril Ear Cuffs","Mythril Earrings","Mythrite Earblades of Aiming","Mythrite Earblades of Casting","Mythrite Earblades of Fending","Mythrite Earblades of Healing","Mythrite Earblades of Slaying","Mythrite Earrings of Aiming","Mythrite Earrings of Casting","Mythrite Earrings of Fending","Mythrite Earrings of Gathering","Mythrite Earrings of Healing","Mythrite Earrings of Slaying","Nabaath Earrings of Aiming","Nabaath Earrings of Casting","Nabaath Earrings of Fending","Nabaath Earrings of Healing","Nabaath Earrings of Slaying","Namazu Earring","Natural Afflatus Earrings","Neo Kingdom Earrings of Aiming","Neo Kingdom Earrings of Casting","Neo Kingdom Earrings of Fending","Neo Kingdom Earrings of Healing","Neo Kingdom Earrings of Slaying","Neo-Ishgardian Earring of Aiming","Neo-Ishgardian Earring of Casting","Neo-Ishgardian Earring of Fending","Neo-Ishgardian Earring of Healing","Neo-Ishgardian Earring of Slaying","Noct Earrings","Nomad's Earrings of Aiming","Nomad's Earrings of Casting","Nomad's Earrings of Fending","Nomad's Earrings of Healing","Nomad's Earrings of Slaying","Occult Earrings of Blood","Occult Earrings of Magic","Omega Ear Cuff of Aiming","Omega Ear Cuff of Casting","Omega Ear Cuff of Fending","Omega Ear Cuff of Healing","Omega Ear Cuff of Slaying","Omega-F Earrings","Omega-M Ear Cuffs","Omicron Ear Cuff of Aiming","Omicron Ear Cuff of Casting","Omicron Ear Cuff of Fending","Omicron Ear Cuff of Healing","Omicron Ear Cuff of Slaying","Opal Earrings of Aiming","Opal Earrings of Casting","Opal Earrings of Fending","Opal Earrings of Healing","Opal Earrings of Slaying","Ophiotauroskin Earrings of Gathering","Orange Carnation Earring","Orange Moth Orchid Earring","Orange Paperflower Earring","Orange Triteleia Earring","Origenics Earrings of Aiming","Origenics Earrings of Casting","Origenics Earrings of Fending","Origenics Earrings of Healing","Origenics Earrings of Slaying","Orthodox Earrings of Aiming","Orthodox Earrings of Casting","Orthodox Earrings of Fending","Orthodox Earrings of Healing","Orthodox Earrings of Slaying","Pack Faehound Earring","Pack Hellhound Earring","Paglth'an Earring of Aiming","Paglth'an Earring of Casting","Paglth'an Earring of Fending","Paglth'an Earring of Healing","Paglth'an Earring of Slaying","Paissa Earring","Palaka Earrings of Aiming","Palaka Earrings of Casting","Palaka Earrings of Fending","Palaka Earrings of Healing","Palaka Earrings of Slaying","Palladium Earring of Aiming","Palladium Earring of Casting","Palladium Earring of Fending","Palladium Earring of Healing","Palladium Earring of Slaying","Palm Ear Cuffs of Aiming","Palm Ear Cuffs of Casting","Palm Ear Cuffs of Fending","Palm Ear Cuffs of Healing","Palm Ear Cuffs of Slaying","Panegyrist's Earrings","Paramour's Earrings","Peach Blossoms","Pearl Earrings","Peltast Earrings","Peridot Earrings","Persimmon Earrings","Petalite Earrings of Aiming","Petalite Earrings of Casting","Petalite Earrings of Fending","Petalite Earrings of Healing","Petalite Earrings of Slaying","Phantasmal Sardine Earring","Phrygian Ear Cuffs of Aiming","Phrygian Ear Cuffs of Casting","Phrygian Ear Cuffs of Fending","Phrygian Ear Cuffs of Healing","Phrygian Ear Cuffs of Slaying","Picaroon's Earrings of Slaying","Pink Beryl Earrings of Aiming","Pink Beryl Earrings of Casting","Pink Beryl Earrings of Fending","Pink Beryl Earrings of Healing","Pink Beryl Earrings of Slaying","Pixie Earrings","Plague Bringer's Earrings","Plague Doctor's Earrings","Platinum Earrings of Aiming","Platinum Earrings of Casting","Platinum Earrings of Fending","Platinum Earrings of Healing","Platinum Earrings of Slaying","Platinum Lone Wolf Earrings","Platinum Pack Wolf Earrings","Platinum Paramour's Earrings","Plundered Ear Cuffs","Plundered Earrings","Porxie Earrings","Praemagitek Earrings of Aiming","Praemagitek Earrings of Casting","Praemagitek Earrings of Fending","Praemagitek Earrings of Healing","Praemagitek Earrings of Slaying","Primal Earrings of Aiming","Primal Earrings of Casting","Primal Earrings of Fending","Primal Earrings of Healing","Primal Earrings of Slaying","Prophet's Earrings","Proto Ultima Earrings of Aiming","Proto Ultima Earrings of Casting","Proto Ultima Earrings of Fending","Proto Ultima Earrings of Healing","Proto Ultima Earrings of Slaying","Prototype Alexandrian Earrings of Aiming","Prototype Alexandrian Earrings of Casting","Prototype Alexandrian Earrings of Fending","Prototype Alexandrian Earrings of Healing","Prototype Alexandrian Earrings of Slaying","Prototype Gordian Earrings of Aiming","Prototype Gordian Earrings of Casting","Prototype Gordian Earrings of Fending","Prototype Gordian Earrings of Healing","Prototype Gordian Earrings of Slaying","Prototype Midan Earrings of Aiming","Prototype Midan Earrings of Casting","Prototype Midan Earrings of Fending","Prototype Midan Earrings of Healing","Prototype Midan Earrings of Slaying","Pumpkin Earrings","Purgatory Earrings of Aiming","Purgatory Earrings of Casting","Purgatory Earrings of Fending","Purgatory Earrings of Healing","Purgatory Earrings of Slaying","Purple Carnation Earring","Purple Moth Orchid Earring","Purple Paperflower Earring","Purple Triteleia Earring","Qiqirn Earring","Quetzalli Ear Cuffs of Aiming","Quetzalli Ear Cuffs of Casting","Quetzalli Ear Cuffs of Fending","Quetzalli Ear Cuffs of Healing","Quetzalli Ear Cuffs of Slaying","Radiant's Earrings of Aiming","Radiant's Earrings of Casting","Radiant's Earrings of Fending","Radiant's Earrings of Healing","Radiant's Earrings of Slaying","Rainbow Carnation Earring","Rainbow Moth Orchid Earring","Rainbow Paperflower Earring","Rainbow Triteleia Earring","Rakshasa Earring of Aiming","Rakshasa Earring of Casting","Rakshasa Earring of Fending","Rakshasa Earring of Healing","Rakshasa Earring of Slaying","Ravel Keeper's Earring of Aiming","Ravel Keeper's Earring of Casting","Ravel Keeper's Earring of Fending","Ravel Keeper's Earring of Healing","Ravel Keeper's Earring of Slaying","Realm-roamer's Earrings","Red Carnation Earring","Red Coral Earrings","Red Moth Orchid Earring","Red Paperflower Earring","Red Triteleia Earring","Replica Manderville Earrings","Replica White Ravens","Resilient Earring of Aiming","Resilient Earring of Casting","Resilient Earring of Fending","Resilient Earring of Healing","Resilient Earring of Slaying","Rinascita Earring of Aiming","Rinascita Earring of Casting","Rinascita Earring of Fending","Rinascita Earring of Healing","Rinascita Earring of Slaying","Riversbreath Earring of Aiming","Riversbreath Earring of Casting","Riversbreath Earring of Fending","Riversbreath Earring of Healing","Riversbreath Earring of Slaying","Ronkan Earrings of Aiming","Ronkan Earrings of Casting","Ronkan Earrings of Fending","Ronkan Earrings of Healing","Ronkan Earrings of Slaying","Rose Gold Ear Cuffs","Rose Gold Ear Screws","Rose Gold Earrings","Rose Gold Earrings of Gathering","Royal Volunteer's Earrings of Aiming","Royal Volunteer's Earrings of Casting","Royal Volunteer's Earrings of Fending","Royal Volunteer's Earrings of Healing","Royal Volunteer's Earrings of Slaying","Rubellite Earrings","Ruby Earrings","Ruby Tide Earrings of Aiming","Ruby Tide Earrings of Casting","Ruby Tide Earrings of Fending","Ruby Tide Earrings of Healing","Ruby Tide Earrings of Slaying","Ryumyaku Earring of Aiming","Ryumyaku Earring of Casting","Ryumyaku Earring of Fending","Ryumyaku Earring of Healing","Ryumyaku Earring of Slaying","Sapphire Earrings","Scaevan Ear Cuff of Aiming","Scaevan Ear Cuff of Casting","Scaevan Ear Cuff of Fending","Scaevan Ear Cuff of Healing","Scaevan Ear Cuff of Slaying","Scintillant Earring of Aiming","Scintillant Earring of Casting","Scintillant Earring of Fending","Scintillant Earring of Healing","Scintillant Earring of Slaying","Scion Liberator's Earrings","Serpent Sergeant's Ear Cuffs","Serpent Sergeant's Earrings","Shadowless Earrings of Aiming","Shadowless Earrings of Casting","Shadowless Earrings of Fending","Shadowless Earrings of Healing","Shadowless Earrings of Slaying","Sharlayan Conservator's Earrings","Sharlayan Custodian's Earrings","Sharlayan Pankratiast's Earrings","Sharlayan Philosopher's Earrings","Sharlayan Preceptor's Earrings","Shire Conservator's Earrings","Shire Custodian's Earrings","Shire Pankratiast's Earring","Shire Philosopher's Earring","Shire Preceptor's Earrings","Sil'dihn Earring","Silkie Earring","Silver Ear Cuffs","Silver Earrings","Silver Lone Wolf Earrings","Silver Pack Wolf Earrings","Silvergrace Earring of Aiming","Silvergrace Earring of Casting","Silvergrace Earring of Fending","Silvergrace Earring of Healing","Silvergrace Earring of Slaying","Silvergrace Earrings of Crafting","Silvergrace Earrings of Gathering","Skallic Earring of Aiming","Skallic Earring of Casting","Skallic Earring of Fending","Skallic Earring of Healing","Skallic Earring of Slaying","Skydeep Earrings of Aiming","Skydeep Earrings of Casting","Skydeep Earrings of Fending","Skydeep Earrings of Healing","Skydeep Earrings of Slaying","Slime Earrings","Smilodonskin Earrings","Sphene Earrings","Spinel Earrings","Spriggan Earrings","Star Quartz Earrings of Aiming","Star Quartz Earrings of Casting","Star Quartz Earrings of Fending","Star Quartz Earrings of Healing","Star Quartz Earrings of Slaying","Star Spinel Earrings of Aiming","Star Spinel Earrings of Casting","Star Spinel Earrings of Fending","Star Spinel Earrings of Healing","Star Spinel Earrings of Slaying","Star Tech Ear Cuff of Crafting","Star Tech Ear Cuff of Gathering","Stonewall Earrings","Storm Sergeant's Ear Cuffs","Storm Sergeant's Earrings","Strategos Earrings","Sunburst Earring of Aiming","Sunburst Earring of Casting","Sunburst Earring of Fending","Sunburst Earring of Healing","Sunburst Earring of Slaying","Sunstone Earrings","Sunstreak Earring of Aiming","Sunstreak Earring of Casting","Sunstreak Earring of Fending","Sunstreak Earring of Healing","Sunstreak Earring of Slaying","The Emperor's New Earrings","The Forgiven's Earrings of Aiming","The Forgiven's Earrings of Casting","The Forgiven's Earrings of Fending","The Forgiven's Earrings of Healing","The Forgiven's Earrings of Slaying","The Last Earring of Aiming","The Last Earring of Casting","The Last Earring of Fending","The Last Earring of Healing","The Last Earring of Slaying","The Twelve's Earrings of Aiming","The Twelve's Earrings of Casting","The Twelve's Earrings of Fending","The Twelve's Earrings of Healing","The Twelve's Earrings of Slaying","The Warden's Earring","Tipping Scales Earrings","Topaz Carbuncle Earring","Topaz Earrings","Tourmaline Earrings","Toxotes Earrings","Tremor Earrings of Aiming","Tremor Earrings of Casting","Tremor Earrings of Fending","Tremor Earrings of Healing","Tremor Earrings of Slaying","Triphane Earrings of Aiming","Triphane Earrings of Casting","Triphane Earrings of Fending","Triphane Earrings of Healing","Triphane Earrings of Slaying","Triplite Earrings of Aiming","Triplite Earrings of Casting","Triplite Earrings of Fending","Triplite Earrings of Healing","Triplite Earrings of Slaying","Troian Earrings of Aiming","Troian Earrings of Casting","Troian Earrings of Fending","Troian Earrings of Healing","Troian Earrings of Slaying","Turquoise Earrings","Underkeep Earrings of Aiming","Underkeep Earrings of Casting","Underkeep Earrings of Fending","Underkeep Earrings of Healing","Underkeep Earrings of Slaying","Uolosapa Earring","Valerian Archer's Earrings","Valerian Brawler's Earrings","Valerian Dark Priest's Earrings","Valerian Fusilier's Earrings","Valerian Priest's Earrings","Valerian Shaman's Earrings","Valerian Smuggler's Earrings","Valerian Terror Knight's Earrings","Valerian Wizard's Earrings","Valkyrie's Earrings of Aiming","Valkyrie's Earrings of Casting","Valkyrie's Earrings of Fending","Valkyrie's Earrings of Healing","Valkyrie's Earrings of Slaying","Vanguard Earrings of Aiming","Vanguard Earrings of Casting","Vanguard Earrings of Fending","Vanguard Earrings of Healing","Vanguard Earrings of Slaying","Varlet's Earrings","Vibrant Egg Earrings","Viking Earrings","Voeburtite Earring of Aiming","Voeburtite Earring of Casting","Voeburtite Earring of Fending","Voeburtite Earring of Healing","Voeburtite Earring of Slaying","Voice of the Just","Voidmoon Ear Cuffs of Aiming","Voidmoon Ear Cuffs of Casting","Voidmoon Ear Cuffs of Fending","Voidmoon Ear Cuffs of Healing","Voidmoon Ear Cuffs of Slaying","Warg Earring of Aiming","Warg Earring of Casting","Warg Earring of Fending","Warg Earring of Healing","Warg Earring of Slaying","Warwolf Earrings of Aiming","Warwolf Earrings of Casting","Warwolf Earrings of Fending","Warwolf Earrings of Healing","Warwolf Earrings of Slaying","Wayfarer's Earcuff","Weathered Auroral Earrings","Weathered Daystar Earrings","Weathered Earrings","Weathered Evenstar Earrings","Weathered Gloam Earrings","Weathered Noct Earrings","Werewolf Earrings of Aiming","Werewolf Earrings of Casting","Werewolf Earrings of Fending","Werewolf Earrings of Healing","Werewolf Earrings of Slaying","Whalaqee Earrings","White Ash Earring of Aiming","White Ash Earring of Casting","White Ash Earring of Fending","White Ash Earring of Healing","White Ash Earring of Slaying","White Ash Earrings","White Carnation Earring","White Gold Earrings of Aiming","White Gold Earrings of Casting","White Gold Earrings of Fending","White Gold Earrings of Healing","White Gold Earrings of Slaying","White Moth Orchid Earring","White Oak Earrings","White Paperflower Earring","White Ravens","White Triteleia Earring","Woad Skydruid's Earrings","Woad Skyhunter's Earrings","Woad Skyraider's Earrings","Woad Skywarrior's Earrings","Woad Skywicce's Earrings","Wolf Amber Earrings","Wolf Earrings","Wolf Rubellite Earrings","Wolf Spinel Earrings","Wolf Tourmaline Earrings","Wolf Turquoise Earrings","Wolf Zircon Earrings","Wrangler's Earrings","Xenobian Paladin's Earrings","Yama Earring of Aiming","Yama Earring of Casting","Yama Earring of Fending","Yama Earring of Healing","Yama Earring of Slaying","Yanxian Earring of Aiming","Yanxian Earring of Casting","Yanxian Earring of Fending","Yanxian Earring of Healing","Yanxian Earring of Slaying","Yasha Earring of Aiming","Yasha Earring of Casting","Yasha Earring of Fending","Yasha Earring of Healing","Yasha Earring of Slaying","Yellow Carnation Earring","Yellow Moth Orchid Earring","Yellow Paperflower Earring","Yellow Triteleia Earring","Yeti Fang Earrings","Yuweyawata Earrings of Aiming","Yuweyawata Earrings of Casting","Yuweyawata Earrings of Fending","Yuweyawata Earrings of Healing","Yuweyawata Earrings of Slaying","Zelkova Earrings","Zero's Order Earring","Zircon Earrings","Zormor Earrings of Aiming","Zormor Earrings of Casting","Zormor Earrings of Fending","Zormor Earrings of Healing","Zormor Earrings of Slaying"]),"neck":new Set(["Abyssos Choker of Aiming","Abyssos Choker of Casting","Abyssos Choker of Fending","Abyssos Choker of Healing","Abyssos Choker of Slaying","Acacia Necklace","Aesthete's Choker of Crafting","Aesthete's Necklace of Gathering","Aetherial Amber Choker","Aetherial Amethyst Choker","Aetherial Aquamarine Choker","Aetherial Black Pearl Choker","Aetherial Brass Gorget","Aetherial Danburite Choker","Aetherial Electrum Gorget","Aetherial Fang Necklace","Aetherial Fluorite Choker","Aetherial Garnet Choker","Aetherial Goshenite Choker","Aetherial Heliodor Choker","Aetherial Horn Necklace","Aetherial Lapis Lazuli Choker","Aetherial Malachite Choker","Aetherial Mythril Gorget","Aetherial Pearl Choker","Aetherial Peridot Choker","Aetherial Red Coral Necklace","Aetherial Rubellite Choker","Aetherial Silver Gorget","Aetherial Sphene Choker","Aetherial Spinel Choker","Aetherial Sunstone Choker","Aetherial Tourmaline Choker","Aetherial Turquoise Choker","Aetherial Wolf Necklace","Aetherial Zircon Choker","Ahriman Choker","Ala Mhigan Necklace of Aiming","Ala Mhigan Necklace of Casting","Ala Mhigan Necklace of Fending","Ala Mhigan Necklace of Healing","Ala Mhigan Necklace of Slaying","Alexandrian Neckband of Aiming","Alexandrian Neckband of Casting","Alexandrian Neckband of Fending","Alexandrian Neckband of Healing","Alexandrian Neckband of Slaying","Allagan Choker of Aiming","Allagan Choker of Casting","Allagan Choker of Fending","Allagan Choker of Healing","Allagan Choker of Maiming","Allagan Choker of Striking","Alliance Necklace of Aiming","Alliance Necklace of Casting","Alliance Necklace of Fending","Alliance Necklace of Healing","Alliance Necklace of Slaying","Alpaca Neck Warmer","Alpha Wolf Choker","Amaurotine Choker of Aiming","Amaurotine Choker of Casting","Amaurotine Choker of Fending","Amaurotine Choker of Healing","Amaurotine Choker of Slaying","Amber Choker","Amethyst Choker","Ametrine Choker of Aiming","Ametrine Choker of Casting","Ametrine Choker of Fending","Ametrine Choker of Healing","Ametrine Choker of Slaying","Ametrine Necklace of Crafting","Anabaseios Necklace of Aiming","Anabaseios Necklace of Casting","Anabaseios Necklace of Fending","Anabaseios Necklace of Healing","Anabaseios Necklace of Slaying","Anamnesis Choker of Aiming","Anamnesis Choker of Casting","Anamnesis Choker of Fending","Anamnesis Choker of Healing","Anamnesis Choker of Slaying","Aquamarine Choker","Archeo Kingdom Choker of Aiming","Archeo Kingdom Choker of Casting","Archeo Kingdom Choker of Fending","Archeo Kingdom Choker of Healing","Archeo Kingdom Choker of Slaying","Ardent Necklace of Aiming","Ardent Necklace of Casting","Ardent Necklace of Fending","Ardent Necklace of Healing","Ardent Necklace of Slaying","Arhat Necklace of Aiming","Arhat Necklace of Casting","Arhat Necklace of Fending","Arhat Necklace of Healing","Arhat Necklace of Slaying","Artful Afflatus Necklace","Ascension Necklace of Aiming","Ascension Necklace of Casting","Ascension Necklace of Fending","Ascension Necklace of Healing","Ascension Necklace of Slaying","Asphodelos Necklace of Aiming","Asphodelos Necklace of Casting","Asphodelos Necklace of Fending","Asphodelos Necklace of Healing","Asphodelos Necklace of Slaying","Astral Birch Necklace","Astral Choker","Asuran Necklace of Aiming","Asuran Necklace of Casting","Asuran Necklace of Fending","Asuran Necklace of Healing","Asuran Necklace of Slaying","Atrociraptorskin Necklace of Aiming","Atrociraptorskin Necklace of Casting","Atrociraptorskin Necklace of Fending","Atrociraptorskin Necklace of Healing","Atrociraptorskin Necklace of Slaying","Augmented Archeo Kingdom Choker of Aiming","Augmented Archeo Kingdom Choker of Casting","Augmented Archeo Kingdom Choker of Fending","Augmented Archeo Kingdom Choker of Healing","Augmented Archeo Kingdom Choker of Slaying","Augmented Black Willow Necklace of Aiming","Augmented Black Willow Necklace of Casting","Augmented Black Willow Necklace of Fending","Augmented Black Willow Necklace of Healing","Augmented Black Willow Necklace of Slaying","Augmented Bygone Brass Choker of Aiming","Augmented Bygone Brass Choker of Casting","Augmented Bygone Brass Choker of Fending","Augmented Bygone Brass Choker of Healing","Augmented Bygone Brass Choker of Slaying","Augmented Ceremonial Necklace of Aiming","Augmented Ceremonial Necklace of Casting","Augmented Ceremonial Necklace of Fending","Augmented Ceremonial Necklace of Healing","Augmented Ceremonial Necklace of Slaying","Augmented Classical Choker of Aiming","Augmented Classical Choker of Casting","Augmented Classical Choker of Fending","Augmented Classical Choker of Healing","Augmented Classical Choker of Slaying","Augmented Courtly Lover's Choker of Aiming","Augmented Courtly Lover's Choker of Casting","Augmented Courtly Lover's Choker of Fending","Augmented Courtly Lover's Choker of Healing","Augmented Courtly Lover's Choker of Slaying","Augmented Credendum Necklace of Aiming","Augmented Credendum Necklace of Casting","Augmented Credendum Necklace of Fending","Augmented Credendum Necklace of Healing","Augmented Credendum Necklace of Slaying","Augmented Cryptlurker's Choker of Aiming","Augmented Cryptlurker's Choker of Casting","Augmented Cryptlurker's Choker of Fending","Augmented Cryptlurker's Choker of Healing","Augmented Cryptlurker's Choker of Slaying","Augmented Crystarium Choker of Aiming","Augmented Crystarium Choker of Casting","Augmented Crystarium Choker of Fending","Augmented Crystarium Choker of Healing","Augmented Crystarium Choker of Slaying","Augmented Deepshadow Necklace of Aiming","Augmented Deepshadow Necklace of Casting","Augmented Deepshadow Necklace of Fending","Augmented Deepshadow Necklace of Healing","Augmented Deepshadow Necklace of Slaying","Augmented Diadochos Choker of Aiming","Augmented Diadochos Choker of Casting","Augmented Diadochos Choker of Fending","Augmented Diadochos Choker of Healing","Augmented Diadochos Choker of Slaying","Augmented Exarchic Choker of Aiming","Augmented Exarchic Choker of Casting","Augmented Exarchic Choker of Fending","Augmented Exarchic Choker of Healing","Augmented Exarchic Choker of Slaying","Augmented Facet Choker of Aiming","Augmented Facet Choker of Casting","Augmented Facet Choker of Fending","Augmented Facet Choker of Healing","Augmented Facet Choker of Slaying","Augmented Handmaster's Necklace","Augmented Historia Choker of Aiming","Augmented Historia Choker of Casting","Augmented Historia Choker of Fending","Augmented Historia Choker of Healing","Augmented Historia Choker of Slaying","Augmented Ironworks Choker of Aiming","Augmented Ironworks Choker of Casting","Augmented Ironworks Choker of Fending","Augmented Ironworks Choker of Healing","Augmented Ironworks Choker of Slaying","Augmented Landmaster's Choker","Augmented Lost Allagan Choker of Aiming","Augmented Lost Allagan Choker of Casting","Augmented Lost Allagan Choker of Fending","Augmented Lost Allagan Choker of Healing","Augmented Lost Allagan Choker of Slaying","Augmented Lunar Envoy's Necklace of Aiming","Augmented Lunar Envoy's Necklace of Casting","Augmented Lunar Envoy's Necklace of Fending","Augmented Lunar Envoy's Necklace of Healing","Augmented Lunar Envoy's Necklace of Slaying","Augmented Neo-Ishgardian Choker of Aiming","Augmented Neo-Ishgardian Choker of Casting","Augmented Neo-Ishgardian Choker of Fending","Augmented Neo-Ishgardian Choker of Healing","Augmented Neo-Ishgardian Choker of Slaying","Augmented Primal Choker of Aiming","Augmented Primal Choker of Casting","Augmented Primal Choker of Fending","Augmented Primal Choker of Healing","Augmented Primal Choker of Slaying","Augmented Quetzalli Necklace of Aiming","Augmented Quetzalli Necklace of Casting","Augmented Quetzalli Necklace of Fending","Augmented Quetzalli Necklace of Healing","Augmented Quetzalli Necklace of Slaying","Augmented Radiant's Choker of Aiming","Augmented Radiant's Choker of Casting","Augmented Radiant's Choker of Fending","Augmented Radiant's Choker of Healing","Augmented Radiant's Choker of Slaying","Augmented Rinascita Necklace of Aiming","Augmented Rinascita Necklace of Casting","Augmented Rinascita Necklace of Fending","Augmented Rinascita Necklace of Healing","Augmented Rinascita Necklace of Slaying","Augmented Scaevan Choker of Aiming","Augmented Scaevan Choker of Casting","Augmented Scaevan Choker of Fending","Augmented Scaevan Choker of Healing","Augmented Scaevan Choker of Slaying","Augmented Shire Conservator's Choker","Augmented Shire Custodian's Choker","Augmented Shire Pankratiast's Choker","Augmented Shire Philosopher's Choker","Augmented Shire Preceptor's Choker","Auroral Choker","Aurum Regis Necklace of Aiming","Aurum Regis Necklace of Casting","Aurum Regis Necklace of Fending","Aurum Regis Necklace of Healing","Aurum Regis Necklace of Slaying","Azurite Choker of Aiming","Azurite Choker of Casting","Azurite Choker of Fending","Azurite Choker of Healing","Azurite Choker of Slaying","Babyface Champion's Gorget of Aiming","Babyface Champion's Gorget of Casting","Babyface Champion's Gorget of Fending","Babyface Champion's Gorget of Healing","Babyface Champion's Gorget of Slaying","Band of Eternal Passion","Battleliege Choker of Aiming","Battleliege Choker of Casting","Battleliege Choker of Fending","Battleliege Choker of Healing","Battleliege Choker of Slaying","Berserker's Scarf","Black Byregotia Choker","Black Pearl Choker","Black Star Choker of Aiming","Black Star Choker of Casting","Black Star Choker of Fending","Black Star Choker of Healing","Black Star Choker of Slaying","Black Star Scarf of Crafting","Black Sweet Pea Necklace","Black Willow Necklace of Aiming","Black Willow Necklace of Casting","Black Willow Necklace of Crafting","Black Willow Necklace of Fending","Black Willow Necklace of Healing","Black Willow Necklace of Slaying","Blue Byregotia Choker","Blue Sweet Pea Necklace","Boarskin Choker","Bogatyr's Necklace of Aiming","Bogatyr's Necklace of Casting","Bogatyr's Necklace of Healing","Bone Necklace","Bonewicca Necklace of Aiming","Bonewicca Necklace of Casting","Bonewicca Necklace of Fending","Bonewicca Necklace of Healing","Bonewicca Necklace of Slaying","Brass Choker","Brass Gorget","Bronze Lone Wolf Choker","Bronze Pack Wolf Choker","Bygone Brass Choker of Aiming","Bygone Brass Choker of Casting","Bygone Brass Choker of Fending","Bygone Brass Choker of Healing","Bygone Brass Choker of Slaying","Cait Sith Neck Ribbon","Camphorwood Necklace of Aiming","Camphorwood Necklace of Casting","Camphorwood Necklace of Fending","Camphorwood Necklace of Healing","Camphorwood Necklace of Slaying","Carborundum Necklace of Aiming","Carborundum Necklace of Casting","Carborundum Necklace of Fending","Carborundum Necklace of Healing","Carborundum Necklace of Slaying","Ceremonial Necklace of Aiming","Ceremonial Necklace of Casting","Ceremonial Necklace of Fending","Ceremonial Necklace of Healing","Ceremonial Necklace of Slaying","Choker of Divine Death","Choker of Divine Wisdom","Choker of the Daring Duelist","Choker of the Defiant Duelist","Choker of the Divine Harvest","Choker of the Divine Light","Choker of the Divine War","Choker of the Lost Thief","Citrine Choker of Aiming","Citrine Choker of Casting","Citrine Choker of Fending","Citrine Choker of Healing","Citrine Choker of Slaying","Claro Walnut Necklace of Gathering","Classical Choker of Aiming","Classical Choker of Casting","Classical Choker of Fending","Classical Choker of Healing","Classical Choker of Slaying","Collar of the Sea-folk","Copper Choker","Copper Gorget","Corgi Scarf","Courtly Lover's Choker of Aiming","Courtly Lover's Choker of Casting","Courtly Lover's Choker of Fending","Courtly Lover's Choker of Healing","Courtly Lover's Choker of Slaying","Credendum Necklace of Aiming","Credendum Necklace of Casting","Credendum Necklace of Fending","Credendum Necklace of Healing","Credendum Necklace of Slaying","Crested Necklace of Crafting","Crested Necklace of Gathering","Cruiser Gorget of Aiming","Cruiser Gorget of Casting","Cruiser Gorget of Fending","Cruiser Gorget of Healing","Cruiser Gorget of Slaying","Cryptlurker's Choker of Aiming","Cryptlurker's Choker of Casting","Cryptlurker's Choker of Fending","Cryptlurker's Choker of Healing","Cryptlurker's Choker of Slaying","Crystarium Choker of Aiming","Crystarium Choker of Casting","Crystarium Choker of Fending","Crystarium Choker of Healing","Crystarium Choker of Slaying","Dai-ryumyaku Necklace of Aiming","Dai-ryumyaku Necklace of Casting","Dai-ryumyaku Necklace of Fending","Dai-ryumyaku Necklace of Healing","Dai-ryumyaku Necklace of Slaying","Danburite Choker","Darbar Necklace of Aiming","Darbar Necklace of Casting","Darbar Necklace of Fending","Darbar Necklace of Healing","Darbar Necklace of Slaying","Dark Horse Champion's Choker of Aiming","Dark Horse Champion's Choker of Casting","Dark Horse Champion's Choker of Fending","Dark Horse Champion's Choker of Healing","Dark Horse Champion's Choker of Slaying","Dark Mahogany Necklace of Aiming","Dark Mahogany Necklace of Casting","Dark Mahogany Necklace of Fending","Dark Mahogany Necklace of Healing","Dark Mahogany Necklace of Slaying","Darklight Choker of Aiming","Darklight Choker of Casting","Darklight Choker of Fending","Darklight Choker of Healing","Darklight Choker of Maiming","Darklight Choker of Striking","Dated Amethyst Choker","Dated Aquamarine Choker","Dated Brass Choker","Dated Copper Choker","Dated Danburite Choker","Dated Electrum Choker","Dated Fluorite Choker","Dated Garnet Choker","Dated Goshenite Choker","Dated Heliodor Choker","Dated Lapis Lazuli Choker","Dated Malachite Choker","Dated Mythril Choker","Dated Peridot Choker","Dated Silver Choker","Dated Sphene Choker","Dated Sunstone Choker","Daystar Necklace","Deepmist Necklace of Aiming","Deepmist Necklace of Casting","Deepmist Necklace of Fending","Deepmist Necklace of Healing","Deepmist Necklace of Slaying","Deepshadow Necklace of Aiming","Deepshadow Necklace of Casting","Deepshadow Necklace of Fending","Deepshadow Necklace of Healing","Deepshadow Necklace of Slaying","Demagogue Choker","Diadochos Choker of Aiming","Diadochos Choker of Casting","Diadochos Choker of Fending","Diadochos Choker of Healing","Diadochos Choker of Slaying","Diamond Choker","Diamond Lone Wolf Choker","Diamond Necklace of Aiming","Diamond Necklace of Casting","Diamond Necklace of Fending","Diamond Necklace of Healing","Diamond Necklace of Slaying","Diamond Pack Wolf Choker","Diaspore Choker of Aiming","Diaspore Choker of Casting","Diaspore Choker of Fending","Diaspore Choker of Healing","Diaspore Choker of Slaying","Direwolf Choker of Aiming","Direwolf Choker of Casting","Direwolf Choker of Fending","Direwolf Choker of Healing","Direwolf Choker of Slaying","Distance Choker of Aiming","Distance Choker of Casting","Distance Choker of Fending","Distance Choker of Healing","Distance Choker of Slaying","Dodore Choker","Dragonskin Choker","Dravanian Choker of Aiming","Dravanian Choker of Casting","Dravanian Choker of Fending","Dravanian Choker of Healing","Dravanian Choker of Slaying","Dreadwyrm Choker of Aiming","Dreadwyrm Choker of Casting","Dreadwyrm Choker of Fending","Dreadwyrm Choker of Healing","Dreadwyrm Choker of Slaying","Dwarven Mythril Choker","Edencall Choker of Aiming","Edencall Choker of Casting","Edencall Choker of Fending","Edencall Choker of Healing","Edencall Choker of Slaying","Edenchoir Choker of Aiming","Edenchoir Choker of Casting","Edenchoir Choker of Fending","Edenchoir Choker of Healing","Edenchoir Choker of Slaying","Edengate Choker of Aiming","Edengate Choker of Casting","Edengate Choker of Fending","Edengate Choker of Healing","Edengate Choker of Slaying","Edengrace Choker of Aiming","Edengrace Choker of Casting","Edengrace Choker of Fending","Edengrace Choker of Healing","Edengrace Choker of Slaying","Edenmete Necklace of Aiming","Edenmete Necklace of Casting","Edenmete Necklace of Fending","Edenmete Necklace of Healing","Edenmete Necklace of Slaying","Edenmorn Necklace of Aiming","Edenmorn Necklace of Casting","Edenmorn Necklace of Fending","Edenmorn Necklace of Healing","Edenmorn Necklace of Slaying","Electrum Choker","Electrum Gorget","Emerald Choker","Empyrean Necklace","Enaretos Necklace","Epochal Choker of Aiming","Epochal Choker of Casting","Epochal Choker of Fending","Epochal Choker of Healing","Epochal Choker of Slaying","Eternal Dark Necklace of Aiming","Eternal Dark Necklace of Casting","Eternal Dark Necklace of Fending","Eternal Dark Necklace of Healing","Eternal Dark Necklace of Slaying","Etheirys Choker of Aiming","Etheirys Choker of Casting","Etheirys Choker of Fending","Etheirys Choker of Healing","Etheirys Choker of Slaying","Evenstar Necklace","Eversharp Choker","Exarchic Choker of Aiming","Exarchic Choker of Casting","Exarchic Choker of Fending","Exarchic Choker of Healing","Exarchic Choker of Slaying","Explorer's Choker","Fabled Necklace of Aiming","Fabled Necklace of Casting","Fabled Necklace of Fending","Fabled Necklace of Healing","Fabled Necklace of Slaying","Facet Choker of Aiming","Facet Choker of Casting","Facet Choker of Fending","Facet Choker of Healing","Facet Choker of Slaying","Fang Necklace","Farlander Choker of Aiming","Farlander Choker of Casting","Farlander Choker of Fending","Farlander Choker of Healing","Farlander Choker of Slaying","Faux Commander Necklace","Filibuster's Choker of Aiming","Filibuster's Choker of Casting","Filibuster's Choker of Fending","Filibuster's Choker of Healing","Filibuster's Choker of Slaying","Firecrest Choker","Flame Sergeant's Choker","Fluorite Choker","Garnet Choker","Gazelleskin Choker","Genji Necklace of Aiming","Genji Necklace of Casting","Genji Necklace of Fending","Genji Necklace of Healing","Genji Necklace of Slaying","Genta Necklace of Aiming","Genta Necklace of Casting","Genta Necklace of Fending","Genta Necklace of Healing","Genta Necklace of Slaying","Ghost Barque Choker of Aiming","Ghost Barque Choker of Casting","Ghost Barque Choker of Fending","Ghost Barque Choker of Healing","Ghost Barque Choker of Slaying","Ginseng Necklace","Glass Pumpkin Choker","Gloam Choker","Goatskin Choker","Gold Lone Wolf Choker","Gold Pack Wolf Choker","Gomphotherium Necklace","Gordian Neckband of Aiming","Gordian Neckband of Casting","Gordian Neckband of Fending","Gordian Neckband of Healing","Gordian Neckband of Slaying","Goshenite Choker","Grand Champion's Neckband of Aiming","Grand Champion's Neckband of Casting","Grand Champion's Neckband of Fending","Grand Champion's Neckband of Healing","Grand Champion's Neckband of Slaying","Green Byregotia Choker","Green Sweet Pea Necklace","Griffin Leather Choker","Gryphonskin Choker","Gyuki Leather Choker","Hallowed Chestnut Necklace","Halonic Auditor's Choker","Halonic Exorcist's Choker","Halonic Friar's Choker","Halonic Inquisitor's Choker","Halonic Priest's Choker","Handking's Necklace","Handmaster's Necklace","Handsaint's Necklace","Hard Leather Choker","Heavyweight Neckband of Aiming","Heavyweight Neckband of Casting","Heavyweight Neckband of Fending","Heavyweight Neckband of Healing","Heavyweight Neckband of Slaying","Heirloom Necklace of Aiming","Heirloom Necklace of Casting","Heirloom Necklace of Fending","Heirloom Necklace of Healing","Heirloom Necklace of Slaying","Heliodor Choker","Hellwolf Choker of Aiming","Hellwolf Choker of Casting","Hellwolf Choker of Fending","Hellwolf Choker of Healing","Hellwolf Choker of Slaying","Hematite Choker of Aiming","Hematite Choker of Casting","Hematite Choker of Fending","Hematite Choker of Healing","Hematite Choker of Slaying","Hero's Necklace of Aiming","Hero's Necklace of Casting","Hero's Necklace of Fending","Hero's Necklace of Healing","Hero's Necklace of Slaying","High Allagan Choker of Aiming","High Allagan Choker of Casting","High Allagan Choker of Fending","High Allagan Choker of Healing","High Allagan Choker of Slaying","Historia Choker of Aiming","Historia Choker of Casting","Historia Choker of Fending","Historia Choker of Healing","Historia Choker of Slaying","Holy Cedar Necklace","Hoplite Choker","Horn Necklace","Horse Chestnut Necklace of Gathering","Ihuykanite Choker of Aiming","Ihuykanite Choker of Casting","Ihuykanite Choker of Fending","Ihuykanite Choker of Healing","Ihuykanite Choker of Slaying","Immaculate Necklace of Aiming","Immaculate Necklace of Casting","Immaculate Necklace of Fending","Immaculate Necklace of Healing","Immaculate Necklace of Slaying","Imperial Choker of Aiming","Imperial Choker of Casting","Imperial Choker of Fending","Imperial Choker of Healing","Imperial Choker of Slaying","Imperial Jade Necklace of Aiming","Imperial Jade Necklace of Casting","Imperial Jade Necklace of Fending","Imperial Jade Necklace of Healing","Imperial Jade Necklace of Slaying","Imperial Operative Choker","Indagator's Necklace of Crafting","Indagator's Necklace of Gathering","Integral Necklace of Crafting","Iolite Choker","Ironwood Choker of Aiming","Ironwood Choker of Casting","Ironwood Choker of Fending","Ironwood Choker of Healing","Ironwood Choker of Slaying","Ironwood Necklace of Crafting","Ironworks Choker of Aiming","Ironworks Choker of Casting","Ironworks Choker of Fending","Ironworks Choker of Healing","Ironworks Choker of Slaying","Ironworks Necklace of Crafting","Ironworks Necklace of Gathering","Ishgardian Chaplain's Choker","Ishgardian Historian's Choker","Ishgardian Knight's Choker","Ishgardian Monastic's Choker","Ishgardian Outrider's Choker","Koppranickel Necklace of Aiming","Koppranickel Necklace of Casting","Koppranickel Necklace of Fending","Koppranickel Necklace of Healing","Koppranickel Necklace of Slaying","Ktiseos Choker of Aiming","Ktiseos Choker of Casting","Ktiseos Choker of Fending","Ktiseos Choker of Healing","Ktiseos Choker of Slaying","Kumbhiraskin Necklace of Gathering","Lakeland Necklace of Aiming","Lakeland Necklace of Casting","Lakeland Necklace of Fending","Lakeland Necklace of Healing","Lakeland Necklace of Slaying","Lakshmi's Necklace of Aiming","Lakshmi's Necklace of Casting","Lakshmi's Necklace of Fending","Lakshmi's Necklace of Healing","Lakshmi's Necklace of Slaying","Landking's Necklace","Landmaster's Choker","Landsaint's Necklace","Lapis Lazuli Choker","Lar Choker","Larch Necklace","Leather Choker","Light-heavy Choker of Aiming","Light-heavy Choker of Casting","Light-heavy Choker of Fending","Light-heavy Choker of Healing","Light-heavy Choker of Slaying","Lignum Vitae Necklace","Limbo Necklace of Aiming","Limbo Necklace of Casting","Limbo Necklace of Fending","Limbo Necklace of Healing","Limbo Necklace of Slaying","Loboskin Necklace of Aiming","Loboskin Necklace of Casting","Loboskin Necklace of Fending","Loboskin Necklace of Healing","Loboskin Necklace of Slaying","Lost Allagan Choker of Aiming","Lost Allagan Choker of Casting","Lost Allagan Choker of Fending","Lost Allagan Choker of Healing","Lost Allagan Choker of Slaying","Lunar Envoy's Necklace of Aiming","Lunar Envoy's Necklace of Casting","Lunar Envoy's Necklace of Fending","Lunar Envoy's Necklace of Healing","Lunar Envoy's Necklace of Slaying","Mage's Choker","Makai Choker of Aiming","Makai Choker of Casting","Makai Choker of Fending","Makai Choker of Healing","Makai Choker of Slaying","Malachite Choker","Mameshiba Neckerchief","Manalis Choker of Aiming","Manalis Choker of Casting","Manalis Choker of Fending","Manalis Choker of Healing","Manalis Choker of Slaying","Manasilver Choker","Mandragora Choker","Manusya Choker of Aiming","Manusya Choker of Casting","Manusya Choker of Fending","Manusya Choker of Healing","Manusya Choker of Slaying","Marid Leather Choker","Midan Neckband of Aiming","Midan Neckband of Casting","Midan Neckband of Fending","Midan Neckband of Healing","Midan Neckband of Slaying","Militia Choker","Mirage Choker","Mistbreak Necklace of Aiming","Mistbreak Necklace of Casting","Mistbreak Necklace of Fending","Mistbreak Necklace of Healing","Mistbreak Necklace of Slaying","Mistfall Necklace of Aiming","Mistfall Necklace of Casting","Mistfall Necklace of Fending","Mistfall Necklace of Healing","Mistfall Necklace of Slaying","Mistic Memory Choker of Aiming","Mistic Memory Choker of Casting","Mistic Memory Choker of Fending","Mistic Memory Choker of Healing","Mistic Memory Choker of Slaying","Mistwake Choker of Aiming","Mistwake Choker of Casting","Mistwake Choker of Fending","Mistwake Choker of Healing","Mistwake Choker of Slaying","Moonward Necklace of Aiming","Moonward Necklace of Casting","Moonward Necklace of Fending","Moonward Necklace of Healing","Moonward Necklace of Slaying","Mythril Choker","Mythril Gorget","Mythrite Necklace of Aiming","Mythrite Necklace of Casting","Mythrite Necklace of Fending","Mythrite Necklace of Healing","Mythrite Necklace of Slaying","Nabaath Choker of Aiming","Nabaath Choker of Casting","Nabaath Choker of Fending","Nabaath Choker of Healing","Nabaath Choker of Slaying","Namazu Bell","Namazu Neckerchief","Natural Afflatus Necklace","Necklace of the First Light","Neo Kingdom Choker of Aiming","Neo Kingdom Choker of Casting","Neo Kingdom Choker of Fending","Neo Kingdom Choker of Healing","Neo Kingdom Choker of Slaying","Neo-Ishgardian Choker of Aiming","Neo-Ishgardian Choker of Casting","Neo-Ishgardian Choker of Fending","Neo-Ishgardian Choker of Healing","Neo-Ishgardian Choker of Slaying","Noct Choker","Nomad's Choker of Aiming","Nomad's Choker of Casting","Nomad's Choker of Fending","Nomad's Choker of Healing","Nomad's Choker of Slaying","Occult Necklace of Blood","Occult Necklace of Magic","Omega Choker of Aiming","Omega Choker of Casting","Omega Choker of Fending","Omega Choker of Healing","Omega Choker of Slaying","Omicron Choker of Aiming","Omicron Choker of Casting","Omicron Choker of Fending","Omicron Choker of Healing","Omicron Choker of Slaying","Opal Choker of Aiming","Opal Choker of Casting","Opal Choker of Fending","Opal Choker of Healing","Opal Choker of Slaying","Ophiotauroskin Necklace of Gathering","Orange Byregotia Choker","Orange Sweet Pea Necklace","Origenics Choker of Aiming","Origenics Choker of Casting","Origenics Choker of Fending","Origenics Choker of Healing","Origenics Choker of Slaying","Orthodox Choker of Aiming","Orthodox Choker of Casting","Orthodox Choker of Fending","Orthodox Choker of Healing","Orthodox Choker of Slaying","Paglth'an Necklace of Aiming","Paglth'an Necklace of Casting","Paglth'an Necklace of Fending","Paglth'an Necklace of Healing","Paglth'an Necklace of Slaying","Palaka Choker of Aiming","Palaka Choker of Casting","Palaka Choker of Fending","Palaka Choker of Healing","Palaka Choker of Slaying","Palladium Choker of Aiming","Palladium Choker of Casting","Palladium Choker of Fending","Palladium Choker of Healing","Palladium Choker of Slaying","Panegyrist's Scarf","Paramour's Pendant","Patriot's Choker","Peach Blossom Choker","Pearl Choker","Peltast Choker","Peridot Choker","Persimmon Necklace","Petalite Choker of Aiming","Petalite Choker of Casting","Petalite Choker of Fending","Petalite Choker of Healing","Petalite Choker of Slaying","Pewter Choker of Aiming","Pewter Choker of Casting","Pewter Choker of Fending","Pewter Choker of Healing","Pewter Choker of Slaying","Phantasmal Sardine Necklace","Phrygian Choker of Aiming","Phrygian Choker of Casting","Phrygian Choker of Fending","Phrygian Choker of Healing","Phrygian Choker of Slaying","Picaroon's Necklace of Slaying","Plague Bringer's Choker","Plague Doctor's Choker","Platinum Lone Wolf Choker","Platinum Pack Wolf Choker","Platinum Paramour's Pendant","Platinum Scarf of Aiming","Platinum Scarf of Casting","Platinum Scarf of Fending","Platinum Scarf of Healing","Platinum Scarf of Slaying","Praemagitek Necklace of Aiming","Praemagitek Necklace of Casting","Praemagitek Necklace of Fending","Praemagitek Necklace of Healing","Praemagitek Necklace of Slaying","Primal Choker of Aiming","Primal Choker of Casting","Primal Choker of Fending","Primal Choker of Healing","Primal Choker of Slaying","Prophet's Scarf","Proto Ultima Necklace of Aiming","Proto Ultima Necklace of Casting","Proto Ultima Necklace of Fending","Proto Ultima Necklace of Healing","Proto Ultima Necklace of Slaying","Prototype Alexandrian Neckband of Aiming","Prototype Alexandrian Neckband of Casting","Prototype Alexandrian Neckband of Fending","Prototype Alexandrian Neckband of Healing","Prototype Alexandrian Neckband of Slaying","Prototype Gordian Neckband of Aiming","Prototype Gordian Neckband of Casting","Prototype Gordian Neckband of Fending","Prototype Gordian Neckband of Healing","Prototype Gordian Neckband of Slaying","Prototype Midan Neckband of Aiming","Prototype Midan Neckband of Casting","Prototype Midan Neckband of Fending","Prototype Midan Neckband of Healing","Prototype Midan Neckband of Slaying","Purgatory Choker of Aiming","Purgatory Choker of Casting","Purgatory Choker of Fending","Purgatory Choker of Healing","Purgatory Choker of Slaying","Purple Byregotia Choker","Purple Sweet Pea Necklace","Quetzalli Necklace of Aiming","Quetzalli Necklace of Casting","Quetzalli Necklace of Fending","Quetzalli Necklace of Healing","Quetzalli Necklace of Slaying","Radiant's Choker of Aiming","Radiant's Choker of Casting","Radiant's Choker of Fending","Radiant's Choker of Healing","Radiant's Choker of Slaying","Rainbow Byregotia Choker","Rainbow Ribbon of Aiming","Rainbow Ribbon of Casting","Rainbow Ribbon of Fending","Rainbow Ribbon of Healing","Rainbow Ribbon of Slaying","Rainbow Sweet Pea Necklace","Rakshasa Necklace of Aiming","Rakshasa Necklace of Casting","Rakshasa Necklace of Fending","Rakshasa Necklace of Healing","Rakshasa Necklace of Slaying","Ramie Ribbon of Aiming","Ramie Ribbon of Casting","Ramie Ribbon of Fending","Ramie Ribbon of Healing","Ramie Ribbon of Slaying","Raptorskin Choker","Ravel Keeper's Choker of Aiming","Ravel Keeper's Choker of Casting","Ravel Keeper's Choker of Fending","Ravel Keeper's Choker of Healing","Ravel Keeper's Choker of Slaying","Red Byregotia Choker","Red Coral Necklace","Red Sweet Pea Necklace","Redbill Scarf","Resilient Choker of Aiming","Resilient Choker of Casting","Resilient Choker of Fending","Resilient Choker of Healing","Resilient Choker of Slaying","Ribbon of Aiming","Ribbon of Casting","Ribbon of Fending","Ribbon of Healing","Ribbon of Slaying","Rinascita Necklace of Aiming","Rinascita Necklace of Casting","Rinascita Necklace of Fending","Rinascita Necklace of Healing","Rinascita Necklace of Slaying","Riversbreath Necklace of Aiming","Riversbreath Necklace of Casting","Riversbreath Necklace of Fending","Riversbreath Necklace of Healing","Riversbreath Necklace of Slaying","Ronkan Necklace of Aiming","Ronkan Necklace of Casting","Ronkan Necklace of Fending","Ronkan Necklace of Healing","Ronkan Necklace of Slaying","Rose Gold Choker","Rose Gold Gorget","Royal Volunteer's Choker of Aiming","Royal Volunteer's Choker of Casting","Royal Volunteer's Choker of Fending","Royal Volunteer's Choker of Healing","Royal Volunteer's Choker of Slaying","Rubellite Choker","Ruby Choker","Ruby Tide Necklace of Aiming","Ruby Tide Necklace of Casting","Ruby Tide Necklace of Fending","Ruby Tide Necklace of Healing","Ruby Tide Necklace of Slaying","Ryumyaku Necklace of Aiming","Ryumyaku Necklace of Casting","Ryumyaku Necklace of Fending","Ryumyaku Necklace of Healing","Ryumyaku Necklace of Slaying","Sapphire Choker","Scaevan Choker of Aiming","Scaevan Choker of Casting","Scaevan Choker of Fending","Scaevan Choker of Healing","Scaevan Choker of Slaying","Serpent Sergeant's Choker","Shadowless Necklace of Aiming","Shadowless Necklace of Casting","Shadowless Necklace of Fending","Shadowless Necklace of Healing","Shadowless Necklace of Slaying","Sharlayan Conservator's Choker","Sharlayan Custodian's Choker","Sharlayan Pankratiast's Choker","Sharlayan Philosopher's Choker","Sharlayan Preceptor's Choker","Shire Conservator's Choker","Shire Custodian's Choker","Shire Pankratiast's Choker","Shire Philosopher's Choker","Shire Preceptor's Choker","Silver Choker","Silver Gorget","Silver Lone Wolf Choker","Silver Pack Wolf Choker","Skallic Necklace of Aiming","Skallic Necklace of Casting","Skallic Necklace of Fending","Skallic Necklace of Healing","Skallic Necklace of Slaying","Skydeep Necklace of Aiming","Skydeep Necklace of Casting","Skydeep Necklace of Fending","Skydeep Necklace of Healing","Skydeep Necklace of Slaying","Slothskin Necklace of Gathering","Smilodonskin Choker","Sphene Choker","Spinel Choker","Star Quartz Choker of Aiming","Star Quartz Choker of Casting","Star Quartz Choker of Fending","Star Quartz Choker of Healing","Star Quartz Choker of Slaying","Star Spinel Choker of Aiming","Star Spinel Choker of Casting","Star Spinel Choker of Fending","Star Spinel Choker of Healing","Star Spinel Choker of Slaying","Star Tech Choker of Crafting","Star Tech Choker of Gathering","Stonewall Choker","Storm Sergeant's Choker","Strategos Choker","Sunburst Necklace of Aiming","Sunburst Necklace of Casting","Sunburst Necklace of Fending","Sunburst Necklace of Healing","Sunburst Necklace of Slaying","Sunstone Choker","Sunstreak Necklace of Aiming","Sunstreak Necklace of Casting","Sunstreak Necklace of Fending","Sunstreak Necklace of Healing","Sunstreak Necklace of Slaying","Teak Choker of Aiming","Teak Choker of Casting","Teak Choker of Fending","Teak Choker of Healing","Teak Choker of Slaying","The Emperor's New Necklace","The Forgiven's Necklace of Aiming","The Forgiven's Necklace of Casting","The Forgiven's Necklace of Fending","The Forgiven's Necklace of Healing","The Forgiven's Necklace of Slaying","The Last Necklace of Aiming","The Last Necklace of Casting","The Last Necklace of Fending","The Last Necklace of Healing","The Last Necklace of Slaying","The Twelve's Necklace of Aiming","The Twelve's Necklace of Casting","The Twelve's Necklace of Fending","The Twelve's Necklace of Healing","The Twelve's Necklace of Slaying","Topaz Choker","Torreya Choker of Aiming","Torreya Choker of Casting","Torreya Choker of Fending","Torreya Choker of Healing","Torreya Choker of Slaying","Tourmaline Choker","Toxotes Choker","Triphane Choker of Aiming","Triphane Choker of Casting","Triphane Choker of Fending","Triphane Choker of Healing","Triphane Choker of Slaying","Triplite Choker of Aiming","Triplite Choker of Casting","Triplite Choker of Fending","Triplite Choker of Healing","Triplite Choker of Slaying","Troian Choker of Aiming","Troian Choker of Casting","Troian Choker of Fending","Troian Choker of Healing","Troian Choker of Slaying","Turquoise Choker","Ultima Choker of Aiming","Ultima Choker of Casting","Ultima Choker of Fending","Ultima Choker of Healing","Ultima Choker of Slaying","Underkeep Neckband of Aiming","Underkeep Neckband of Casting","Underkeep Neckband of Fending","Underkeep Neckband of Healing","Underkeep Neckband of Slaying","Uolosapa Scarf","Valerian Archer's Choker","Valerian Brawler's Choker","Valerian Dark Priest's Choker","Valerian Fusilier's Choker","Valerian Priest's Choker","Valerian Shaman's Choker","Valerian Smuggler's Choker","Valerian Terror Knight's Choker","Valerian Wizard's Choker","Valkyrie's Choker of Aiming","Valkyrie's Choker of Casting","Valkyrie's Choker of Fending","Valkyrie's Choker of Healing","Valkyrie's Choker of Slaying","Vanguard Neckband of Aiming","Vanguard Neckband of Casting","Vanguard Neckband of Fending","Vanguard Neckband of Healing","Vanguard Neckband of Slaying","Varlet's Necklace","Viking Scarf","Voeburtite Necklace of Aiming","Voeburtite Necklace of Casting","Voeburtite Necklace of Fending","Voeburtite Necklace of Healing","Voeburtite Necklace of Slaying","Voidmoon Necklace of Aiming","Voidmoon Necklace of Casting","Voidmoon Necklace of Fending","Voidmoon Necklace of Healing","Voidmoon Necklace of Slaying","Warg Choker of Aiming","Warg Choker of Casting","Warg Choker of Fending","Warg Choker of Healing","Warg Choker of Slaying","Warwolf Choker of Aiming","Warwolf Choker of Casting","Warwolf Choker of Fending","Warwolf Choker of Healing","Warwolf Choker of Slaying","Wayfarer's Necklace","Weathered Auroral Choker","Weathered Choker","Weathered Daystar Necklace","Weathered Evenstar Necklace","Weathered Gloam Choker","Weathered Noct Choker","Werewolf Choker of Aiming","Werewolf Choker of Casting","Werewolf Choker of Fending","Werewolf Choker of Healing","Werewolf Choker of Slaying","Whalaqee Choker","White Ash Necklace","White Byregotia Choker","White Gold Choker of Aiming","White Gold Choker of Casting","White Gold Choker of Fending","White Gold Choker of Healing","White Gold Choker of Slaying","White Oak Necklace","White Sweet Pea Necklace","Woad Skydruid's Choker","Woad Skyhunter's Choker","Woad Skyraider's Choker","Woad Skywarrior's Choker","Woad Skywicce's Choker","Wolf Amber Choker","Wolf Necklace","Wolf Rubellite Choker","Wolf Spinel Choker","Wolf Tourmaline Choker","Wolf Turquoise Choker","Wolf Zircon Choker","Wrangler's Scarf","Wyvernskin Choker","Xenobian Paladin's Choker","Yama Necklace of Aiming","Yama Necklace of Casting","Yama Necklace of Fending","Yama Necklace of Healing","Yama Necklace of Slaying","Yanxian Necklace of Aiming","Yanxian Necklace of Casting","Yanxian Necklace of Fending","Yanxian Necklace of Healing","Yanxian Necklace of Slaying","Yasha Necklace of Aiming","Yasha Necklace of Casting","Yasha Necklace of Fending","Yasha Necklace of Healing","Yasha Necklace of Slaying","Yellow Byregotia Choker","Yellow Sweet Pea Necklace","Yuweyawata Necklace of Aiming","Yuweyawata Necklace of Casting","Yuweyawata Necklace of Fending","Yuweyawata Necklace of Healing","Yuweyawata Necklace of Slaying","Zelkova Necklace","Zircon Choker","Zormor Necklace of Aiming","Zormor Necklace of Casting","Zormor Necklace of Fending","Zormor Necklace of Healing","Zormor Necklace of Slaying"]),"wrists":new Set(["Abyssos Amulet of Aiming","Abyssos Amulet of Casting","Abyssos Amulet of Fending","Abyssos Amulet of Healing","Abyssos Amulet of Slaying","Acacia Bracelet","Aesthete's Bracelet of Gathering","Aesthete's Bracelets of Crafting","Aetherial Amber Bracelet","Aetherial Amethyst Bracelet","Aetherial Aquamarine Bracelet","Aetherial Black Pearl Bracelet","Aetherial Boarskin Wristbands","Aetherial Bone Armillae","Aetherial Brass Wristlets","Aetherial Coral Armillae","Aetherial Danburite Bracelet","Aetherial Electrum Wristlets","Aetherial Fluorite Bracelet","Aetherial Garnet Bracelet","Aetherial Goatskin Wristbands","Aetherial Goshenite Bracelet","Aetherial Hard Leather Wristbands","Aetherial Heliodor Bracelet","Aetherial Lapis Lazuli Bracelet","Aetherial Malachite Bracelet","Aetherial Mythril Wristlets","Aetherial Pearl Bracelet","Aetherial Peridot Bracelet","Aetherial Raptorskin Wristbands","Aetherial Red Coral Armillae","Aetherial Rubellite Bracelet","Aetherial Silver Wristlets","Aetherial Sphene Bracelet","Aetherial Spinel Bracelet","Aetherial Sunstone Bracelet","Aetherial Tortoiseshell Armillae","Aetherial Tourmaline Bracelet","Aetherial Turquoise Bracelet","Aetherial Zircon Bracelet","Ala Mhigan Bracelet of Aiming","Ala Mhigan Bracelet of Casting","Ala Mhigan Bracelet of Fending","Ala Mhigan Bracelet of Healing","Ala Mhigan Bracelet of Slaying","Alexandrian Bracelets of Aiming","Alexandrian Bracelets of Casting","Alexandrian Bracelets of Fending","Alexandrian Bracelets of Healing","Alexandrian Bracelets of Slaying","Allagan Bracelets of Aiming","Allagan Bracelets of Casting","Allagan Bracelets of Fending","Allagan Bracelets of Healing","Allagan Bracelets of Maiming","Allagan Bracelets of Striking","Alliance Bracelet of Aiming","Alliance Bracelet of Casting","Alliance Bracelet of Fending","Alliance Bracelet of Healing","Alliance Bracelet of Slaying","Alpha Wolf Bracelets","Amaurotine Bracelets of Aiming","Amaurotine Bracelets of Casting","Amaurotine Bracelets of Fending","Amaurotine Bracelets of Healing","Amaurotine Bracelets of Slaying","Amber Bracelet","Amethyst Bracelet","Ametrine Armillae of Crafting","Ametrine Bracelet of Aiming","Ametrine Bracelet of Casting","Ametrine Bracelet of Fending","Ametrine Bracelet of Healing","Ametrine Bracelet of Slaying","Anabaseios Bracelet of Aiming","Anabaseios Bracelet of Casting","Anabaseios Bracelet of Fending","Anabaseios Bracelet of Healing","Anabaseios Bracelet of Slaying","Anamnesis Bracelet of Aiming","Anamnesis Bracelet of Casting","Anamnesis Bracelet of Fending","Anamnesis Bracelet of Healing","Anamnesis Bracelet of Slaying","Aquamarine Bracelet","Archeo Kingdom Wristband of Aiming","Archeo Kingdom Wristband of Casting","Archeo Kingdom Wristband of Fending","Archeo Kingdom Wristband of Healing","Archeo Kingdom Wristband of Slaying","Ardent Bracelet of Aiming","Ardent Bracelet of Casting","Ardent Bracelet of Fending","Ardent Bracelet of Healing","Ardent Bracelet of Slaying","Arhat Bracelets of Aiming","Arhat Bracelets of Casting","Arhat Bracelets of Fending","Arhat Bracelets of Healing","Arhat Bracelets of Slaying","Artful Afflatus Bracelet","Ascension Bracelet of Aiming","Ascension Bracelet of Casting","Ascension Bracelet of Fending","Ascension Bracelet of Healing","Ascension Bracelet of Slaying","Asphodelos Amulet of Aiming","Asphodelos Amulet of Casting","Asphodelos Amulet of Fending","Asphodelos Amulet of Healing","Asphodelos Amulet of Slaying","Astral Birch Armillae","Astral Bracelet","Asuran Bracelets of Aiming","Asuran Bracelets of Casting","Asuran Bracelets of Fending","Asuran Bracelets of Healing","Asuran Bracelets of Slaying","Atrociraptorskin Amulet of Aiming","Atrociraptorskin Amulet of Casting","Atrociraptorskin Amulet of Fending","Atrociraptorskin Amulet of Healing","Atrociraptorskin Amulet of Slaying","Augmented Archeo Kingdom Wristband of Aiming","Augmented Archeo Kingdom Wristband of Casting","Augmented Archeo Kingdom Wristband of Fending","Augmented Archeo Kingdom Wristband of Healing","Augmented Archeo Kingdom Wristband of Slaying","Augmented Black Willow Armillae of Aiming","Augmented Black Willow Armillae of Casting","Augmented Black Willow Armillae of Fending","Augmented Black Willow Armillae of Healing","Augmented Black Willow Armillae of Slaying","Augmented Bygone Brass Bracelet of Aiming","Augmented Bygone Brass Bracelet of Casting","Augmented Bygone Brass Bracelet of Fending","Augmented Bygone Brass Bracelet of Healing","Augmented Bygone Brass Bracelet of Slaying","Augmented Ceremonial Bangle of Aiming","Augmented Ceremonial Bangle of Casting","Augmented Ceremonial Bangle of Fending","Augmented Ceremonial Bangle of Healing","Augmented Ceremonial Bangle of Slaying","Augmented Classical Wristband of Aiming","Augmented Classical Wristband of Casting","Augmented Classical Wristband of Fending","Augmented Classical Wristband of Healing","Augmented Classical Wristband of Slaying","Augmented Courtly Lover's Wristlet of Aiming","Augmented Courtly Lover's Wristlet of Casting","Augmented Courtly Lover's Wristlet of Fending","Augmented Courtly Lover's Wristlet of Healing","Augmented Courtly Lover's Wristlet of Slaying","Augmented Credendum Bracelets of Aiming","Augmented Credendum Bracelets of Casting","Augmented Credendum Bracelets of Fending","Augmented Credendum Bracelets of Healing","Augmented Credendum Bracelets of Slaying","Augmented Cryptlurker's Bracelet of Aiming","Augmented Cryptlurker's Bracelet of Casting","Augmented Cryptlurker's Bracelet of Fending","Augmented Cryptlurker's Bracelet of Healing","Augmented Cryptlurker's Bracelet of Slaying","Augmented Crystarium Wristband of Aiming","Augmented Crystarium Wristband of Casting","Augmented Crystarium Wristband of Fending","Augmented Crystarium Wristband of Healing","Augmented Crystarium Wristband of Slaying","Augmented Deepshadow Bracelet of Aiming","Augmented Deepshadow Bracelet of Casting","Augmented Deepshadow Bracelet of Fending","Augmented Deepshadow Bracelet of Healing","Augmented Deepshadow Bracelet of Slaying","Augmented Diadochos Wristband of Aiming","Augmented Diadochos Wristband of Casting","Augmented Diadochos Wristband of Fending","Augmented Diadochos Wristband of Healing","Augmented Diadochos Wristband of Slaying","Augmented Exarchic Bracelet of Aiming","Augmented Exarchic Bracelet of Casting","Augmented Exarchic Bracelet of Fending","Augmented Exarchic Bracelet of Healing","Augmented Exarchic Bracelet of Slaying","Augmented Facet Bracelet of Aiming","Augmented Facet Bracelet of Casting","Augmented Facet Bracelet of Fending","Augmented Facet Bracelet of Healing","Augmented Facet Bracelet of Slaying","Augmented Handmaster's Armillae","Augmented Historia Wristband of Aiming","Augmented Historia Wristband of Casting","Augmented Historia Wristband of Fending","Augmented Historia Wristband of Healing","Augmented Historia Wristband of Slaying","Augmented Ironworks Bracelet of Aiming","Augmented Ironworks Bracelet of Casting","Augmented Ironworks Bracelet of Fending","Augmented Ironworks Bracelet of Healing","Augmented Ironworks Bracelet of Slaying","Augmented Landmaster's Wristbands","Augmented Lost Allagan Bracelet of Aiming","Augmented Lost Allagan Bracelet of Casting","Augmented Lost Allagan Bracelet of Fending","Augmented Lost Allagan Bracelet of Healing","Augmented Lost Allagan Bracelet of Slaying","Augmented Lunar Envoy's Bracelets of Aiming","Augmented Lunar Envoy's Bracelets of Casting","Augmented Lunar Envoy's Bracelets of Fending","Augmented Lunar Envoy's Bracelets of Healing","Augmented Lunar Envoy's Bracelets of Slaying","Augmented Neo-Ishgardian Wristbands of Aiming","Augmented Neo-Ishgardian Wristbands of Casting","Augmented Neo-Ishgardian Wristbands of Fending","Augmented Neo-Ishgardian Wristbands of Healing","Augmented Neo-Ishgardian Wristbands of Slaying","Augmented Primal Bracelet of Aiming","Augmented Primal Bracelet of Casting","Augmented Primal Bracelet of Fending","Augmented Primal Bracelet of Healing","Augmented Primal Bracelet of Slaying","Augmented Quetzalli Bracelets of Aiming","Augmented Quetzalli Bracelets of Casting","Augmented Quetzalli Bracelets of Fending","Augmented Quetzalli Bracelets of Healing","Augmented Quetzalli Bracelets of Slaying","Augmented Radiant's Bracelet of Aiming","Augmented Radiant's Bracelet of Casting","Augmented Radiant's Bracelet of Fending","Augmented Radiant's Bracelet of Healing","Augmented Radiant's Bracelet of Slaying","Augmented Rinascita Bracelet of Aiming","Augmented Rinascita Bracelet of Casting","Augmented Rinascita Bracelet of Fending","Augmented Rinascita Bracelet of Healing","Augmented Rinascita Bracelet of Slaying","Augmented Scaevan Bracelet of Aiming","Augmented Scaevan Bracelet of Casting","Augmented Scaevan Bracelet of Fending","Augmented Scaevan Bracelet of Healing","Augmented Scaevan Bracelet of Slaying","Augmented Shire Conservator's Bracelet","Augmented Shire Custodian's Bracelet","Augmented Shire Pankratiast's Bracelets","Augmented Shire Philosopher's Bracelets","Augmented Shire Preceptor's Bracelets","Auroral Wristlets","Aurum Regis Bracelet of Aiming","Aurum Regis Bracelet of Casting","Aurum Regis Bracelet of Fending","Aurum Regis Bracelet of Healing","Aurum Regis Bracelet of Slaying","Azurite Bracelet of Aiming","Azurite Bracelet of Casting","Azurite Bracelet of Fending","Azurite Bracelet of Healing","Azurite Bracelet of Slaying","Babyface Champion's Bangle of Aiming","Babyface Champion's Bangle of Casting","Babyface Champion's Bangle of Fending","Babyface Champion's Bangle of Healing","Babyface Champion's Bangle of Slaying","Bangles of the First Light","Battleliege Bracelet of Aiming","Battleliege Bracelet of Casting","Battleliege Bracelet of Fending","Battleliege Bracelet of Healing","Battleliege Bracelet of Slaying","Berserker's Bangles","Bismuth Bracelet of Aiming","Bismuth Bracelet of Casting","Bismuth Bracelet of Fending","Bismuth Bracelet of Healing","Bismuth Bracelet of Slaying","Black Cornflower Wristlets","Black Pearl Bracelet","Black Star Bracelet of Aiming","Black Star Bracelet of Casting","Black Star Bracelet of Fending","Black Star Bracelet of Healing","Black Star Bracelet of Slaying","Black Star Bracelets of Crafting","Black Willow Armillae of Aiming","Black Willow Armillae of Casting","Black Willow Armillae of Crafting","Black Willow Armillae of Fending","Black Willow Armillae of Healing","Black Willow Armillae of Slaying","Blue Cornflower Wristlets","Blue Zircon Bracelet of Aiming","Blue Zircon Bracelet of Casting","Blue Zircon Bracelet of Fending","Blue Zircon Bracelet of Healing","Blue Zircon Bracelet of Slaying","Boarskin Wristbands","Boarskin Wristbands of Gathering","Bogatyr's Armillae of Aiming","Bogatyr's Armillae of Casting","Bogatyr's Armillae of Healing","Bone Armillae","Bonewicca Bangle of Aiming","Bonewicca Bangle of Casting","Bonewicca Bangle of Fending","Bonewicca Bangle of Healing","Bonewicca Bangle of Slaying","Bracelet of Divine Death","Bracelet of Divine Wisdom","Bracelet of the Daring Duelist","Bracelet of the Defiant Duelist","Bracelet of the Divine Harvest","Bracelet of the Divine Light","Bracelet of the Lost Thief","Bracelets of the Divine War","Bracelets of the Sea-folk","Brass Wristlets","Brass Wristlets of Crafting","Bronze Lone Wolf Bracelets","Bronze Pack Wolf Bracelets","Bygone Brass Bracelet of Aiming","Bygone Brass Bracelet of Casting","Bygone Brass Bracelet of Fending","Bygone Brass Bracelet of Healing","Bygone Brass Bracelet of Slaying","Camphorwood Armillae of Aiming","Camphorwood Armillae of Casting","Camphorwood Armillae of Fending","Camphorwood Armillae of Healing","Camphorwood Armillae of Slaying","Carborundum Bracelet of Aiming","Carborundum Bracelet of Casting","Carborundum Bracelet of Fending","Carborundum Bracelet of Healing","Carborundum Bracelet of Slaying","Ceremonial Bangle of Aiming","Ceremonial Bangle of Casting","Ceremonial Bangle of Fending","Ceremonial Bangle of Healing","Ceremonial Bangle of Slaying","Chrysolite Bracelet of Aiming","Chrysolite Bracelet of Casting","Chrysolite Bracelet of Fending","Chrysolite Bracelet of Healing","Chrysolite Bracelet of Slaying","Claro Walnut Bracelet of Gathering","Classical Wristband of Aiming","Classical Wristband of Casting","Classical Wristband of Fending","Classical Wristband of Healing","Classical Wristband of Slaying","Copper Wristlets","Coral Armillae","Courtly Lover's Wristlet of Aiming","Courtly Lover's Wristlet of Casting","Courtly Lover's Wristlet of Fending","Courtly Lover's Wristlet of Healing","Courtly Lover's Wristlet of Slaying","Credendum Bracelets of Aiming","Credendum Bracelets of Casting","Credendum Bracelets of Fending","Credendum Bracelets of Healing","Credendum Bracelets of Slaying","Crested Bracelet of Crafting","Crested Bracelet of Gathering","Crimson Standard Bracelet","Cruiser Bangle of Aiming","Cruiser Bangle of Casting","Cruiser Bangle of Fending","Cruiser Bangle of Healing","Cruiser Bangle of Slaying","Cryptlurker's Bracelet of Aiming","Cryptlurker's Bracelet of Casting","Cryptlurker's Bracelet of Fending","Cryptlurker's Bracelet of Healing","Cryptlurker's Bracelet of Slaying","Crystarium Wristband of Aiming","Crystarium Wristband of Casting","Crystarium Wristband of Fending","Crystarium Wristband of Healing","Crystarium Wristband of Slaying","Dai-ryumyaku Bracelet of Aiming","Dai-ryumyaku Bracelet of Casting","Dai-ryumyaku Bracelet of Fending","Dai-ryumyaku Bracelet of Healing","Dai-ryumyaku Bracelet of Slaying","Danburite Bracelet","Darbar Bracelet of Aiming","Darbar Bracelet of Casting","Darbar Bracelet of Fending","Darbar Bracelet of Healing","Darbar Bracelet of Slaying","Dark Horse Champion's Bangle of Aiming","Dark Horse Champion's Bangle of Casting","Dark Horse Champion's Bangle of Fending","Dark Horse Champion's Bangle of Healing","Dark Horse Champion's Bangle of Slaying","Darklight Bracelet of Aiming","Darklight Bracelet of Casting","Darklight Bracelet of Fending","Darklight Bracelet of Healing","Darklight Bracelet of Maiming","Darklight Bracelet of Striking","Dated Black Pearl Bracelet","Dated Blue Coral Wristbands","Dated Blue Coral Wristbands (Black)","Dated Blue Coral Wristbands (Yellow)","Dated Bone Armillae","Dated Brass Wristlets","Dated Copper Wristlets","Dated Danburite Bracelet","Dated Darksilver Wristlet","Dated Electrum Wristlets","Dated Fluorite Bracelet","Dated Lapis Lazuli Bracelet","Dated Malachite Bracelet","Dated Mythril Wristlets","Dated Pearl Bracelet","Dated Red Coral Wristbands","Dated Red Coral Wristbands (Black)","Dated Red Coral Wristbands (Yellow)","Dated Silver Wristlets","Dated Sphene Bracelet","Dated Sunstone Bracelet","Dated White Coral Wristbands","Dated White Coral Wristbands (Black)","Dated White Coral Wristbands (Yellow)","Dawn Wristguards","Daystar Armillae","Deepmist Armillae of Aiming","Deepmist Armillae of Casting","Deepmist Armillae of Fending","Deepmist Armillae of Healing","Deepmist Armillae of Slaying","Deepshadow Bracelet of Aiming","Deepshadow Bracelet of Casting","Deepshadow Bracelet of Fending","Deepshadow Bracelet of Healing","Deepshadow Bracelet of Slaying","Demagogue Wristlets","Diadochos Wristband of Aiming","Diadochos Wristband of Casting","Diadochos Wristband of Fending","Diadochos Wristband of Healing","Diadochos Wristband of Slaying","Diamond Bracelet","Diamond Bracelet of Aiming","Diamond Bracelet of Casting","Diamond Bracelet of Fending","Diamond Bracelet of Healing","Diamond Bracelet of Slaying","Diamond Lone Wolf Bracelets","Diamond Pack Wolf Bracelets","Diaspore Bracelet of Aiming","Diaspore Bracelet of Casting","Diaspore Bracelet of Fending","Diaspore Bracelet of Healing","Diaspore Bracelet of Slaying","Direwolf Armillae of Fending","Direwolf Wristbands of Aiming","Direwolf Wristbands of Casting","Direwolf Wristbands of Healing","Direwolf Wristbands of Slaying","Distance Bracelet of Aiming","Distance Bracelet of Casting","Distance Bracelet of Fending","Distance Bracelet of Healing","Distance Bracelet of Slaying","Dragonskin Wristbands","Dravanian Bracelet of Aiming","Dravanian Bracelet of Casting","Dravanian Bracelet of Fending","Dravanian Bracelet of Healing","Dravanian Bracelet of Slaying","Dreadwyrm Bracelet of Aiming","Dreadwyrm Bracelet of Casting","Dreadwyrm Bracelet of Fending","Dreadwyrm Bracelet of Healing","Dreadwyrm Bracelet of Slaying","Dwarven Mythril Bracelets","Edencall Wristband of Aiming","Edencall Wristband of Casting","Edencall Wristband of Fending","Edencall Wristband of Healing","Edencall Wristband of Slaying","Edenchoir Wristband of Aiming","Edenchoir Wristband of Casting","Edenchoir Wristband of Fending","Edenchoir Wristband of Healing","Edenchoir Wristband of Slaying","Edengate Bracelet of Aiming","Edengate Bracelet of Casting","Edengate Bracelet of Fending","Edengate Bracelet of Healing","Edengate Bracelet of Slaying","Edengrace Bracelet of Aiming","Edengrace Bracelet of Casting","Edengrace Bracelet of Fending","Edengrace Bracelet of Healing","Edengrace Bracelet of Slaying","Edenmete Wristlet of Aiming","Edenmete Wristlet of Casting","Edenmete Wristlet of Fending","Edenmete Wristlet of Healing","Edenmete Wristlet of Slaying","Edenmorn Wristlet of Aiming","Edenmorn Wristlet of Casting","Edenmorn Wristlet of Fending","Edenmorn Wristlet of Healing","Edenmorn Wristlet of Slaying","Electrum Wristlets","Electrum Wristlets of Crafting","Emerald Bracelet","Empyrean Bracelet","Enaretos Bracelet","Epochal Bracelet of Aiming","Epochal Bracelet of Casting","Epochal Bracelet of Fending","Epochal Bracelet of Healing","Epochal Bracelet of Slaying","Eternal Dark Bracelets of Aiming","Eternal Dark Bracelets of Casting","Eternal Dark Bracelets of Fending","Eternal Dark Bracelets of Healing","Eternal Dark Bracelets of Slaying","Etheirys Bracelet of Aiming","Etheirys Bracelet of Casting","Etheirys Bracelet of Fending","Etheirys Bracelet of Healing","Etheirys Bracelet of Slaying","Evenstar Armillae","Eversharp Wristbands","Exarchic Bracelet of Aiming","Exarchic Bracelet of Casting","Exarchic Bracelet of Fending","Exarchic Bracelet of Healing","Exarchic Bracelet of Slaying","Fabled Bracelet of Aiming","Fabled Bracelet of Casting","Fabled Bracelet of Fending","Fabled Bracelet of Healing","Fabled Bracelet of Slaying","Facet Bracelet of Aiming","Facet Bracelet of Casting","Facet Bracelet of Fending","Facet Bracelet of Healing","Facet Bracelet of Slaying","Farlander Bangle of Aiming","Farlander Bangle of Casting","Farlander Bangle of Fending","Farlander Bangle of Healing","Farlander Bangle of Slaying","Filibuster's Bracelet of Aiming","Filibuster's Bracelet of Casting","Filibuster's Bracelet of Fending","Filibuster's Bracelet of Healing","Filibuster's Bracelet of Slaying","Firecrest Bracelet","Flame Sergeant's Bracelet","Fluorite Bracelet","Garnet Bracelet","Gazelleskin Wristband","Genji Bracelet of Aiming","Genji Bracelet of Casting","Genji Bracelet of Fending","Genji Bracelet of Healing","Genji Bracelet of Slaying","Genta Bracelet of Aiming","Genta Bracelet of Casting","Genta Bracelet of Fending","Genta Bracelet of Healing","Genta Bracelet of Slaying","Ghost Barque Bracelet of Aiming","Ghost Barque Bracelet of Casting","Ghost Barque Bracelet of Fending","Ghost Barque Bracelet of Healing","Ghost Barque Bracelet of Slaying","Ginseng Bracelet","Glass Pumpkin Bracelet","Gloam Wristlets","Goatskin Wristbands","Goatskin Wristbands of Gathering","Gold Lone Wolf Bracelets","Gold Pack Wolf Bracelets","Gomphotherium Wristband","Gordian Wristband of Aiming","Gordian Wristband of Casting","Gordian Wristband of Fending","Gordian Wristband of Healing","Gordian Wristband of Slaying","Goshenite Bracelet","Grand Champion's Bracelets of Aiming","Grand Champion's Bracelets of Casting","Grand Champion's Bracelets of Fending","Grand Champion's Bracelets of Healing","Grand Champion's Bracelets of Slaying","Green Cornflower Wristlets","Griffin Leather Wristbands","Gryphonskin Wristbands","Gyuki Leather Wristband","Hallowed Chestnut Armillae","Halonic Auditor's Bracelets","Halonic Exorcist's Bracelets","Halonic Friar's Bracelets","Halonic Inquisitor's Bracelets","Halonic Priest's Bracelets","Handking's Armillae","Handmaster's Armillae","Handsaint's Bracelets","Hard Leather Wristbands","Hard Leather Wristbands of Gathering","Hardsilver Bangle of Aiming","Hardsilver Bangle of Casting","Hardsilver Bangle of Fending","Hardsilver Bangle of Healing","Hardsilver Bangle of Slaying","Heavyweight Bracelets of Aiming","Heavyweight Bracelets of Casting","Heavyweight Bracelets of Fending","Heavyweight Bracelets of Healing","Heavyweight Bracelets of Slaying","Heirloom Amulet of Aiming","Heirloom Amulet of Casting","Heirloom Amulet of Fending","Heirloom Amulet of Healing","Heirloom Amulet of Slaying","Heliodor Bracelet","Hellwolf Bracelet of Aiming","Hellwolf Bracelet of Casting","Hellwolf Bracelet of Fending","Hellwolf Bracelet of Healing","Hellwolf Bracelet of Slaying","Hero's Bracelet of Aiming","Hero's Bracelet of Casting","Hero's Bracelet of Fending","Hero's Bracelet of Healing","Hero's Bracelet of Slaying","High Allagan Bracelets of Aiming","High Allagan Bracelets of Casting","High Allagan Bracelets of Fending","High Allagan Bracelets of Healing","High Allagan Bracelets of Slaying","Historia Wristband of Aiming","Historia Wristband of Casting","Historia Wristband of Fending","Historia Wristband of Healing","Historia Wristband of Slaying","Holy Cedar Armillae","Hoplite Wristlets","Horn Armillae","Horse Chestnut Bracelet of Gathering","Ihuykanite Bracelet of Aiming","Ihuykanite Bracelet of Casting","Ihuykanite Bracelet of Fending","Ihuykanite Bracelet of Healing","Ihuykanite Bracelet of Slaying","Immaculate Bracelets of Aiming","Immaculate Bracelets of Casting","Immaculate Bracelets of Fending","Immaculate Bracelets of Healing","Immaculate Bracelets of Slaying","Imperial Bracelet of Aiming","Imperial Bracelet of Casting","Imperial Bracelet of Fending","Imperial Bracelet of Healing","Imperial Bracelet of Slaying","Imperial Jade Armillae of Aiming","Imperial Jade Armillae of Casting","Imperial Jade Armillae of Fending","Imperial Jade Armillae of Healing","Imperial Jade Armillae of Slaying","Imperial Operative Wristlets","Indagator's Bracelet of Crafting","Indagator's Bracelet of Gathering","Inferno Bangle of Aiming","Inferno Bangle of Casting","Inferno Bangle of Fending","Inferno Bangle of Healing","Inferno Bangle of Slaying","Integral Bracelet of Crafting","Iolite Bracelet","Ironwood Bracelet of Crafting","Ironworks Armillae of Crafting","Ironworks Armillae of Gathering","Ironworks Bracelet of Aiming","Ironworks Bracelet of Casting","Ironworks Bracelet of Fending","Ironworks Bracelet of Healing","Ironworks Bracelet of Slaying","Ishgardian Chaplain's Bracelets","Ishgardian Historian's Bracelets","Ishgardian Knight's Bracelets","Ishgardian Monastic's Bracelets","Ishgardian Outrider's Bracelets","Islewolf Bracelet of Aiming","Islewolf Bracelet of Casting","Islewolf Bracelet of Fending","Islewolf Bracelet of Healing","Islewolf Bracelet of Slaying","Koppranickel Bracelet of Aiming","Koppranickel Bracelet of Casting","Koppranickel Bracelet of Fending","Koppranickel Bracelet of Healing","Koppranickel Bracelet of Slaying","Ktiseos Bracelet of Aiming","Ktiseos Bracelet of Casting","Ktiseos Bracelet of Fending","Ktiseos Bracelet of Healing","Ktiseos Bracelet of Slaying","Kumbhiraskin Armilla of Gathering","Lakeland Amulet of Aiming","Lakeland Amulet of Casting","Lakeland Amulet of Fending","Lakeland Amulet of Healing","Lakeland Amulet of Slaying","Lakshmi's Bracelet of Aiming","Lakshmi's Bracelet of Casting","Lakshmi's Bracelet of Fending","Lakshmi's Bracelet of Healing","Lakshmi's Bracelet of Slaying","Landking's Armillae","Landmaster's Wristbands","Landsaint's Bracelets","Lapis Lazuli Bracelet","Lar Bracelets","Larch Bracelets","Leather Wristbands","Light-heavy Bangle of Aiming","Light-heavy Bangle of Casting","Light-heavy Bangle of Fending","Light-heavy Bangle of Healing","Light-heavy Bangle of Slaying","Lignum Vitae Bracelet","Lily and Serpent Bracelet","Limbo Amulet of Aiming","Limbo Amulet of Casting","Limbo Amulet of Fending","Limbo Amulet of Healing","Limbo Amulet of Slaying","Loboskin Amulet of Aiming","Loboskin Amulet of Casting","Loboskin Amulet of Fending","Loboskin Amulet of Healing","Loboskin Amulet of Slaying","Lost Allagan Bracelet of Aiming","Lost Allagan Bracelet of Casting","Lost Allagan Bracelet of Fending","Lost Allagan Bracelet of Healing","Lost Allagan Bracelet of Slaying","Lunar Envoy's Bracelets of Aiming","Lunar Envoy's Bracelets of Casting","Lunar Envoy's Bracelets of Fending","Lunar Envoy's Bracelets of Healing","Lunar Envoy's Bracelets of Slaying","Makai Bracelet of Aiming","Makai Bracelet of Casting","Makai Bracelet of Fending","Makai Bracelet of Healing","Makai Bracelet of Slaying","Malachite Bracelet","Manalis Wristband of Aiming","Manalis Wristband of Casting","Manalis Wristband of Fending","Manalis Wristband of Healing","Manalis Wristband of Slaying","Manasilver Bracelets","Manusya Amulet of Aiming","Manusya Amulet of Casting","Manusya Amulet of Fending","Manusya Amulet of Healing","Manusya Amulet of Slaying","Marid Leather Wristband","Midan Bracelets of Aiming","Midan Bracelets of Casting","Midan Bracelets of Fending","Midan Bracelets of Healing","Midan Bracelets of Slaying","Militia Bracelets","Militia Wristlets","Mirage Bracelet","Mistbreak Armillae of Aiming","Mistbreak Armillae of Casting","Mistbreak Armillae of Fending","Mistbreak Armillae of Healing","Mistbreak Armillae of Slaying","Mistfall Armillae of Aiming","Mistfall Armillae of Casting","Mistfall Armillae of Fending","Mistfall Armillae of Healing","Mistfall Armillae of Slaying","Mistic Memory Bracelet of Aiming","Mistic Memory Bracelet of Casting","Mistic Memory Bracelet of Fending","Mistic Memory Bracelet of Healing","Mistic Memory Bracelet of Slaying","Mistwake Amulet of Aiming","Mistwake Amulet of Casting","Mistwake Amulet of Fending","Mistwake Amulet of Healing","Mistwake Amulet of Slaying","Moonward Bracelet of Aiming","Moonward Bracelet of Casting","Moonward Bracelet of Fending","Moonward Bracelet of Healing","Moonward Bracelet of Slaying","Mythril Wristlets","Mythril Wristlets of Crafting","Mythrite Bangle of Aiming","Mythrite Bangle of Casting","Mythrite Bangle of Fending","Mythrite Bangle of Healing","Mythrite Bangle of Slaying","Mythrite Bracelet of Aiming","Mythrite Bracelet of Casting","Mythrite Bracelet of Fending","Mythrite Bracelet of Healing","Mythrite Bracelet of Slaying","Nabaath Wristband of Aiming","Nabaath Wristband of Casting","Nabaath Wristband of Fending","Nabaath Wristband of Healing","Nabaath Wristband of Slaying","Natural Afflatus Wristband","Neo Kingdom Bangles of Aiming","Neo Kingdom Bangles of Casting","Neo Kingdom Bangles of Fending","Neo Kingdom Bangles of Healing","Neo Kingdom Bangles of Slaying","Neo-Ishgardian Wristbands of Aiming","Neo-Ishgardian Wristbands of Casting","Neo-Ishgardian Wristbands of Fending","Neo-Ishgardian Wristbands of Healing","Neo-Ishgardian Wristbands of Slaying","Noct Wristlets","Nomad's Wristbands of Aiming","Nomad's Wristbands of Casting","Nomad's Wristbands of Fending","Nomad's Wristbands of Healing","Nomad's Wristbands of Slaying","Occult Bracelet of Blood","Occult Bracelet of Magic","Omega Bracelet of Aiming","Omega Bracelet of Casting","Omega Bracelet of Fending","Omega Bracelet of Healing","Omega Bracelet of Slaying","Omicron Bracelet of Aiming","Omicron Bracelet of Casting","Omicron Bracelet of Fending","Omicron Bracelet of Healing","Omicron Bracelet of Slaying","Opal Bracelet of Aiming","Opal Bracelet of Casting","Opal Bracelet of Fending","Opal Bracelet of Healing","Opal Bracelet of Slaying","Ophiotauroskin Wristband of Gathering","Orange Cornflower Wristlets","Origenics Wristlet of Aiming","Origenics Wristlet of Casting","Origenics Wristlet of Fending","Origenics Wristlet of Healing","Origenics Wristlet of Slaying","Orthodox Bracelet of Aiming","Orthodox Bracelet of Casting","Orthodox Bracelet of Fending","Orthodox Bracelet of Healing","Orthodox Bracelet of Slaying","Paglth'an Armillae of Aiming","Paglth'an Armillae of Casting","Paglth'an Armillae of Fending","Paglth'an Armillae of Healing","Paglth'an Armillae of Slaying","Palaka Bracelet of Aiming","Palaka Bracelet of Casting","Palaka Bracelet of Fending","Palaka Bracelet of Healing","Palaka Bracelet of Slaying","Palladium Bracelet of Aiming","Palladium Bracelet of Casting","Palladium Bracelet of Fending","Palladium Bracelet of Healing","Palladium Bracelet of Slaying","Palm Bracelets of Aiming","Palm Bracelets of Casting","Palm Bracelets of Fending","Palm Bracelets of Healing","Palm Bracelets of Slaying","Panegyrist's Bangles","Patriot's Bracelet","Pearl Bracelet","Peltast Wristlets","Peridot Bracelet","Persimmon Bracelets","Petalite Bracelet of Aiming","Petalite Bracelet of Casting","Petalite Bracelet of Fending","Petalite Bracelet of Healing","Petalite Bracelet of Slaying","Phantasmal Sardine Bracelet","Picaroon's Armillae of Slaying","Pink Beryl Bracelet of Aiming","Pink Beryl Bracelet of Casting","Pink Beryl Bracelet of Fending","Pink Beryl Bracelet of Healing","Pink Beryl Bracelet of Slaying","Plague Bringer's Bracelet","Plague Doctor's Bracelet","Platinum Bangles of Aiming","Platinum Bangles of Casting","Platinum Bangles of Fending","Platinum Bangles of Healing","Platinum Bangles of Slaying","Platinum Lone Wolf Bracelets","Platinum Pack Wolf Bracelets","Praemagitek Bracelet of Aiming","Praemagitek Bracelet of Casting","Praemagitek Bracelet of Fending","Praemagitek Bracelet of Healing","Praemagitek Bracelet of Slaying","Primal Bracelet of Aiming","Primal Bracelet of Casting","Primal Bracelet of Fending","Primal Bracelet of Healing","Primal Bracelet of Slaying","Promise of Devotion","Promise of Devotion (Platinum)","Promise of Innocence","Promise of Innocence (Standard)","Promise of Passion","Promise of Passion (Gold)","Prophet's Bangles","Proto Ultima Amulet of Aiming","Proto Ultima Amulet of Casting","Proto Ultima Amulet of Fending","Proto Ultima Amulet of Healing","Proto Ultima Amulet of Slaying","Prototype Alexandrian Bracelets of Aiming","Prototype Alexandrian Bracelets of Casting","Prototype Alexandrian Bracelets of Fending","Prototype Alexandrian Bracelets of Healing","Prototype Alexandrian Bracelets of Slaying","Prototype Gordian Wristband of Aiming","Prototype Gordian Wristband of Casting","Prototype Gordian Wristband of Fending","Prototype Gordian Wristband of Healing","Prototype Gordian Wristband of Slaying","Prototype Midan Bracelets of Aiming","Prototype Midan Bracelets of Casting","Prototype Midan Bracelets of Fending","Prototype Midan Bracelets of Healing","Prototype Midan Bracelets of Slaying","Purgatory Amulet of Aiming","Purgatory Amulet of Casting","Purgatory Amulet of Fending","Purgatory Amulet of Healing","Purgatory Amulet of Slaying","Purple Cornflower Wristlets","Quetzalli Bracelets of Aiming","Quetzalli Bracelets of Casting","Quetzalli Bracelets of Fending","Quetzalli Bracelets of Healing","Quetzalli Bracelets of Slaying","Radiant's Bracelet of Aiming","Radiant's Bracelet of Casting","Radiant's Bracelet of Fending","Radiant's Bracelet of Healing","Radiant's Bracelet of Slaying","Rainbow Cornflower Wristlets","Rakshasa Bracelet of Aiming","Rakshasa Bracelet of Casting","Rakshasa Bracelet of Fending","Rakshasa Bracelet of Healing","Rakshasa Bracelet of Slaying","Raptorskin Wristbands","Raptorskin Wristbands of Gathering","Ravel Keeper's Bracelet of Aiming","Ravel Keeper's Bracelet of Casting","Ravel Keeper's Bracelet of Fending","Ravel Keeper's Bracelet of Healing","Ravel Keeper's Bracelet of Slaying","Red Coral Armillae","Red Cornflower Wristlets","Resilient Bracelet of Aiming","Resilient Bracelet of Casting","Resilient Bracelet of Fending","Resilient Bracelet of Healing","Resilient Bracelet of Slaying","Rinascita Bracelet of Aiming","Rinascita Bracelet of Casting","Rinascita Bracelet of Fending","Rinascita Bracelet of Healing","Rinascita Bracelet of Slaying","Riversbreath Bracelet of Aiming","Riversbreath Bracelet of Casting","Riversbreath Bracelet of Fending","Riversbreath Bracelet of Healing","Riversbreath Bracelet of Slaying","Ronkan Bracelets of Aiming","Ronkan Bracelets of Casting","Ronkan Bracelets of Fending","Ronkan Bracelets of Healing","Ronkan Bracelets of Slaying","Rose Gold Bracelets","Royal Volunteer's Bracelet of Aiming","Royal Volunteer's Bracelet of Casting","Royal Volunteer's Bracelet of Fending","Royal Volunteer's Bracelet of Healing","Royal Volunteer's Bracelet of Slaying","Rubellite Bracelet","Ruby Bracelet","Ruby Tide Bracelets of Aiming","Ruby Tide Bracelets of Casting","Ruby Tide Bracelets of Fending","Ruby Tide Bracelets of Healing","Ruby Tide Bracelets of Slaying","Ryumyaku Bracelet of Aiming","Ryumyaku Bracelet of Casting","Ryumyaku Bracelet of Fending","Ryumyaku Bracelet of Healing","Ryumyaku Bracelet of Slaying","Sapphire Bracelet","Scaevan Bracelet of Aiming","Scaevan Bracelet of Casting","Scaevan Bracelet of Fending","Scaevan Bracelet of Healing","Scaevan Bracelet of Slaying","Serpent Sergeant's Bracelet","Shadowless Bracelet of Aiming","Shadowless Bracelet of Casting","Shadowless Bracelet of Fending","Shadowless Bracelet of Healing","Shadowless Bracelet of Slaying","Sharlayan Conservator's Bangle","Sharlayan Custodian's Bangle","Sharlayan Pankratiast's Bangle","Sharlayan Philosopher's Bangle","Sharlayan Preceptor's Bangle","Shire Conservator's Bracelet","Shire Custodian's Bracelet","Shire Pankratiast's Bracelets","Shire Philosopher's Bracelets","Shire Preceptor's Bracelets","Silver Lone Wolf Bracelets","Silver Pack Wolf Bracelets","Silver Wristlets","Silver Wristlets of Crafting","Skallic Amulet of Aiming","Skallic Amulet of Casting","Skallic Amulet of Fending","Skallic Amulet of Healing","Skallic Amulet of Slaying","Skydeep Bracelets of Aiming","Skydeep Bracelets of Casting","Skydeep Bracelets of Fending","Skydeep Bracelets of Healing","Skydeep Bracelets of Slaying","Slothskin Armillae of Gathering","Smilodonskin Wristband","Sphene Bracelet","Spinel Bracelet","Star Quartz Wristband of Aiming","Star Quartz Wristband of Casting","Star Quartz Wristband of Fending","Star Quartz Wristband of Healing","Star Quartz Wristband of Slaying","Star Spinel Bracelet of Aiming","Star Spinel Bracelet of Casting","Star Spinel Bracelet of Fending","Star Spinel Bracelet of Healing","Star Spinel Bracelet of Slaying","Star Tech Bracelet of Crafting","Star Tech Bracelet of Gathering","Storm Sergeant's Bracelet","Strategos Wristlets","Sunburst Armillae of Aiming","Sunburst Armillae of Casting","Sunburst Armillae of Fending","Sunburst Armillae of Healing","Sunburst Armillae of Slaying","Sunstone Bracelet","Sunstreak Armillae of Aiming","Sunstreak Armillae of Casting","Sunstreak Armillae of Fending","Sunstreak Armillae of Healing","Sunstreak Armillae of Slaying","Teak Bracelet of Aiming","Teak Bracelet of Casting","Teak Bracelet of Fending","Teak Bracelet of Healing","Teak Bracelet of Slaying","The Emperor's New Bracelet","The Forgiven's Bracelet of Aiming","The Forgiven's Bracelet of Casting","The Forgiven's Bracelet of Fending","The Forgiven's Bracelet of Healing","The Forgiven's Bracelet of Slaying","The Last Bracelet of Aiming","The Last Bracelet of Casting","The Last Bracelet of Fending","The Last Bracelet of Healing","The Last Bracelet of Slaying","The Twelve's Bracelet of Aiming","The Twelve's Bracelet of Casting","The Twelve's Bracelet of Fending","The Twelve's Bracelet of Healing","The Twelve's Bracelet of Slaying","Tipping Scales Bracelet","Topaz Bracelet","Torreya Bracelet of Aiming","Torreya Bracelet of Casting","Torreya Bracelet of Fending","Torreya Bracelet of Healing","Torreya Bracelet of Slaying","Tortoiseshell Armillae","Tourmaline Bracelet","Toxotes Wristlets","Triphane Bracelet of Aiming","Triphane Bracelet of Casting","Triphane Bracelet of Fending","Triphane Bracelet of Healing","Triphane Bracelet of Slaying","Triplite Bracelet of Aiming","Triplite Bracelet of Casting","Triplite Bracelet of Fending","Triplite Bracelet of Healing","Triplite Bracelet of Slaying","Troian Bracelet of Aiming","Troian Bracelet of Casting","Troian Bracelet of Fending","Troian Bracelet of Healing","Troian Bracelet of Slaying","True Ice Bracelet of Aiming","True Ice Bracelet of Casting","True Ice Bracelet of Fending","True Ice Bracelet of Healing","True Ice Bracelet of Slaying","Turquoise Bracelet","Underkeep Wristband of Aiming","Underkeep Wristband of Casting","Underkeep Wristband of Fending","Underkeep Wristband of Healing","Underkeep Wristband of Slaying","Valerian Archer's Bracelet","Valerian Brawler's Bracelet","Valerian Dark Priest's Bracelet","Valerian Fusilier's Bracelet","Valerian Priest's Bracelet","Valerian Shaman's Bracelet","Valerian Smuggler's Bracelet","Valerian Terror Knight's Bracelet","Valerian Wizard's Bracelet","Valkyrie's Bracelet of Aiming","Valkyrie's Bracelet of Casting","Valkyrie's Bracelet of Fending","Valkyrie's Bracelet of Healing","Valkyrie's Bracelet of Slaying","Vanguard Bracelets of Aiming","Vanguard Bracelets of Casting","Vanguard Bracelets of Fending","Vanguard Bracelets of Healing","Vanguard Bracelets of Slaying","Varlet's Armillae","Viking Bangles","Voeburtite Armillae of Aiming","Voeburtite Armillae of Casting","Voeburtite Armillae of Fending","Voeburtite Armillae of Healing","Voeburtite Armillae of Slaying","Voidmoon Bracelets of Aiming","Voidmoon Bracelets of Casting","Voidmoon Bracelets of Fending","Voidmoon Bracelets of Healing","Voidmoon Bracelets of Slaying","Warg Bracelet of Aiming","Warg Bracelet of Casting","Warg Bracelet of Fending","Warg Bracelet of Healing","Warg Bracelet of Slaying","Warwolf Bracelet of Aiming","Warwolf Bracelet of Casting","Warwolf Bracelet of Fending","Warwolf Bracelet of Healing","Warwolf Bracelet of Slaying","Weathered Auroral Wristlets","Weathered Daystar Armillae","Weathered Evenstar Armillae","Weathered Gloam Wristlets","Weathered Noct Wristlets","Weathered Wristlets","Werewolf Bracelet of Aiming","Werewolf Bracelet of Casting","Werewolf Bracelet of Fending","Werewolf Bracelet of Healing","Werewolf Bracelet of Slaying","Whalaqee Bracelet","White Ash Bracelet","White Cornflower Wristlets","White Gold Amulet of Aiming","White Gold Amulet of Casting","White Gold Amulet of Fending","White Gold Amulet of Healing","White Gold Amulet of Slaying","White Oak Bracelets","Woad Skydruid's Bangle","Woad Skyhunter's Bangle","Woad Skyraider's Bangle","Woad Skywarrior's Bangle","Woad Skywicce's Bangle","Wolf Amber Bracelet","Wolf Rubellite Bracelet","Wolf Spinel Bracelet","Wolf Tourmaline Bracelet","Wolf Turquoise Bracelet","Wolf Zircon Bracelet","Wrangler's Bangles","Wyvernskin Wristbands","Xenobian Paladin's Bracelet","Yama Bracelet of Aiming","Yama Bracelet of Casting","Yama Bracelet of Fending","Yama Bracelet of Healing","Yama Bracelet of Slaying","Yanxian Bracelets of Aiming","Yanxian Bracelets of Casting","Yanxian Bracelets of Fending","Yanxian Bracelets of Healing","Yanxian Bracelets of Slaying","Yasha Bracelets of Aiming","Yasha Bracelets of Casting","Yasha Bracelets of Fending","Yasha Bracelets of Healing","Yasha Bracelets of Slaying","Yellow Cornflower Wristlets","Yo-kai Watch","Yuweyawata Amulet of Aiming","Yuweyawata Amulet of Casting","Yuweyawata Amulet of Fending","Yuweyawata Amulet of Healing","Yuweyawata Amulet of Slaying","Zelkova Bracelets","Zircon Bracelet","Zormor Bracelet of Aiming","Zormor Bracelet of Casting","Zormor Bracelet of Fending","Zormor Bracelet of Healing","Zormor Bracelet of Slaying"]),"rings":new Set(["Abyssos Ring of Aiming","Abyssos Ring of Casting","Abyssos Ring of Fending","Abyssos Ring of Healing","Abyssos Ring of Slaying","Acacia Ring","Aesthete's Ring of Crafting","Aesthete's Ring of Gathering","Aetherial Amber Ring","Aetherial Amethyst Ring","Aetherial Aquamarine Ring","Aetherial Black Pearl Ring","Aetherial Brass Ring","Aetherial Coral Ring","Aetherial Danburite Ring","Aetherial Electrum Ring","Aetherial Fluorite Ring","Aetherial Garnet Ring","Aetherial Goshenite Ring","Aetherial Heliodor Ring","Aetherial Horn Ring","Aetherial Lapis Lazuli Ring","Aetherial Malachite Ring","Aetherial Mythril Ring","Aetherial Pearl Ring","Aetherial Peridot Ring","Aetherial Red Coral Ring","Aetherial Rubellite Ring","Aetherial Silver Ring","Aetherial Sphene Ring","Aetherial Spinel Ring","Aetherial Sunstone Ring","Aetherial Tourmaline Ring","Aetherial Turquoise Ring","Aetherial Zircon Ring","Aetheryte Ring","Agate Ring of Aiming","Agate Ring of Casting","Agate Ring of Fending","Agate Ring of Healing","Agate Ring of Slaying","Ala Mhigan Ring of Aiming","Ala Mhigan Ring of Casting","Ala Mhigan Ring of Fending","Ala Mhigan Ring of Healing","Ala Mhigan Ring of Slaying","Alexandrian Ring of Aiming","Alexandrian Ring of Casting","Alexandrian Ring of Fending","Alexandrian Ring of Healing","Alexandrian Ring of Slaying","Allagan Ring of Aiming","Allagan Ring of Casting","Allagan Ring of Fending","Allagan Ring of Healing","Allagan Ring of Maiming","Allagan Ring of Striking","Alliance Ring of Aiming","Alliance Ring of Casting","Alliance Ring of Fending","Alliance Ring of Healing","Alliance Ring of Slaying","Alpha Wolf Ring","Althyk's Ring","Amaurotine Ring of Aiming","Amaurotine Ring of Casting","Amaurotine Ring of Fending","Amaurotine Ring of Healing","Amaurotine Ring of Slaying","Amber Ring","Amethyst Ring","Ametrine Ring of Aiming","Ametrine Ring of Casting","Ametrine Ring of Crafting","Ametrine Ring of Fending","Ametrine Ring of Healing","Ametrine Ring of Slaying","Anabaseios Ring of Aiming","Anabaseios Ring of Casting","Anabaseios Ring of Fending","Anabaseios Ring of Healing","Anabaseios Ring of Slaying","Anamnesis Ring of Aiming","Anamnesis Ring of Casting","Anamnesis Ring of Fending","Anamnesis Ring of Healing","Anamnesis Ring of Slaying","Aquamarine Ring","Arcanist's Ring","Archeo Kingdom Ring of Aiming","Archeo Kingdom Ring of Casting","Archeo Kingdom Ring of Fending","Archeo Kingdom Ring of Healing","Archeo Kingdom Ring of Slaying","Archer's Ring","Ardent Ring of Aiming","Ardent Ring of Casting","Ardent Ring of Fending","Ardent Ring of Healing","Ardent Ring of Slaying","Arhat Ring of Aiming","Arhat Ring of Casting","Arhat Ring of Fending","Arhat Ring of Healing","Arhat Ring of Slaying","Artful Afflatus Ring","Ascension Ring of Aiming","Ascension Ring of Casting","Ascension Ring of Fending","Ascension Ring of Healing","Ascension Ring of Slaying","Asphodelos Ring of Aiming","Asphodelos Ring of Casting","Asphodelos Ring of Fending","Asphodelos Ring of Healing","Asphodelos Ring of Slaying","Astral Birch Ring","Astral Ring","Asuran Ring of Aiming","Asuran Ring of Casting","Asuran Ring of Fending","Asuran Ring of Healing","Asuran Ring of Slaying","Augmented Archeo Kingdom Ring of Aiming","Augmented Archeo Kingdom Ring of Casting","Augmented Archeo Kingdom Ring of Fending","Augmented Archeo Kingdom Ring of Healing","Augmented Archeo Kingdom Ring of Slaying","Augmented Bygone Brass Ring of Aiming","Augmented Bygone Brass Ring of Casting","Augmented Bygone Brass Ring of Fending","Augmented Bygone Brass Ring of Healing","Augmented Bygone Brass Ring of Slaying","Augmented Ceremonial Ring of Aiming","Augmented Ceremonial Ring of Casting","Augmented Ceremonial Ring of Fending","Augmented Ceremonial Ring of Healing","Augmented Ceremonial Ring of Slaying","Augmented Classical Ring of Aiming","Augmented Classical Ring of Casting","Augmented Classical Ring of Fending","Augmented Classical Ring of Healing","Augmented Classical Ring of Slaying","Augmented Courtly Lover's Ring of Aiming","Augmented Courtly Lover's Ring of Casting","Augmented Courtly Lover's Ring of Fending","Augmented Courtly Lover's Ring of Healing","Augmented Courtly Lover's Ring of Slaying","Augmented Credendum Ring of Aiming","Augmented Credendum Ring of Casting","Augmented Credendum Ring of Fending","Augmented Credendum Ring of Healing","Augmented Credendum Ring of Slaying","Augmented Cryptlurker's Ring of Aiming","Augmented Cryptlurker's Ring of Casting","Augmented Cryptlurker's Ring of Fending","Augmented Cryptlurker's Ring of Healing","Augmented Cryptlurker's Ring of Slaying","Augmented Crystarium Ring of Aiming","Augmented Crystarium Ring of Casting","Augmented Crystarium Ring of Fending","Augmented Crystarium Ring of Healing","Augmented Crystarium Ring of Slaying","Augmented Deepshadow Ring of Aiming","Augmented Deepshadow Ring of Casting","Augmented Deepshadow Ring of Fending","Augmented Deepshadow Ring of Healing","Augmented Deepshadow Ring of Slaying","Augmented Diadochos Ring of Aiming","Augmented Diadochos Ring of Casting","Augmented Diadochos Ring of Fending","Augmented Diadochos Ring of Healing","Augmented Diadochos Ring of Slaying","Augmented Exarchic Ring of Aiming","Augmented Exarchic Ring of Casting","Augmented Exarchic Ring of Fending","Augmented Exarchic Ring of Healing","Augmented Exarchic Ring of Slaying","Augmented Facet Ring of Aiming","Augmented Facet Ring of Casting","Augmented Facet Ring of Fending","Augmented Facet Ring of Healing","Augmented Facet Ring of Slaying","Augmented Handmaster's Ring","Augmented Historia Ring of Aiming","Augmented Historia Ring of Casting","Augmented Historia Ring of Fending","Augmented Historia Ring of Healing","Augmented Historia Ring of Slaying","Augmented Ironworks Ring of Aiming","Augmented Ironworks Ring of Casting","Augmented Ironworks Ring of Fending","Augmented Ironworks Ring of Healing","Augmented Ironworks Ring of Slaying","Augmented Landmaster's Ring","Augmented Lost Allagan Ring of Aiming","Augmented Lost Allagan Ring of Casting","Augmented Lost Allagan Ring of Fending","Augmented Lost Allagan Ring of Healing","Augmented Lost Allagan Ring of Slaying","Augmented Lunar Envoy's Ring of Aiming","Augmented Lunar Envoy's Ring of Casting","Augmented Lunar Envoy's Ring of Fending","Augmented Lunar Envoy's Ring of Healing","Augmented Lunar Envoy's Ring of Slaying","Augmented Neo-Ishgardian Ring of Aiming","Augmented Neo-Ishgardian Ring of Casting","Augmented Neo-Ishgardian Ring of Fending","Augmented Neo-Ishgardian Ring of Healing","Augmented Neo-Ishgardian Ring of Slaying","Augmented Primal Ring of Aiming","Augmented Primal Ring of Casting","Augmented Primal Ring of Fending","Augmented Primal Ring of Healing","Augmented Primal Ring of Slaying","Augmented Quetzalli Ring of Aiming","Augmented Quetzalli Ring of Casting","Augmented Quetzalli Ring of Fending","Augmented Quetzalli Ring of Healing","Augmented Quetzalli Ring of Slaying","Augmented Radiant's Ring of Aiming","Augmented Radiant's Ring of Casting","Augmented Radiant's Ring of Fending","Augmented Radiant's Ring of Healing","Augmented Radiant's Ring of Slaying","Augmented Rinascita Ring of Aiming","Augmented Rinascita Ring of Casting","Augmented Rinascita Ring of Fending","Augmented Rinascita Ring of Healing","Augmented Rinascita Ring of Slaying","Augmented Scaevan Ring of Aiming","Augmented Scaevan Ring of Casting","Augmented Scaevan Ring of Fending","Augmented Scaevan Ring of Healing","Augmented Scaevan Ring of Slaying","Augmented Shire Conservator's Ring","Augmented Shire Custodian's Ring","Augmented Shire Pankratiast's Ring","Augmented Shire Philosopher's Ring","Augmented Shire Preceptor's Ring","Augmented Silvergrace Ring of Aiming","Augmented Silvergrace Ring of Casting","Augmented Silvergrace Ring of Fending","Augmented Silvergrace Ring of Healing","Augmented Silvergrace Ring of Slaying","Auroral Ring","Azeyma's Ring","Azurite Ring of Aiming","Azurite Ring of Casting","Azurite Ring of Fending","Azurite Ring of Healing","Azurite Ring of Slaying","Babyface Champion's Ring of Aiming","Babyface Champion's Ring of Casting","Babyface Champion's Ring of Fending","Babyface Champion's Ring of Healing","Babyface Champion's Ring of Slaying","Battleliege Ring of Aiming","Battleliege Ring of Casting","Battleliege Ring of Fending","Battleliege Ring of Healing","Battleliege Ring of Slaying","Berserker's Ring","Bismuth Ring of Aiming","Bismuth Ring of Casting","Bismuth Ring of Fending","Bismuth Ring of Healing","Bismuth Ring of Slaying","Black Pearl Ring","Black Star Ring of Aiming","Black Star Ring of Casting","Black Star Ring of Crafting","Black Star Ring of Fending","Black Star Ring of Healing","Black Star Ring of Slaying","Black Willow Ring of Crafting","Blessed Ring","Blitzring","Blue Zircon Ring of Aiming","Blue Zircon Ring of Casting","Blue Zircon Ring of Fending","Blue Zircon Ring of Healing","Blue Zircon Ring of Slaying","Boarskin Ring","Bogatyr's Ring of Aiming","Bogatyr's Ring of Casting","Bogatyr's Ring of Healing","Bone Ring","Bonewicca Ring of Aiming","Bonewicca Ring of Casting","Bonewicca Ring of Fending","Bonewicca Ring of Healing","Bonewicca Ring of Slaying","Brand-new Ring","Brass Ring","Brass Ring of Crafting","Brilliant Egg Ring","Bronze Lone Wolf Ring","Bronze Pack Wolf Ring","Bygone Brass Ring of Aiming","Bygone Brass Ring of Casting","Bygone Brass Ring of Fending","Bygone Brass Ring of Healing","Bygone Brass Ring of Slaying","Byregot's Ring","Carborundum Ring of Aiming","Carborundum Ring of Casting","Carborundum Ring of Fending","Carborundum Ring of Healing","Carborundum Ring of Slaying","Ceremonial Ring of Aiming","Ceremonial Ring of Casting","Ceremonial Ring of Fending","Ceremonial Ring of Healing","Ceremonial Ring of Slaying","Chocobo Egg Ring","Chrysolite Ring of Aiming","Chrysolite Ring of Casting","Chrysolite Ring of Fending","Chrysolite Ring of Healing","Chrysolite Ring of Slaying","Classical Ring of Aiming","Classical Ring of Casting","Classical Ring of Fending","Classical Ring of Healing","Classical Ring of Slaying","Conjurer's Ring","Copper Ring","Coral Ring","Courtly Lover's Ring of Aiming","Courtly Lover's Ring of Casting","Courtly Lover's Ring of Fending","Courtly Lover's Ring of Healing","Courtly Lover's Ring of Slaying","Credendum Ring of Aiming","Credendum Ring of Casting","Credendum Ring of Fending","Credendum Ring of Healing","Credendum Ring of Slaying","Crested Ring of Crafting","Crested Ring of Gathering","Crimson Standard Ring","Cruiser Ring of Aiming","Cruiser Ring of Casting","Cruiser Ring of Fending","Cruiser Ring of Healing","Cruiser Ring of Slaying","Cryptlurker's Ring of Aiming","Cryptlurker's Ring of Casting","Cryptlurker's Ring of Fending","Cryptlurker's Ring of Healing","Cryptlurker's Ring of Slaying","Crystarium Ring of Aiming","Crystarium Ring of Casting","Crystarium Ring of Fending","Crystarium Ring of Healing","Crystarium Ring of Slaying","Dai-ryumyaku Ring of Aiming","Dai-ryumyaku Ring of Casting","Dai-ryumyaku Ring of Fending","Dai-ryumyaku Ring of Healing","Dai-ryumyaku Ring of Slaying","Danburite Ring","Darbar Ring of Aiming","Darbar Ring of Casting","Darbar Ring of Fending","Darbar Ring of Healing","Darbar Ring of Slaying","Dark Horse Champion's Ring of Aiming","Dark Horse Champion's Ring of Casting","Dark Horse Champion's Ring of Fending","Dark Horse Champion's Ring of Healing","Dark Horse Champion's Ring of Slaying","Darklight Band of Aiming","Darklight Band of Casting","Darklight Band of Fending","Darklight Band of Healing","Darklight Band of Maiming","Darklight Band of Striking","Dated Amethyst Ring","Dated Aquamarine Ring","Dated Black Pearl Ring","Dated Bone Ring","Dated Brass Ring","Dated Copper Ring","Dated Danburite Ring","Dated Darksilver Ring","Dated Electrum Ring","Dated Fluorite Ring","Dated Garnet Ring","Dated Goshenite Ring","Dated Heliodor Ring","Dated Lapis Lazuli Ring","Dated Malachite Ring","Dated Pearl Ring","Dated Peridot Ring","Dated Silver Ring","Dated Sphene Ring","Dated Sunstone Ring","Daystar Ring","Deepmist Ring of Aiming","Deepmist Ring of Casting","Deepmist Ring of Fending","Deepmist Ring of Healing","Deepmist Ring of Slaying","Deepshadow Ring of Aiming","Deepshadow Ring of Casting","Deepshadow Ring of Fending","Deepshadow Ring of Healing","Deepshadow Ring of Slaying","Demagogue Ring","Diadochos Ring of Aiming","Diadochos Ring of Casting","Diadochos Ring of Fending","Diadochos Ring of Healing","Diadochos Ring of Slaying","Diamond Lone Wolf Ring","Diamond Pack Wolf Ring","Diamond Ring","Diamond Ring of Aiming","Diamond Ring of Casting","Diamond Ring of Fending","Diamond Ring of Healing","Diamond Ring of Slaying","Diaspore Ring of Aiming","Diaspore Ring of Casting","Diaspore Ring of Fending","Diaspore Ring of Healing","Diaspore Ring of Slaying","Direwolf Ring of Aiming","Direwolf Ring of Casting","Direwolf Ring of Fending","Direwolf Ring of Healing","Direwolf Ring of Slaying","Distance Ring of Aiming","Distance Ring of Casting","Distance Ring of Fending","Distance Ring of Healing","Distance Ring of Slaying","Dodore Ring","Dragonskin Ring","Dravanian Ring of Aiming","Dravanian Ring of Casting","Dravanian Ring of Fending","Dravanian Ring of Healing","Dravanian Ring of Slaying","Dreadwyrm Ring of Aiming","Dreadwyrm Ring of Casting","Dreadwyrm Ring of Fending","Dreadwyrm Ring of Healing","Dreadwyrm Ring of Slaying","Dwarven Mythril Ring","Edencall Ring of Aiming","Edencall Ring of Casting","Edencall Ring of Fending","Edencall Ring of Healing","Edencall Ring of Slaying","Edenchoir Ring of Aiming","Edenchoir Ring of Casting","Edenchoir Ring of Fending","Edenchoir Ring of Healing","Edenchoir Ring of Slaying","Edengate Ring of Aiming","Edengate Ring of Casting","Edengate Ring of Fending","Edengate Ring of Healing","Edengate Ring of Slaying","Edengrace Ring of Aiming","Edengrace Ring of Casting","Edengrace Ring of Fending","Edengrace Ring of Healing","Edengrace Ring of Slaying","Edenmete Ring of Aiming","Edenmete Ring of Casting","Edenmete Ring of Fending","Edenmete Ring of Healing","Edenmete Ring of Slaying","Edenmorn Ring of Aiming","Edenmorn Ring of Casting","Edenmorn Ring of Fending","Edenmorn Ring of Healing","Edenmorn Ring of Slaying","Eikon Iron Ring of Aiming","Eikon Iron Ring of Casting","Eikon Iron Ring of Fending","Eikon Iron Ring of Healing","Eikon Iron Ring of Slaying","Electrum Ring","Electrum Ring of Crafting","Emerald Ring","Empyrean Ring","Enaretos Ring","Epochal Ring of Aiming","Epochal Ring of Casting","Epochal Ring of Fending","Epochal Ring of Healing","Epochal Ring of Slaying","Eternal Dark Ring of Aiming","Eternal Dark Ring of Casting","Eternal Dark Ring of Fending","Eternal Dark Ring of Healing","Eternal Dark Ring of Slaying","Eternity Ring","Etheirys Ring of Aiming","Etheirys Ring of Casting","Etheirys Ring of Fending","Etheirys Ring of Healing","Etheirys Ring of Slaying","Evenstar Ring","Eversharp Ring","Exarchic Ring of Aiming","Exarchic Ring of Casting","Exarchic Ring of Fending","Exarchic Ring of Healing","Exarchic Ring of Slaying","Explorer's Ring","Fabled Ring of Aiming","Fabled Ring of Casting","Fabled Ring of Fending","Fabled Ring of Healing","Fabled Ring of Slaying","Facet Ring of Aiming","Facet Ring of Casting","Facet Ring of Fending","Facet Ring of Healing","Facet Ring of Slaying","Farlander Ring of Aiming","Farlander Ring of Casting","Farlander Ring of Fending","Farlander Ring of Healing","Farlander Ring of Slaying","Filibuster's Ring of Aiming","Filibuster's Ring of Casting","Filibuster's Ring of Fending","Filibuster's Ring of Healing","Filibuster's Ring of Slaying","Firecrest Ring","Flame Private's Ring","Flame Sergeant's Ring","Flamebringer's Ring","Flamecarrier's Ring","Fluorite Ring","Garnet Ring","Gazelleskin Ring","Genji Ring of Aiming","Genji Ring of Casting","Genji Ring of Fending","Genji Ring of Healing","Genji Ring of Slaying","Genta Ring of Aiming","Genta Ring of Casting","Genta Ring of Fending","Genta Ring of Healing","Genta Ring of Slaying","Ghost Barque Ring of Aiming","Ghost Barque Ring of Casting","Ghost Barque Ring of Fending","Ghost Barque Ring of Healing","Ghost Barque Ring of Slaying","Ginseng Ring","Gladiator's Ring","Glass Pumpkin Ring","Gloam Ring","Goatskin Ring","Gold Lone Wolf Ring","Gold Pack Wolf Ring","Gomphotherium Ring","Gordian Ring of Aiming","Gordian Ring of Casting","Gordian Ring of Fending","Gordian Ring of Healing","Gordian Ring of Slaying","Goshenite Ring","Grand Champion's Ring of Aiming","Grand Champion's Ring of Casting","Grand Champion's Ring of Fending","Grand Champion's Ring of Healing","Grand Champion's Ring of Slaying","Great Serpent of Ringa","Gridanian Ring","Griffin Leather Ring","Griffin Talon Ring of Aiming","Griffin Talon Ring of Casting","Griffin Talon Ring of Fending","Griffin Talon Ring of Healing","Griffin Talon Ring of Slaying","Gryphonskin Ring","Gysahl Ring","Gyuki Leather Ring","Hallowed Chestnut Ring","Halone's Ring","Halonic Auditor's Ring","Halonic Exorcist's Ring","Halonic Friar's Ring","Halonic Inquisitor's Ring","Halonic Priest's Ring","Handking's Ring","Handmaster's Ring","Handsaint's Ring","Heavyweight Ring of Aiming","Heavyweight Ring of Casting","Heavyweight Ring of Fending","Heavyweight Ring of Healing","Heavyweight Ring of Slaying","Heirloom Ring of Aiming","Heirloom Ring of Casting","Heirloom Ring of Fending","Heirloom Ring of Healing","Heirloom Ring of Slaying","Heliodor Ring","Hellwolf Ring of Aiming","Hellwolf Ring of Casting","Hellwolf Ring of Fending","Hellwolf Ring of Healing","Hellwolf Ring of Slaying","Hero's Ring of Aiming","Hero's Ring of Casting","Hero's Ring of Fending","Hero's Ring of Healing","Hero's Ring of Slaying","High Allagan Ring of Aiming","High Allagan Ring of Casting","High Allagan Ring of Fending","High Allagan Ring of Healing","High Allagan Ring of Slaying","Historia Ring of Aiming","Historia Ring of Casting","Historia Ring of Fending","Historia Ring of Healing","Historia Ring of Slaying","Holy Cedar Ring","Hoplite Ring","Horn Ring","Horse Chestnut Ring of Gathering","Ihuykanite Ring of Aiming","Ihuykanite Ring of Casting","Ihuykanite Ring of Fending","Ihuykanite Ring of Healing","Ihuykanite Ring of Slaying","Immaculate Ring of Aiming","Immaculate Ring of Casting","Immaculate Ring of Fending","Immaculate Ring of Healing","Immaculate Ring of Slaying","Imperial Jade Ring of Aiming","Imperial Jade Ring of Casting","Imperial Jade Ring of Fending","Imperial Jade Ring of Healing","Imperial Jade Ring of Slaying","Imperial Ring of Aiming","Imperial Ring of Casting","Imperial Ring of Fending","Imperial Ring of Healing","Imperial Ring of Slaying","Indagator's Ring of Crafting","Indagator's Ring of Gathering","Integral Ring of Crafting","Iolite Ring","Ironwood Ring of Crafting","Ironworks Ring of Aiming","Ironworks Ring of Casting","Ironworks Ring of Crafting","Ironworks Ring of Fending","Ironworks Ring of Gathering","Ironworks Ring of Healing","Ironworks Ring of Slaying","Ishgardian Chaplain's Ring","Ishgardian Historian's Ring","Ishgardian Knight's Ring","Ishgardian Monastic's Ring","Ishgardian Outrider's Ring","Islewolf Ring of Aiming","Islewolf Ring of Casting","Islewolf Ring of Fending","Islewolf Ring of Healing","Islewolf Ring of Slaying","Judgment Ring of Aiming","Judgment Ring of Casting","Judgment Ring of Fending","Judgment Ring of Healing","Judgment Ring of Slaying","Ktiseos Ring of Aiming","Ktiseos Ring of Casting","Ktiseos Ring of Fending","Ktiseos Ring of Healing","Ktiseos Ring of Slaying","Kumbhiraskin Ring of Gathering","Lakeland Ring of Aiming","Lakeland Ring of Casting","Lakeland Ring of Fending","Lakeland Ring of Healing","Lakeland Ring of Slaying","Lakshmi's Ring of Aiming","Lakshmi's Ring of Casting","Lakshmi's Ring of Fending","Lakshmi's Ring of Healing","Lakshmi's Ring of Slaying","Lancer's Ring","Landking's Ring","Landmaster's Ring","Landsaint's Ring","Lapis Lazuli Ring","Lar Ring","Lar Ring of Aiming","Lar Ring of Casting","Lar Ring of Fending","Lar Ring of Healing","Lar Ring of Slaying","Larch Ring","Lazurite Ring of Aiming","Lazurite Ring of Casting","Lazurite Ring of Fending","Lazurite Ring of Healing","Lazurite Ring of Slaying","Light-heavy Ring of Aiming","Light-heavy Ring of Casting","Light-heavy Ring of Fending","Light-heavy Ring of Healing","Light-heavy Ring of Slaying","Lignum Vitae Ring","Lily and Serpent Ring","Limbo Ring of Aiming","Limbo Ring of Casting","Limbo Ring of Fending","Limbo Ring of Healing","Limbo Ring of Slaying","Llymlaen's Ring","Lominsan Ring","Lost Allagan Ring of Aiming","Lost Allagan Ring of Casting","Lost Allagan Ring of Fending","Lost Allagan Ring of Healing","Lost Allagan Ring of Slaying","Lunar Envoy's Ring of Aiming","Lunar Envoy's Ring of Casting","Lunar Envoy's Ring of Fending","Lunar Envoy's Ring of Healing","Lunar Envoy's Ring of Slaying","Mad Bird Ring","Mage's Ring","Makai Ring of Aiming","Makai Ring of Casting","Makai Ring of Fending","Makai Ring of Healing","Makai Ring of Slaying","Malachite Ring","Manalis Ring of Aiming","Manalis Ring of Casting","Manalis Ring of Fending","Manalis Ring of Healing","Manalis Ring of Slaying","Manasilver Ring","Manusya Ring of Aiming","Manusya Ring of Casting","Manusya Ring of Fending","Manusya Ring of Healing","Manusya Ring of Slaying","Marauder's Ring","Marid Leather Ring","Master Alchemist's Ring","Master Arcanist's Ring","Master Archer's Ring","Master Armorer's Ring","Master Blacksmith's Ring","Master Botanist's Ring","Master Carpenter's Ring","Master Conjurer's Ring","Master Culinarian's Ring","Master Fisher's Ring","Master Gladiator's Ring","Master Goldsmith's Ring","Master Lancer's Ring","Master Leatherworker's Ring","Master Marauder's Ring","Master Miner's Ring","Master Pugilist's Ring","Master Rogue's Ring","Master Thaumaturge's Ring","Master Weaver's Ring","Menphina's Ring","Meteor Survivor Ring","Midan Ring of Aiming","Midan Ring of Casting","Midan Ring of Fending","Midan Ring of Healing","Midan Ring of Slaying","Midnight Egg Ring","Mirage Ring","Mistbreak Ring of Aiming","Mistbreak Ring of Casting","Mistbreak Ring of Fending","Mistbreak Ring of Healing","Mistbreak Ring of Slaying","Mistfall Ring of Aiming","Mistfall Ring of Casting","Mistfall Ring of Fending","Mistfall Ring of Healing","Mistfall Ring of Slaying","Mistic Memory Ring of Aiming","Mistic Memory Ring of Casting","Mistic Memory Ring of Fending","Mistic Memory Ring of Healing","Mistic Memory Ring of Slaying","Mistwake Ring of Aiming","Mistwake Ring of Casting","Mistwake Ring of Fending","Mistwake Ring of Healing","Mistwake Ring of Slaying","Moonward Ring of Aiming","Moonward Ring of Casting","Moonward Ring of Fending","Moonward Ring of Healing","Moonward Ring of Slaying","Mormorion Ring of Aiming","Mormorion Ring of Casting","Mormorion Ring of Fending","Mormorion Ring of Healing","Mormorion Ring of Slaying","Muudhorn Ring of Aiming","Muudhorn Ring of Casting","Muudhorn Ring of Fending","Muudhorn Ring of Healing","Muudhorn Ring of Slaying","Mythril Ring","Mythril Ring of Crafting","Nabaath Leather Ring of Aiming","Nabaath Leather Ring of Casting","Nabaath Leather Ring of Fending","Nabaath Leather Ring of Healing","Nabaath Leather Ring of Slaying","Nald'thal's Ring","Natural Afflatus Ring","Neo Kingdom Ring of Aiming","Neo Kingdom Ring of Casting","Neo Kingdom Ring of Fending","Neo Kingdom Ring of Healing","Neo Kingdom Ring of Slaying","Neo-Ishgardian Ring of Aiming","Neo-Ishgardian Ring of Casting","Neo-Ishgardian Ring of Fending","Neo-Ishgardian Ring of Healing","Neo-Ishgardian Ring of Slaying","Neophyte's Ring","Noct Ring","Nomad's Ring of Aiming","Nomad's Ring of Casting","Nomad's Ring of Fending","Nomad's Ring of Healing","Nomad's Ring of Slaying","Nophica's Ring","Nymeia's Ring","Occult Ring of Blood","Occult Ring of Deep Blood","Occult Ring of Deep Magic","Occult Ring of Magic","Omega Ring of Aiming","Omega Ring of Casting","Omega Ring of Fending","Omega Ring of Healing","Omega Ring of Slaying","Omicron Ring of Aiming","Omicron Ring of Casting","Omicron Ring of Fending","Omicron Ring of Healing","Omicron Ring of Slaying","Opal Ring of Aiming","Opal Ring of Casting","Opal Ring of Fending","Opal Ring of Healing","Opal Ring of Slaying","Ophiotauroskin Ring of Gathering","Origenics Ring of Aiming","Origenics Ring of Casting","Origenics Ring of Fending","Origenics Ring of Healing","Origenics Ring of Slaying","Orthodox Ring of Aiming","Orthodox Ring of Casting","Orthodox Ring of Fending","Orthodox Ring of Healing","Orthodox Ring of Slaying","Oschon's Ring","Paglth'an Ring of Aiming","Paglth'an Ring of Casting","Paglth'an Ring of Fending","Paglth'an Ring of Healing","Paglth'an Ring of Slaying","Paissa Ring","Palaka Ring of Aiming","Palaka Ring of Casting","Palaka Ring of Fending","Palaka Ring of Healing","Palaka Ring of Slaying","Palladium Band of Aiming","Palladium Band of Casting","Palladium Band of Fending","Palladium Band of Healing","Palladium Band of Slaying","Palladium Ring of Aiming","Palladium Ring of Casting","Palladium Ring of Fending","Palladium Ring of Healing","Palladium Ring of Slaying","Panegyrist's Ring","Pearl Ring","Peltast Ring","Peridot Ring","Persimmon Ring","Petalite Ring of Aiming","Petalite Ring of Casting","Petalite Ring of Fending","Petalite Ring of Healing","Petalite Ring of Slaying","Pewter Ring of Aiming","Pewter Ring of Casting","Pewter Ring of Fending","Pewter Ring of Healing","Pewter Ring of Slaying","Phantasmal Sardine Ring","Picaroon's Ring of Slaying","Pink Beryl Ring of Aiming","Pink Beryl Ring of Casting","Pink Beryl Ring of Fending","Pink Beryl Ring of Healing","Pink Beryl Ring of Slaying","Plague Bringer's Ring","Plague Doctor's Ring","Platinum Lone Wolf Ring","Platinum Pack Wolf Ring","Platinum Ring of Aiming","Platinum Ring of Casting","Platinum Ring of Fending","Platinum Ring of Healing","Platinum Ring of Slaying","Praemagitek Ring of Aiming","Praemagitek Ring of Casting","Praemagitek Ring of Fending","Praemagitek Ring of Healing","Praemagitek Ring of Slaying","Primal Ring of Aiming","Primal Ring of Casting","Primal Ring of Fending","Primal Ring of Healing","Primal Ring of Slaying","Pristine Egg Ring","Prophet's Ring","Proto Ultima Ring of Aiming","Proto Ultima Ring of Casting","Proto Ultima Ring of Fending","Proto Ultima Ring of Healing","Proto Ultima Ring of Slaying","Prototype Alexandrian Ring of Aiming","Prototype Alexandrian Ring of Casting","Prototype Alexandrian Ring of Fending","Prototype Alexandrian Ring of Healing","Prototype Alexandrian Ring of Slaying","Prototype Gordian Ring of Aiming","Prototype Gordian Ring of Casting","Prototype Gordian Ring of Fending","Prototype Gordian Ring of Healing","Prototype Gordian Ring of Slaying","Prototype Midan Ring of Aiming","Prototype Midan Ring of Casting","Prototype Midan Ring of Fending","Prototype Midan Ring of Healing","Prototype Midan Ring of Slaying","Pugilist's Ring","Purgatory Ring of Aiming","Purgatory Ring of Casting","Purgatory Ring of Fending","Purgatory Ring of Healing","Purgatory Ring of Slaying","Quetzalli Ring of Aiming","Quetzalli Ring of Casting","Quetzalli Ring of Fending","Quetzalli Ring of Healing","Quetzalli Ring of Slaying","Ra'Kaznar Ring of Gathering","Radiant's Ring of Aiming","Radiant's Ring of Casting","Radiant's Ring of Fending","Radiant's Ring of Healing","Radiant's Ring of Slaying","Rakshasa Ring of Aiming","Rakshasa Ring of Casting","Rakshasa Ring of Fending","Rakshasa Ring of Healing","Rakshasa Ring of Slaying","Raptorskin Ring","Ravel Keeper's Ring of Aiming","Ravel Keeper's Ring of Casting","Ravel Keeper's Ring of Fending","Ravel Keeper's Ring of Healing","Ravel Keeper's Ring of Slaying","Red Coral Ring","Resilient Ring of Aiming","Resilient Ring of Casting","Resilient Ring of Fending","Resilient Ring of Healing","Resilient Ring of Slaying","Rhalgr's Ring","Rinascita Ring of Aiming","Rinascita Ring of Casting","Rinascita Ring of Fending","Rinascita Ring of Healing","Rinascita Ring of Slaying","Ring of Divine Death","Ring of Divine Wisdom","Ring of Fidelity","Ring of Fortitude","Ring of Fortune","Ring of Freedom","Ring of Lasting Shelter","Ring of the Daring Duelist","Ring of the Defiant Duelist","Ring of the Divine Harvest","Ring of the Divine Light","Ring of the Divine War","Ring of the First Light","Ring of the Lost Thief","Ring of the Sea-folk","Riversbreath Ring of Aiming","Riversbreath Ring of Casting","Riversbreath Ring of Fending","Riversbreath Ring of Healing","Riversbreath Ring of Slaying","Rogue's Ring","Ronkan Ring of Aiming","Ronkan Ring of Casting","Ronkan Ring of Fending","Ronkan Ring of Healing","Ronkan Ring of Slaying","Rose Gold Ring","Royal Volunteer's Ring of Aiming","Royal Volunteer's Ring of Casting","Royal Volunteer's Ring of Fending","Royal Volunteer's Ring of Healing","Royal Volunteer's Ring of Slaying","Rubellite Ring","Ruby Ring","Ruby Tide Ring of Aiming","Ruby Tide Ring of Casting","Ruby Tide Ring of Fending","Ruby Tide Ring of Healing","Ruby Tide Ring of Slaying","Ryumyaku Ring of Aiming","Ryumyaku Ring of Casting","Ryumyaku Ring of Fending","Ryumyaku Ring of Healing","Ryumyaku Ring of Slaying","Sapphire Ring","Scaevan Ring of Aiming","Scaevan Ring of Casting","Scaevan Ring of Fending","Scaevan Ring of Healing","Scaevan Ring of Slaying","Scintillant Ring of Aiming","Scintillant Ring of Casting","Scintillant Ring of Fending","Scintillant Ring of Healing","Scintillant Ring of Slaying","Serpent Private's Ring","Serpent Sergeant's Ring","Serpentbringer's Ring","Serpentcarrier's Ring","Shadowless Ring of Aiming","Shadowless Ring of Casting","Shadowless Ring of Fending","Shadowless Ring of Healing","Shadowless Ring of Slaying","Sharlayan Conservator's Ring","Sharlayan Custodian's Ring","Sharlayan Pankratiast's Ring","Sharlayan Philosopher's Ring","Sharlayan Preceptor's Ring","Shire Conservator's Ring","Shire Custodian's Ring","Shire Pankratiast's Ring","Shire Philosopher's Ring","Shire Preceptor's Ring","Silver Lone Wolf Ring","Silver Pack Wolf Ring","Silver Ring","Silver Ring of Crafting","Silvergrace Ring of Aiming","Silvergrace Ring of Casting","Silvergrace Ring of Fending","Silvergrace Ring of Healing","Silvergrace Ring of Slaying","Skallic Ring of Aiming","Skallic Ring of Casting","Skallic Ring of Fending","Skallic Ring of Healing","Skallic Ring of Slaying","Skydeep Ring of Aiming","Skydeep Ring of Casting","Skydeep Ring of Fending","Skydeep Ring of Healing","Skydeep Ring of Slaying","Slothskin Ring of Gathering","Smilodonskin Ring","Sphene Ring","Spinel Ring","Star Quartz Ring of Aiming","Star Quartz Ring of Casting","Star Quartz Ring of Fending","Star Quartz Ring of Healing","Star Quartz Ring of Slaying","Star Spinel Ring of Aiming","Star Spinel Ring of Casting","Star Spinel Ring of Fending","Star Spinel Ring of Healing","Star Spinel Ring of Slaying","Star Tech Ring of Crafting","Star Tech Ring of Gathering","Stonewall Ring","Storm Private's Ring","Storm Sergeant's Ring","Stormbringer's Ring","Stormcarrier's Ring","Strategos Ring","Sunburst Ring of Aiming","Sunburst Ring of Casting","Sunburst Ring of Fending","Sunburst Ring of Healing","Sunburst Ring of Slaying","Sunstone Ring","Sunstreak Ring of Aiming","Sunstreak Ring of Casting","Sunstreak Ring of Fending","Sunstreak Ring of Healing","Sunstreak Ring of Slaying","Thaliak's Ring","Thaumaturge's Ring","The Emperor's New Ring","The Forgiven's Ring of Aiming","The Forgiven's Ring of Casting","The Forgiven's Ring of Fending","The Forgiven's Ring of Healing","The Forgiven's Ring of Slaying","The Last Ring of Aiming","The Last Ring of Casting","The Last Ring of Fending","The Last Ring of Healing","The Last Ring of Slaying","The Twelve's Ring of Aiming","The Twelve's Ring of Casting","The Twelve's Ring of Fending","The Twelve's Ring of Healing","The Twelve's Ring of Slaying","Tipping Scales Ring","Toadskin Ring","Topaz Ring","Tourmaline Ring","Toxotes Ring","Triphane Ring of Aiming","Triphane Ring of Casting","Triphane Ring of Fending","Triphane Ring of Healing","Triphane Ring of Slaying","Triplite Ring of Aiming","Triplite Ring of Casting","Triplite Ring of Fending","Triplite Ring of Healing","Triplite Ring of Slaying","Troian Ring of Aiming","Troian Ring of Casting","Troian Ring of Fending","Troian Ring of Healing","Troian Ring of Slaying","Turquoise Ring","Ul'dahn Ring","Ultima Band of Aiming","Ultima Band of Casting","Ultima Band of Fending","Ultima Band of Healing","Ultima Band of Slaying","Underkeep Ring of Aiming","Underkeep Ring of Casting","Underkeep Ring of Fending","Underkeep Ring of Healing","Underkeep Ring of Slaying","Valerian Archer's Ring","Valerian Brawler's Ring","Valerian Dark Priest's Ring","Valerian Fusilier's Ring","Valerian Priest's Ring","Valerian Shaman's Ring","Valerian Smuggler's Ring","Valerian Terror Knight's Ring","Valerian Wizard's Ring","Valkyrie's Ring of Aiming","Valkyrie's Ring of Casting","Valkyrie's Ring of Fending","Valkyrie's Ring of Healing","Valkyrie's Ring of Slaying","Vanguard Ring of Aiming","Vanguard Ring of Casting","Vanguard Ring of Fending","Vanguard Ring of Healing","Vanguard Ring of Slaying","Varlet's Ring","Vibrant Egg Ring","Viking Ring","Voeburtite Ring of Aiming","Voeburtite Ring of Casting","Voeburtite Ring of Fending","Voeburtite Ring of Healing","Voeburtite Ring of Slaying","Voidmoon Ring of Aiming","Voidmoon Ring of Casting","Voidmoon Ring of Fending","Voidmoon Ring of Healing","Voidmoon Ring of Slaying","Vortex Ring of Aiming","Vortex Ring of Casting","Vortex Ring of Fending","Vortex Ring of Healing","Vortex Ring of Slaying","Warg Ring of Aiming","Warg Ring of Casting","Warg Ring of Fending","Warg Ring of Healing","Warg Ring of Slaying","Warwolf Ring of Aiming","Warwolf Ring of Casting","Warwolf Ring of Fending","Warwolf Ring of Healing","Warwolf Ring of Slaying","Weathered Auroral Ring","Weathered Daystar Ring","Weathered Evenstar Ring","Weathered Gloam Ring","Weathered Noct Ring","Weathered Ring","Werewolf Ring of Aiming","Werewolf Ring of Casting","Werewolf Ring of Fending","Werewolf Ring of Healing","Werewolf Ring of Slaying","Whalaqee Ring","White Ash Ring","White Gold Ring of Aiming","White Gold Ring of Casting","White Gold Ring of Fending","White Gold Ring of Healing","White Gold Ring of Slaying","White Oak Ring","Woad Skydruid's Ring","Woad Skyhunter's Ring","Woad Skyraider's Ring","Woad Skywarrior's Ring","Woad Skywicce's Ring","Wolf Amber Ring","Wolf Rubellite Ring","Wolf Spinel Ring","Wolf Tourmaline Ring","Wolf Turquoise Ring","Wolf Zircon Ring","Wrangler's Ring","Wyvernskin Ring","Xenobian Paladin's Ring","Yama Ring of Aiming","Yama Ring of Casting","Yama Ring of Fending","Yama Ring of Healing","Yama Ring of Slaying","Yanxian Ring of Aiming","Yanxian Ring of Casting","Yanxian Ring of Fending","Yanxian Ring of Healing","Yanxian Ring of Slaying","Yasha Ring of Aiming","Yasha Ring of Casting","Yasha Ring of Fending","Yasha Ring of Healing","Yasha Ring of Slaying","Yeti Fang Ring of Aiming","Yeti Fang Ring of Casting","Yeti Fang Ring of Fending","Yeti Fang Ring of Healing","Yeti Fang Ring of Slaying","Yuweyawata Ring of Aiming","Yuweyawata Ring of Casting","Yuweyawata Ring of Fending","Yuweyawata Ring of Healing","Yuweyawata Ring of Slaying","Zelkova Ring","Zircon Ring","Zormor Ring of Aiming","Zormor Ring of Casting","Zormor Ring of Fending","Zormor Ring of Healing","Zormor Ring of Slaying"])});
  // END GENERATED EC SEARCH CATEGORIES

  // /accessories has an unscoped text search in addition to four slot selects.
  // The union must still contain only official accessory EquipSlotCategory rows.
  const EC_ALL_ACCESSORY_NATIVES = new Set(
    Object.values(EC_ACCESSORY_SLOT_NATIVES).flatMap(slotNames => [...slotNames])
  );


  const SEARCH_EXCLUDE_RE = /author|player|title|comment|tag|username|email|password|作者|标题|标签|用户/i;
  const SEARCH_INPUT_TYPES = new Set(['', 'text', 'search']);
  const _searchInputCache = new WeakMap();

  function normalizeSearchQuery(value) {
    return String(value ?? '').trim().replace(/[ \t\u00a0]+/g, ' ');
  }

  // 只有装备库列表页的查询可以按“套装系列 + 职能”映射。其它 EC 页面
  // （如 /glamours、装备部位 vue-select）继续使用单件装备索引。
  function isECGearsetsPage() {
    const loc = globalThis.location;
    // 除 /gearsets 外，职业子目录（如 /gearsets/casters）同样是可检索的套装列表。
    return /^\/gearsets(?:\/[a-z-]+)?\/?$/i.test(loc?.pathname || '')
      && /(^|\.)eorzeacollection\.com$/i.test(loc?.hostname || '');
  }

  function ecSlotFromHint(hint) {
    const patterns = [
      /\b(?:head|headpiece|headwear|headgear|helmet)\b|头部|头饰|头盔/iu,
      /\b(?:body|bodypiece|chest|chestpiece)\b|身体|躯干|上衣/iu,
      /\b(?:hands?|handpiece|gloves?)\b|手部|手套/iu,
      /\b(?:legs?|legpiece|pants|trousers)\b|腿部|裤子/iu,
      /\b(?:feet|foot|footpiece|boots?|shoes?)\b|脚部|足部|靴子/iu,
    ];
    const matches = patterns.flatMap((pattern, index) => pattern.test(hint) ? [index] : []);
    return matches.length === 1 ? matches[0] : null;
  }

  // Accessory selectors share the same EC Vue input component but use four
  // distinct official EquipSlotCategory IDs, not the five armor slot groups.
  function ecAccessorySlotFromHint(hint) {
    const patterns = [
      ['ears', /\b(?:ears?|earrings?|earpieces?)\b|耳饰|耳环|耳部/iu],
      ['neck', /\b(?:necks?|necklaces?|neckpieces?|chokers?)\b|项链|项圈|颈部/iu],
      ['wrists', /\b(?:wrists?|bracelets?|bangles?|wristpieces?)\b|腕部|手镯|腕饰/iu],
      ['rings', /\b(?:rings?|fingers?|fingerpieces?)\b|戒指|指环|手指/iu],
    ];
    const matches = patterns.filter(([, pattern]) => pattern.test(hint));
    return matches.length === 1 ? matches[0][0] : null;
  }

  function ecSlotFromInput(input, resolveHint = ecSlotFromHint) {
    const hint = [
      input?.getAttribute?.('placeholder'),
      input?.getAttribute?.('aria-label'),
      input?.getAttribute?.('data-slot'),
      input?.getAttribute?.('name'),
      input?.closest?.('[data-slot]')?.getAttribute?.('data-slot'),
    ].filter(Boolean).join(' ');
    const explicit = resolveHint(hint);
    if (explicit !== null) return explicit;
    // EC occasionally supplies only a generic placeholder. Read the nearest
    // compact field label, never a full form containing multiple slot names.
    let node = input?.parentElement;
    for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
      const label = String(node.textContent || '').trim();
      if (label.length > 0 && label.length < 50) {
        const slot = resolveHint(label);
        if (slot !== null) return slot;
      }
    }
    return null;
  }

  // EC intelligent inputs are scoped by page purpose or explicit equipment slot.
  // The specialty lists come from official ItemAction and Glasses game data.
  function ecSearchContext(input) {
    const loc = globalThis.location;
    if (!/(^|\.)eorzeacollection\.com$/i.test(loc?.hostname || '')) return null;
    const path = loc?.pathname || '';
    if (/^\/companion-glamours(?:\/|$)/i.test(path)) return { kind: 'barding' };
    if (/^\/facewear(?:\/|$)/i.test(path)) return { kind: 'facewear' };
    // Gearsets free-text search is intentionally separate from equipment filtering.
    // The /accessories catalogue also has free-text inputs without a slot label:
    // those must use the union of official jewelry slots, never all gear.
    const accessoryPage = /^\/accessories(?:\/|$)/i.test(path);
    if (!/\bvs__search\b/.test(String(input?.className || ''))) {
      return accessoryPage ? { kind: 'accessories' } : null;
    }
    const slot = ecSlotFromInput(input);
    if (slot !== null) return { kind: 'slot', slot };
    const accessory = ecSlotFromInput(input, ecAccessorySlotFromHint);
    if (accessory !== null) return { kind: 'accessory-slot', slot: accessory };
    return accessoryPage ? { kind: 'accessories' } : null;
  }

  function ecScopedSuggestions(query, input) {
    const context = ecSearchContext(input);
    if (context?.kind === 'facewear') return EC_FACEWEAR_ROWS.filter(row => row.zh.includes(query));
    if (context?.kind === 'barding') return suggestByZh(query, 0, EC_BARDING_NATIVES);
    if (context?.kind === 'slot') return suggestByZh(query, 0, context.slot);
    if (context?.kind === 'accessory-slot') {
      return suggestByZh(query, 0, EC_ACCESSORY_SLOT_NATIVES[context.slot]);
    }
    if (context?.kind === 'accessories') return suggestByZh(query, 0, EC_ALL_ACCESSORY_NATIVES);
    return isECGearsetsPage() && !/\bvs__search\b/.test(String(input?.className || ''))
      ? suggestECGearsetsByZh(query) : suggestByZh(query);
  }

  // Only an exact or a single unambiguous in-category name can be converted
  // without choosing the explicit suggestion.
  function ecScopedNative(query, input, allowPartial) {
    const rows = ecScopedSuggestions(query, input);
    const exact = rows.filter(row => row.zh === query);
    if (exact.length === 1) return exact[0].native;
    return allowPartial && rows.length === 1 ? rows[0].native : null;
  }

  function resolveSearchNative(query, gearsets = false) {
    if (gearsets) {
      const gearset = resolveECGearsetSearch(query);
      if (gearset) return gearset;
      // 多个套装命中却没有安全的英文公共词时，交给候选列表选择；
      // 不能回退到无关的单件物品索引，随意改写用户的套装查询。
      if (suggestECGearsetsByZh(query).length > 0) return null;
    }
    return resolveByZh(query) || resolvePartialByZh(query);
  }

  function isChineseSearchQuery(value) {
    const q = normalizeSearchQuery(value);
    return q.length > 0 && /[\u3400-\u9fff]/u.test(q);
  }

  // EC /gearsets 的检索由站点 GET 参数 search 驱动。Vue/动态过滤器不保证在
  // input 事件时同步读取被临时改写的值；因此只在明确提交时用站点原生 URL 查询。
  // 仅识别 Gearsets 主搜索框，不接管筛选部位、职业或其他页面的输入框。
  function isECGearsetsSearchInput(input) {
    if (!isECGearsetsPage() || String(input?.tagName || '').toUpperCase() !== 'INPUT'
        || input.disabled || input.readOnly) return false;
    if (/vs__search/.test(String(input.className || ''))) return false;
    const meta = [input.getAttribute?.('name'), input.getAttribute?.('id'),
      input.getAttribute?.('placeholder'), input.getAttribute?.('aria-label')]
      .filter(Boolean).join(' ');
    if (/search by (title|player)|author|username|creator|filter by|作者|玩家|标题|標題/i.test(meta)) return false;
    // translateECAttrs 会将 "Search..." 翻译为 "搜索…"，识别不能只依赖英文占位符。
    return /\b(search|keyword)\b/i.test(meta) || /搜索|搜尋|检索|檢索/.test(meta);
  }

  function ecGearsetsSearchUrl(native, href) {
    if (!native) return null;
    try {
      const url = new URL(href);
      url.searchParams.set('search', native);
      url.searchParams.delete('page'); // 换关键词后必须回到第一页，否则会误报无结果。
      return url.toString();
    } catch { return null; }
  }

  function submitECGearsetsSearch(input, selectedNative = null) {
    if (!isECGearsetsSearchInput(input)) return false;
    const query = normalizeSearchQuery(input.value);
    if (!isChineseSearchQuery(query)) return false;
    const native = selectedNative || resolveECGearsetSearch(query);
    if (!native) return false; // 多个不相关套装不猜测英文词，继续由候选明确选择。
    const url = ecGearsetsSearchUrl(native, globalThis.location?.href);
    if (!url || typeof globalThis.location?.assign !== 'function') return false;
    globalThis.location.assign(url);
    return true;
  }

  function searchInputScore(input) {
    if (!input) return -Infinity;
    const type = String(input.getAttribute?.('type') || '').toLowerCase();
    if (!SEARCH_INPUT_TYPES.has(type) || input.disabled || input.readOnly) return -Infinity;
    // 1.4.2 后续修复：vue-select 搜索框（EC 部位筛选器）不是表单搜索框——
    // 其值不参与表单序列化，输入即触发站点检索；完全排除，交给独立搜索框路径处理。
    if (/vs__search/.test(String(input.className || ''))) return -Infinity;
    const meta = [
      input.getAttribute?.('name'),
      input.getAttribute?.('id'),
      input.getAttribute?.('placeholder'),
      input.getAttribute?.('aria-label'),
      input.getAttribute?.('title'),
    ].filter(Boolean).join(' ');
    if (SEARCH_EXCLUDE_RE.test(meta)) return -1000;
    let score = 0;
    if (/装備名(?:の一部)?を入力して検索|装備名.*検索|検索.*装備名/u.test(meta)) score += 120;
    if (/keyword/i.test(meta)) score += 100;
    if (/search/i.test(meta)) score += 80;
    // EC 主搜索框在正式汉化后占位符变成「搜索」，name/id 均可能为空。
    // 提交表单时必须为该输入框赋予与英文 Search 相同的识别优先级。
    if (/搜索|搜尋|检索|檢索/u.test(meta)) score += 80;
    if (/query|(^|[-_])q([-_]|$)/i.test(meta)) score += 70;
    if (/关键词|关键字|キーワード|検索|装備品|装備|검색|장비|키워드/u.test(meta)) score += 70;
    if (input.getAttribute?.('placeholder')) score += 5;
    return score;
  }

  function findSearchInput(form) {
    if (!form?.querySelectorAll) return null;
    const cached = _searchInputCache.get(form);
    if (cached && cached.isConnected !== false
        && (!form.contains || form.contains(cached))) {
      return cached;
    }

    const candidates = [...form.querySelectorAll('input')];
    let best = null;
    let bestScore = -Infinity;
    for (const input of candidates) {
      const score = searchInputScore(input);
      if (score > bestScore) {
        best = input;
        bestScore = score;
      }
    }

    let result = null;
    if (bestScore >= 5) result = best;
    else {
      const usable = candidates.filter((input) => searchInputScore(input) > -Infinity);
      result = usable.length === 1 ? usable[0] : null;
    }
    if (result) _searchInputCache.set(form, result);
    return result;
  }

  function buildSearchUrl(action, entries, inputName, native, baseHref) {
    if (!inputName || !native) return null;
    let url;
    try {
      url = new URL(action || baseHref, baseHref);
    } catch {
      return null;
    }

    const grouped = new Map();
    for (const [key, value] of entries || []) {
      // 1.4.2 后续修复：空值参数不得进入搜索 URL —— mirapri 实测（2026-10-07）：
      // 空筛选参数（cl/j/r/t/c/fav 等）会被站方当作「生效的无效筛选」→ 搜索恒为 0 结果；
      // 剔除空值后 ?keyword=X 正常返回（25 条/页），有效筛选（如 j=15）保留后亦正常。
      if (!key || typeof value !== 'string' || value === '') continue;
      const values = grouped.get(key) || [];
      values.push(value);
      grouped.set(key, values);
    }

    for (const key of grouped.keys()) url.searchParams.delete(key);
    for (const [key, values] of grouped) {
      for (const value of values) url.searchParams.append(key, value);
    }
    url.searchParams.delete(inputName);
    url.searchParams.set(inputName, native);
    return url.toString();
  }

  function formEntries(form) {
    try {
      const fd = new FormData(form);
      return [...fd.entries()];
    } catch {
      return null;
    }
  }

  function rewriteInputTemporarily(input, native) {
    const previous = input.value;
    input.value = native;
    setTimeout(() => {
      if (!input.isConnected) return;
      if (input.value === native) input.value = previous;
    }, 0);
  }


  const SUGGEST_MIN_CHARS = 2;
  // 候选列表可视行数：数据全量渲染（显示所有含输入字的装备），
  // 列表高度限 8 行，超出的通过滚轮在列表内滑动翻看。
  const SUGGEST_VISIBLE_ROWS = 8;
  const SUGGEST_ROW_HEIGHT = 44;   // 触摸目标不少于 44px，与 CSS 对齐
  const SUGGEST_RENDER_BATCH = 80;  // 首批至多 80 行，滚动接近底部时渐进追加
  const SUGGEST_DEBOUNCE_MS = 70;
  const SUGGEST_HIDE_DELAY_MS = 120;

  let _suggestBox = null;
  let _suggestInput = null;
  let _suggestRows = [];
  let _suggestRendered = 0;
  let _suggestActive = -1;
  let _suggestTimer = null;
  let _suggestHideTimer = null;
  let _suggestStyleReady = false;
  let _suggestDataReady = false;
  const _composingInputs = new WeakSet();
  const _convertedInputs = new WeakMap();
  const _programmaticInputs = new WeakSet();
  const _selectedSearchRows = new WeakMap();

  function isSearchInput(input) {
    const form = input?.form;
    if (!form) return false;
    const cached = _searchInputCache.get(form);
    if (cached && cached !== input) _searchInputCache.delete(form);
    return findSearchInput(form) === input;
  }

  // 1.4.2 后续修复（b 方案）：可挂候选面板的输入框 = 表单搜索框 + 独立搜索框
  // （ronka / collection 无 form 站，以及 EC vue-select 部位筛选器）。
  // 输入停顿一律不自动转换；仅候选面板点选（转换式搜索）与表单提交（临时替换）时转换。
  function isSuggestibleInput(input) {
    if (isSearchInput(input)) return true;
    return isStandaloneSearchInput(input);
  }

  function isSuggestionQuery(value) {
    const query = normalizeSearchQuery(value);
    return query.length >= SUGGEST_MIN_CHARS && /[\u3400-\u9fff]/u.test(query);
  }

  function ensureSuggestionStyle() {
    if (_suggestStyleReady || typeof document === 'undefined') return;
    const host = document.head || document.documentElement;
    if (!host?.appendChild || !document.createElement) return;
    const style = document.createElement('style');
    style.textContent = [
      '[data-zhx-chinese-suggest]{position:fixed;display:block;box-sizing:border-box;overflow:auto;margin:0;padding:4px;background:#fff;border:1px solid rgba(0,0,0,.16);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.18);z-index:2147483647;font:14px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
      '[data-zhx-chinese-suggest][hidden]{display:none;}',
      '[data-zhx-chinese-suggest] button{display:flex;align-items:center;justify-content:space-between;box-sizing:border-box;width:100%;min-height:44px;margin:0;padding:10px 10px;border:0;border-radius:6px;background:transparent;color:#222;text-align:left;cursor:pointer;}',
      '[data-zhx-chinese-suggest] button:hover,[data-zhx-chinese-suggest] button[data-active="1"]{background:#f0f2f5;}',
      '[data-zhx-chinese-suggest] .zhx-suggest-zh{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '[data-zhx-chinese-suggest] .zhx-suggest-native{margin-left:12px;overflow:hidden;color:#777;font-size:12px;text-overflow:ellipsis;white-space:nowrap;}',
      '[data-zhx-chinese-suggest] .zhx-suggest-empty{box-sizing:border-box;min-height:40px;padding:10px;color:#777;text-align:center;}',
    ].join('');
    host.appendChild(style);
    _suggestStyleReady = true;
  }

  function positionSuggestionBox(input) {
    if (!_suggestBox || _suggestBox.hidden || !input?.getBoundingClientRect) return;
    const rect = input.getBoundingClientRect();
    const gap = 4;
    const margin = 8;
    // 手机软键盘会缩小 visualViewport，但不一定同步更新 innerHeight。
    const view = globalThis.visualViewport;
    const viewportWidth = Number(view?.width) || Number(globalThis.innerWidth) || document.documentElement?.clientWidth || 0;
    const viewportHeight = Number(view?.height) || Number(globalThis.innerHeight) || document.documentElement?.clientHeight || 0;
    const viewLeft = Number(view?.offsetLeft) || 0;
    const viewTop = Number(view?.offsetTop) || 0;
    const roomWidth = Math.max(0, viewportWidth - margin * 2);
    const width = Math.min(Math.max(rect.width, 180), roomWidth);
    const left = Math.min(Math.max(viewLeft + margin, rect.left), viewLeft + Math.max(margin, viewportWidth - width - margin));
    const belowSpace = Math.max(0, viewTop + viewportHeight - rect.bottom - gap - margin);
    const aboveSpace = Math.max(0, rect.top - viewTop - gap - margin);
    const openBelow = belowSpace >= SUGGEST_ROW_HEIGHT * 2 || belowSpace >= aboveSpace;
    const available = openBelow ? belowSpace : aboveSpace;
    const rowsHeight = SUGGEST_VISIBLE_ROWS * SUGGEST_ROW_HEIGHT + 8;
    const maxHeight = Math.max(0, Math.min(rowsHeight, available));
    const top = openBelow ? rect.bottom + gap : Math.max(viewTop + margin, rect.top - gap - maxHeight);
    _suggestBox.style.left = left + 'px';
    _suggestBox.style.top = top + 'px';
    _suggestBox.style.width = width + 'px';
    _suggestBox.style.maxHeight = maxHeight + 'px';
  }

  // 滚动/缩放时保持候选框（1.4.2 后续修复）：输入框仍在视口内 → 跟随重定位（保持打开）；
  // 已滚出视口 → 关闭。滚动本身不再直接关闭候选框（无滚动条的候选框、滚到列表边界后
  // 继续滚动会链式带动页面滚动——这些场景都不应让候选框消失）。
  function syncSuggestionsOnScroll() {
    if (!_suggestBox || _suggestBox.hidden) return;
    const input = _suggestInput;
    if (!input || input.isConnected === false) {
      hideSuggestions(true);
      return;
    }
    const rect = input.getBoundingClientRect?.();
    if (!rect) {
      hideSuggestions(true);
      return;
    }
    const view = globalThis.visualViewport;
    const width = Number(view?.width) || Number(globalThis.innerWidth) || document.documentElement?.clientWidth || 0;
    const height = Number(view?.height) || Number(globalThis.innerHeight) || document.documentElement?.clientHeight || 0;
    const left = Number(view?.offsetLeft) || 0;
    const top = Number(view?.offsetTop) || 0;
    const onScreen = rect.bottom > top && rect.top < top + height && rect.right > left && rect.left < left + width;
    if (!onScreen) {
      hideSuggestions(true);
      return;
    }
    positionSuggestionBox(input);
  }

  function hideSuggestions(clearInputState = false) {
    if (_suggestTimer) {
      clearTimeout(_suggestTimer);
      _suggestTimer = null;
    }
    if (_suggestHideTimer) {
      clearTimeout(_suggestHideTimer);
      _suggestHideTimer = null;
    }
    if (_suggestBox) _suggestBox.hidden = true;
    if (_suggestInput) {
      _suggestInput.setAttribute('aria-expanded', 'false');
      if (clearInputState) _suggestInput.removeAttribute('aria-activedescendant');
    }
    _suggestRows = [];
    _suggestRendered = 0;
    _suggestActive = -1;
  }

  function scheduleSuggestions(input) {
    if (_suggestTimer) clearTimeout(_suggestTimer);
    _suggestTimer = setTimeout(() => {
      _suggestTimer = null;
      showSuggestions(input);
    }, SUGGEST_DEBOUNCE_MS);
  }

  function selectSuggestion(index) {
    const row = _suggestRows[index];
    if (!row || !_suggestInput) return;
    const input = _suggestInput;
    input.focus({ preventScroll: true });
    input.value = row.zh;
    _selectedSearchRows.set(input, row);
    hideSuggestions(true);
    try {
      input.setSelectionRange(input.value.length, input.value.length);
    } catch {
      /* 输入类型变化时忽略光标定位失败 */
    }
    // 独立搜索框（React 站点，b 方案）：选中候选后做「转换式搜索」——
    // 用原生名触发站内检索，随后输入框显示恢复为中文。
    // 两类控件遵循相同选择语义：选择候选就执行一次站内搜索。
    // EC Gearsets 候选点击必须使用原站 GET 检索，不能仅派发 input 事件；
    // 站点的动态组件可能在事件后重新写入中文，导致结果恒为空。
    if (submitECGearsetsSearch(input, row.native)) return;
    // 原站表单必须经过 requestSubmit（触发现有校验及捕获监听），不能调用 form.submit()。
    if (isStandaloneSearchInput(input)) convertStandaloneForSearch(input, false, row.native);
    else if (isSearchInput(input) && typeof input.form?.requestSubmit === 'function') {
      input.form.requestSubmit();
    }
  }

  // 保留完整候选数组，但只渲染小批量 DOM；触底和键盘导航时按需追加。
  function appendSuggestionBatch() {
    if (!_suggestBox || !_suggestRows.length) return;
    const end = Math.min(_suggestRows.length, _suggestRendered + SUGGEST_RENDER_BATCH);
    for (let index = _suggestRendered; index < end; index++) {
      const row = _suggestRows[index];
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'zhx-chinese-suggest-' + index;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', 'false');
      button.dataset.zhxIndex = String(index);
      const zh = document.createElement('span');
      zh.className = 'zhx-suggest-zh';
      zh.textContent = row.zh;
      const native = document.createElement('span');
      native.className = 'zhx-suggest-native';
      native.textContent = row.native + (row.provisional ? ' · EC 结果待确认' : '');
      button.append(zh, native);
      _suggestBox.appendChild(button);
    }
    _suggestRendered = end;
  }

  function updateSuggestionActive(index) {
    if (!_suggestBox) return;
    _suggestActive = index;
    while (index >= _suggestRendered && _suggestRendered < _suggestRows.length) appendSuggestionBatch();
    const buttons = _suggestBox.querySelectorAll('button[data-zhx-index]');
    for (const button of buttons) {
      const active = Number(button.dataset.zhxIndex) === index;
      button.dataset.active = active ? '1' : '0';
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    }
    const activeButton = buttons[index];
    if (activeButton) {
      activeButton.scrollIntoView({ block: 'nearest' });
      if (activeButton.id) _suggestInput?.setAttribute('aria-activedescendant', activeButton.id);
    } else {
      _suggestInput?.removeAttribute('aria-activedescendant');
    }
  }

  function showSuggestions(input) {
    if (!isSuggestibleInput(input) || !input.isConnected) {
      hideSuggestions(true);
      return;
    }
    const query = normalizeSearchQuery(input.value);
    // 在数据尚未就绪时也要记住当前输入框，数据 ready 回调才能补显示候选。
    _suggestInput = input;
    if (!isSuggestionQuery(query)) {
      hideSuggestions(true);
      return;
    }
    // Gearsets 候选只依赖已加载的本地套装目录/词典，不必等待 V3 物品表；
    // 否则 V3 网络超时会让整个套装检索也无法使用。
    // Facewear's dedicated, bundled Glasses sheet works even without remote V3.
    // Bardings / equipment slots still require the classified V3 item index.
    if (!_suggestDataReady && !isECGearsetsPage() && ecSearchContext(input)?.kind !== 'facewear') {
      hideSuggestions(true);
      return;
    }

    const rows = ecScopedSuggestions(query, input);

    ensureSuggestionStyle();
    if (!_suggestBox) {
      _suggestBox = document.createElement('div');
      _suggestBox.id = 'zhx-chinese-suggest-list';
      _suggestBox.dataset.zhxChineseSuggest = '';
      _suggestBox.setAttribute('role', 'listbox');
      (document.body || document.documentElement)?.appendChild(_suggestBox);
    }
    if (!_suggestBox) return;

    _suggestInput = input;
    _suggestRows = rows;
    _suggestRendered = 0;
    _suggestActive = -1;
    _suggestBox.replaceChildren();

    if (!rows.length) {
      const message = document.createElement('div');
      message.className = 'zhx-suggest-empty';
      message.textContent = isECGearsetsPage() ? '未找到对应套装' : '未找到对应装备';
      message.setAttribute('role', 'status');
      _suggestBox.setAttribute('role', 'status');
      _suggestBox.appendChild(message);
      input.setAttribute('aria-expanded', 'true');
      input.setAttribute('aria-controls', _suggestBox.id);
      _suggestBox.hidden = false;
      positionSuggestionBox(input);
      return;
    }

    _suggestBox.setAttribute('role', 'listbox');
    appendSuggestionBatch();

    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-haspopup', 'listbox');
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-controls', _suggestBox.id);
    _suggestBox.hidden = false;
    positionSuggestionBox(input);
  }

  function handleSearchInput(event) {
    const input = event.target;
    if (!_programmaticInputs.has(input)) {
      _convertedInputs.delete(input);
      _selectedSearchRows.delete(input);
    }
    if (isSearchInput(input)) {
      if (_composingInputs.has(input)) return;
      scheduleSuggestions(input);
      return;
    }
    // 独立搜索框（无 form）：由 handleStandaloneSearchInput 调度（候选 + 自动转换），此处不清候选。
    if (isStandaloneSearchInput(input)) return;
    if (_suggestInput === input) hideSuggestions(true);
  }

  function handleSearchFocus(event) {
    const input = event.target;
    if (!isSuggestibleInput(input) || _composingInputs.has(input)) return;
    scheduleSuggestions(input);
  }

  function handleSearchBlur(event) {
    if (_suggestInput !== event.target) return;
    if (_suggestHideTimer) clearTimeout(_suggestHideTimer);
    const blurred = event.target;
    _suggestHideTimer = setTimeout(() => {
      _suggestHideTimer = null;
      // 1.4.2 后续修复：延迟内焦点可能已移到另一个搜索框（表单框 ↔ 独立框切换），
      // 仅当 _suggestInput 仍是被失焦的框时才隐藏，避免误藏新框的候选面板。
      if (_suggestInput === blurred) hideSuggestions(true);
    }, SUGGEST_HIDE_DELAY_MS);
  }

  function handleSuggestionKeydown(event) {
    if (_suggestInput !== event.target || !_suggestBox || _suggestBox.hidden || !_suggestRows.length) return false;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      updateSuggestionActive((_suggestActive + 1) % _suggestRows.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      updateSuggestionActive((_suggestActive + _suggestRows.length - 1) % _suggestRows.length);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      hideSuggestions(true);
    } else if (event.key === 'Enter' && _suggestActive >= 0) {
      event.preventDefault();
      event.stopPropagation();
      selectSuggestion(_suggestActive);
    } else return false;
    return true;
  }

  function handleSearchKeydown(event) {
    const input = event.target;
    if (event.isComposing || _composingInputs.has(input) || event.keyCode === 229) return;
    if (handleSuggestionKeydown(event)) return;
    // Gearsets 的 search GET 参数是网站的查询入口；按回车时立即导航，
    // 而不是向可能有异步状态的前端组件派发临时原生名 input。
    if (event.key === 'Enter' && submitECGearsetsSearch(input)) {
      event.preventDefault();
      event.stopPropagation();
      hideSuggestions(true);
      return;
    }
    // 其他站点显式搜索保留原站回车事件。
    if (event.key === 'Enter' && isStandaloneSearchInput(input) && convertStandaloneForSearch(input, true)) hideSuggestions(true);
  }

  function handleSuggestionPointerDown(event) {
    const button = event.target?.closest?.('button[data-zhx-index]');
    if (!button || !_suggestBox?.contains(button)) return;
    event.preventDefault();
    selectSuggestion(Number(button.dataset.zhxIndex));
  }

  function handleCompositionStart(event) {
    const input = event.target;
    if (isSuggestibleInput(input)) {
      _composingInputs.add(input);
      if (_suggestInput === input) hideSuggestions(true);
    }
  }

  function handleCompositionEnd(event) {
    const input = event.target;
    if (!isSuggestibleInput(input)) return;
    _composingInputs.delete(input);
    scheduleSuggestions(input);
  }

  // ── 独立搜索框（1.4.2 后续修复；b 方案）──
  // ronka 等站点的搜索框不属于任何 form（React 客户端过滤、无提交事件可拦）；
  // b 方案：打字期间不做任何自动转换；候选面板点选后做「转换式搜索」
  //（用原生名触发站内检索，随后输入框显示恢复为中文，见 convertStandaloneForSearch）。
  const STANDALONE_SEARCH_HINT_RE = /검색어|키워드|キーワード|搜索|搜尋|検索|search|关键词|關鍵詞|keyword/i;
  const STANDALONE_EXCLUDE_TYPES = new Set(['hidden', 'password', 'email', 'tel', 'url', 'number', 'date', 'datetime-local', 'month', 'week', 'time', 'color', 'range', 'file', 'checkbox', 'radio', 'button', 'submit', 'reset', 'image']);

  function isStandaloneSearchInput(input) {
    if (!input) return false;
    if (String(input.tagName || '').toUpperCase() !== 'INPUT') return false;
    const type = String(input.getAttribute?.('type') || '').toLowerCase();
    if (STANDALONE_EXCLUDE_TYPES.has(type)) return false;
    if (input.disabled || input.readOnly) return false;
    // 1.4.2 后续修复：vue-select 搜索输入框（EC 部位筛选器，如 "Any head"）——
    // 不依赖 form 归属：输入即触发站点装备检索（EC 实测 POST /gear/<slot>/search）；
    // b 方案后与独立搜索框统一：打字不转换，候选面板点选时做「转换式搜索」。
    if (/vs__search/.test(String(input.className || ''))) {
      return SEARCH_SITES[_activeSearchSiteId]?.vueSelect === true;
    }
    if (input.form) return false;
    const meta = [
      input.getAttribute?.('placeholder'),
      input.getAttribute?.('aria-label'),
      input.getAttribute?.('name'),
      input.getAttribute?.('id'),
      input.getAttribute?.('title'),
    ].filter(Boolean).join(' ');
    const field = [input.getAttribute?.('name'), input.getAttribute?.('id')].filter(Boolean).join(' ');
    if (SEARCH_EXCLUDE_RE.test(field) || /search by title|作者|用户名|评论|タイトル|プレイヤー|작성자/i.test(meta)) return false;
    return STANDALONE_SEARCH_HINT_RE.test(meta);
  }

  function rewriteInputNatively(input, native) {
    let applied = false;
    try {
      const descriptor = typeof HTMLInputElement !== 'undefined' && HTMLInputElement.prototype
        ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
        : null;
      if (descriptor?.set) {
        descriptor.set.call(input, native);
        applied = input.value === native;
      }
    } catch { /* 回退：直接赋值 */ }
    if (!applied) {
      try {
        input.value = native;
        applied = input.value === native;
      } catch { /* 忽略 */ }
    }
    if (!applied) return false;
    _programmaticInputs.add(input);
    try {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } catch { /* 事件派发失败不影响替换结果 */ }
    finally { _programmaticInputs.delete(input); }
    return true;
  }

  // b 方案（2026-10-08）：点选候选后的「转换式搜索」——用原生名触发站点检索（派发 input），
  // 随后把输入框显示恢复为中文（静默设值，不再派发事件；若站点已改写则不动）。
  function convertStandaloneForSearch(input, allowPartial = false, selectedNative = null) {
    try {
      if (!input || input.isConnected === false || _composingInputs.has(input)) return false;
      const shown = input.value;
      const query = normalizeSearchQuery(shown);
      if (query.length < 2 || !isChineseSearchQuery(query)) return false;
      const context = ecSearchContext(input);
      const native = selectedNative
        || (context ? ecScopedNative(query, input, allowPartial) : null)
        || (!context && isECGearsetsPage() ? resolveECGearsetSearch(query) : null)
        || (!context ? resolveByZh(query) : null)
        || (!context && allowPartial ? resolvePartialByZh(query) : null);
      if (!native || native === query) return false;
      if (!rewriteInputNatively(input, native)) return false;
      restoreStandaloneDisplay(input, shown, native);
      return true;
    } catch { return false; /* 转换失败时保留站点原有搜索行为 */ }
  }

  function restoreStandaloneDisplay(input, shown, native) {
    const token = {};
    _convertedInputs.set(input, token);
    // React 结果加载期间可能再次回写受控值；有限次恢复显示，用户继续输入即取消。
    for (const delay of [0, 100, 500, 1500, 3000]) {
      setTimeout(() => {
        if (_convertedInputs.get(input) !== token || input.isConnected === false) return;
        if (input.value === native) setInputValueSilently(input, shown);
        if (delay === 3000) _convertedInputs.delete(input);
      }, delay);
    }
  }

  // 从搜索按钮所在的最小容器查找独立搜索框，避免影响其他字段或候选按钮。
  function findStandaloneTriggerInput(button) {
    let root = button.parentElement || button.parentNode;
    for (let depth = 0; root && depth < 8; depth++, root = root.parentElement || root.parentNode) {
      if (root === document.body || root === document.documentElement) return null;
      const inputs = [...(root.querySelectorAll?.('input') || [])].filter(isStandaloneSearchInput);
      if (_suggestInput && inputs.includes(_suggestInput)) return _suggestInput;
      if (inputs.length === 1) return inputs[0];
      if (inputs.length > 1 || root === document.body) return null;
    }
    return null;
  }

  function handleStandaloneSearchClick(event) {
    const button = event.target?.closest?.('button, input[type="submit"], [role="button"]');
    if (!button || button.disabled || _suggestBox?.contains(button)) return;
    const label = [button.textContent, button.getAttribute?.('title'), button.getAttribute?.('aria-label'), button.value]
      .filter(Boolean).join(' ').trim();
    if (/clear|reset|取消|重置|清空|初期化|초기화|지우기/i.test(label)) return;
    if (!/搜索|搜尋|查询|查找|검색|検索|\bsearch\b|필터\s*적용|应用筛选|適用|\bapply\b/i.test(label)) return;
    const input = findStandaloneTriggerInput(button);
    if (input && submitECGearsetsSearch(input)) {
      event.preventDefault();
      event.stopPropagation();
      hideSuggestions(true);
      return;
    }
    if (input && convertStandaloneForSearch(input, true)) hideSuggestions(true);
  }

  // 静默设值：更新输入框显示，但不派发 input 事件（避免二次触发站点检索）。
  function setInputValueSilently(input, value) {
    try {
      const descriptor = typeof HTMLInputElement !== 'undefined' && HTMLInputElement.prototype
        ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
        : null;
      if (descriptor?.set) {
        descriptor.set.call(input, value);
        if (input.value === value) return true;
      }
    } catch { /* 回退：直接赋值 */ }
    try {
      input.value = value;
      return input.value === value;
    } catch {
      return false;
    }
  }

  function handleStandaloneSearchInput(event) {
    const input = event.target;
    if (isSearchInput(input)) return;
    if (isStandaloneSearchInput(input)) {
      // b 方案（2026-10-08）：输入停顿不自动转换（禁止输入即搜索）；仅候选面板点选时转换。
      // 1.4.2 后续修复：独立搜索框也显示智能候选面板（ronka / collection / EC vue-select）。
      if (isSuggestibleInput(input)) scheduleSuggestions(input);
    }
  }

  function bindChineseSearchUi() {
    document.addEventListener('input', handleSearchInput, true);
    document.addEventListener('input', handleStandaloneSearchInput, true);
    document.addEventListener('focusin', handleSearchFocus, true);
    document.addEventListener('focusout', handleSearchBlur, true);
    document.addEventListener('keydown', handleSearchKeydown, true);
    document.addEventListener('compositionstart', handleCompositionStart, true);
    document.addEventListener('compositionend', handleCompositionEnd, true);
    document.addEventListener('pointerdown', handleSuggestionPointerDown, true);
    document.addEventListener('click', handleStandaloneSearchClick, true);
    document.addEventListener('scroll', (event) => {
      // 列表自身滚动（滚轮翻看全部装备）无需处理；页面滚动只做同步——
      // 输入框仍在视口内则保持打开并跟随重定位，已滚出视口才关闭。
      if (_suggestBox && event.target && _suggestBox.contains(event.target)) {
        if (event.target === _suggestBox && !_suggestBox.hidden
            && _suggestBox.scrollTop + _suggestBox.clientHeight >= _suggestBox.scrollHeight - SUGGEST_ROW_HEIGHT * 2) {
          appendSuggestionBatch();
        }
        return;
      }
      syncSuggestionsOnScroll();
    }, true);
    globalThis.addEventListener?.('resize', () => syncSuggestionsOnScroll());
    globalThis.visualViewport?.addEventListener?.('resize', () => syncSuggestionsOnScroll());
    globalThis.visualViewport?.addEventListener?.('scroll', () => syncSuggestionsOnScroll());
  }

  // EC Gearsets 原生路由提交单独处理，避免与其它站点的 GET/POST 表单分支
  // 交叉嵌套；成功时消费事件，失败时由既有站点提交链处理。
  function handleECGearsetsFormSubmit(event, siteId, input, query, selected) {
    if (siteId !== 'ec') return false;
    const native = selected?.zh === query ? selected.native : null;
    if (!submitECGearsetsSearch(input, native)) return false;
    _selectedSearchRows.delete(input);
    event.preventDefault();
    event.stopPropagation();
    hideSuggestions(true);
    return true;
  }

  function nativeForSubmittedSearch(query, siteId, input, selected) {
    if (selected?.zh === query && selected.native) return selected.native;
    if (siteId === 'ec' && ecSearchContext(input)) return ecScopedNative(query, input, true);
    return resolveSearchNative(query, siteId === 'ec' && isECGearsetsPage());
  }

  function handleChineseSearchSubmit(event, siteId) {
    if (!SEARCH_SITES[siteId]) return;
    const form = event.target;
    _searchInputCache.delete(form);
    const input = findSearchInput(form);
    if (!input) return;

    const query = normalizeSearchQuery(input.value);
    if (!isChineseSearchQuery(query)) return;

    const selected = _selectedSearchRows.get(input);
    if (handleECGearsetsFormSubmit(event, siteId, input, query, selected)) return;
    const native = nativeForSubmittedSearch(query, siteId, input, selected);
    _selectedSearchRows.delete(input);
    // 套装页优先系列/职能片段映射；其余站点仍以物品总表 + 公共子串兜底。
    if (!native || native === query) return;

    const method = String(form.getAttribute?.('method') || 'get').toLowerCase();
    if (method === 'get' && input.name) {
      const entries = formEntries(form);
      const action = form.getAttribute?.('action') || globalThis.location?.href || '';
      const baseHref = globalThis.location?.href || action;
      const url = entries ? buildSearchUrl(action, entries, input.name, native, baseHref) : null;
      if (url) {
        event.preventDefault();
        event.stopPropagation();
        globalThis.location.assign(url);
        return;
      }
    }

    // 非 GET / 无 name 的搜索表单：只临时替换提交值，不改页面显示，不派发 input 事件。
    rewriteInputTemporarily(input, native);
  }

  function startChineseSearch(siteId) {
    if (!SEARCH_SITES[siteId]) return;
    _activeSearchSiteId = siteId;
    if (typeof document === 'undefined' || !document.addEventListener) return;
    if (globalThis.__zhxChineseSearchBound) return;
    globalThis.__zhxChineseSearchBound = true;
    bindChineseSearchUi();
    onTablesReady(() => {
      _suggestDataReady = true;
      if (_suggestInput?.isConnected && isSuggestionQuery(_suggestInput.value)) showSuggestions(_suggestInput);
    });
    document.addEventListener('submit', (event) => {
      try {
        handleChineseSearchSubmit(event, siteId);
      } catch (error) {
        console.warn('[zhx] 中文装备搜索失败', error);
      }
    }, true);
  }

  /* @phase15-module-order:sites/endcloset */
  /* @phase15-order-link:sites/endcloset<-core/http */

  /* ===================================================================== */
  /* =====================================================================
   * end-closet.com（End Closet，韩服 FF14 幻化站）— 全站汉化 + 道具跳转
   * 站点为 React SPA（Vite + Firebase）。装备名原生三语 name:{ko,en,ja}，
   * UI 语言 localStorage.language 可切（ko/en/ja）。
   * 汉化策略：
   *   1. UI 词（韩/英/日）→ 中文：DICT_ENDCLOSET
   *   2. 装备名（韩/英/日）→ 国服中文名：物品总表 nameMap 索引（resolveByName）
   *   3. 装备名文本节点打 data-zhx-item 标记 → 点击跳灰机 wiki
   *   4. 中文搜索：搜索框输入中文 → 自动转韩文/英文（startChineseSearch）
   * ===================================================================== */

  const EC_SKIP_SEL = 'script, style, noscript, textarea, .zhx-skip, #zhx-chinese-suggest-list';
  const EC_KR = /[\uac00-\ud7a3]/;
  const EC_EN_WORD = /[A-Za-z]{2,}/;
  const EC_JA = /[\u3040-\u30ff]/;
  // 装备名识别辅助：韩文装备名通常较长且包含 FF14 特征词；UI 词短。
  // 用「DICT 未命中 + resolveByName 命中」判定装备名。

  // 逐条翻译：UI 词典 → 装备名映射 → 空白归一化
  function _trEndClosetDye(t0) {
    // End Closet 染剂名可能带数字前缀（类似 ronka 的 "N-色名"）
    const m = t0.match(/^([1-9])-(.+)$/);
    if (!m) return null;
    const s = DICT_ENDCLOSET[m[2].trim()];
    if (!s) return null;
    return m[1] + '-' + s;
  }

  function _trEndClosetItem(t0) {
    // 装备名映射：韩/英/日 → 中文（物品总表 nameMap）
    const zh = resolveByName(t0);
    return zh || null;
  }

  function trEndClosetCount(text) {
    const count = text.match(/^(\d[\d,]*)\s*(개 선택됨|개 아이템|개 투영세트|items|glamour sets)$/);
    if (count) return count[1] + ({ '개 선택됨': ' 项已选择', '개 아이템': ' 件装备', 'items': ' 件装备' }[count[2]] || ' 套幻化');
    const english = text.match(/^Showing\s+([\d,]+)\s+of\s+([\d,]+)\s+items?$/i);
    if (english) return '显示 ' + english[1] + ' / 共 ' + english[2] + ' 件装备';
    const glamourId = text.match(/^Glamour Set\s+([a-zA-Z0-9_-]{8,40})$/);
    if (glamourId) return '幻化套装 ' + glamourId[1];
    const author = text.match(/^작성자\s*:\s*(.{1,80})$/);
    if (author) return '作者：' + author[1];
    const total = text.match(/^총\s+([\d,]+)개의\s+(투영 세트|아이템)\s+중\s+([\d,]+)개\s+표시$/);
    if (total) return '共 ' + total[1] + (total[2] === '아이템' ? ' 件装备，显示 ' : ' 套幻化，显示 ') + total[3] + ' 项';
    return null;
  }

  function trEndCloset(text) {
    if (!text) return text;
    const t0 = text.trim();
    if (!t0) return text;
    const exact = DICT_ENDCLOSET[t0];
    if (t0.length > 120 && !exact) return text;
    const hasForeign = EC_KR.test(t0) || EC_EN_WORD.test(t0) || EC_JA.test(t0);
    if (!hasForeign) return text;
    let zh = exact || null;
    if (zh == null) zh = trEndClosetCount(t0);
    if (zh == null) zh = _trEndClosetDye(t0);
    if (zh == null) zh = _trEndClosetItem(t0);
    if (zh == null) {
      const norm = t0.replace(/[ \t\u00a0]+/g, ' ');
      if (norm !== t0) zh = DICT_ENDCLOSET[norm] || _trEndClosetItem(norm) || null;
    }
    if (zh == null || zh === t0) return text;
    const i = text.indexOf(t0);
    return text.slice(0, i) + zh + text.slice(i + t0.length);
  }

  // 装备名点击跳灰机 wiki：文本节点翻译后，若为装备名（resolveByName 命中），
  // 给父元素打 data-zhx-item 标记。React 重渲染后韩文重现会再次命中。
  function markEndClosetItem(node, translated) {
    if (!translated || translated.length > 50) return;
    const p = node.parentElement;
    if (!p) return;
    if (p.dataset.zhxItem === translated) return;
    p.dataset.zhxItem = translated;
    p.setAttribute('title', '点击查看灰机 wiki 物品页');
  }

  function _ecAcceptNode(n) {
    if (n.nodeType === 1) {
      if (SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
      if (n.closest?.(EC_SKIP_SEL)) return NodeFilter.FILTER_REJECT;
    }
    return NodeFilter.FILTER_ACCEPT;
  }

  function _ecInput(n) {
    const ph = n.getAttribute('placeholder');
    if (ph) { const nn = trEndCloset(ph); if (nn !== ph) n.setAttribute('placeholder', nn); }
  }

  function _ecImgAlt(n) {
    const alt = n.getAttribute('alt');
    if (alt) {
      const nn = trEndCloset(alt);
      if (nn !== alt) n.setAttribute('alt', nn);
    }
    const ti = n.getAttribute('title');
    if (ti) { const nn = trEndCloset(ti); if (nn !== ti) n.setAttribute('title', nn); }
  }

  function _ecAria(n) {
    const al = n.getAttribute('aria-label');
    if (!al) return;
    // "primary" is a landmark name only on <nav>, not a generic UI label.
    const nn = n.tagName === 'NAV' && al === 'primary' ? '主导航' : trEndCloset(al);
    if (nn !== al) n.setAttribute('aria-label', nn);
  }

  function _ecProcNode(n) {
    if (n.nodeType === 3) {
      const raw = n.nodeValue;
      if (!raw?.trim()) return;
      const p = n.parentElement;
      if (p?.closest?.(EC_SKIP_SEL)) return;
      const next = trEndCloset(raw);
      if (next !== raw) {
        n.nodeValue = next;
        const itemZh = _trEndClosetItem(raw.trim());
        if (itemZh) markEndClosetItem(n, itemZh);
      }
      return;
    }
    if (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA') _ecInput(n);
    // title/alt/aria 不只存在于图片，按钮和普通元素也需要处理。
    _ecImgAlt(n);
    _ecAria(n);
  }

  function translateEndClosetPage(rootArg) {
    if (rootArg?.nodeType === 3) {
      _ecProcNode(rootArg);
      return;
    }
    const root = rootArg || document.body || document.documentElement;
    if (!root) return;
    if (root.nodeType === 1) {
      if (root.tagName === 'TEXTAREA') { _ecProcNode(root); return; }
      if (_ecAcceptNode(root) === NodeFilter.FILTER_REJECT) return;
      _ecProcNode(root);
    }
    _markScan(localScope(rootArg));   // v1.4.1：扫描计数（区分全页/局部）
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: _ecAcceptNode,
    });
    const batch = [];
    while (w.nextNode()) batch.push(w.currentNode);
    for (const n of batch) _ecProcNode(n);
    // 文本域内容属于用户输入，仍跳过；单独处理被跳过元素上的界面属性。
    for (const n of root.querySelectorAll?.('textarea') || []) _ecProcNode(n);
  }

  function translateEndClosetTitle() {
    const t = document.title;
    if (!t) return;
    // Detail-page titles contain gear names. Translate only verified terms and
    // the fixed site suffix; keep unmapped item names rather than guessing.
    let nt = trEndCloset(t);
    if (nt === t && t.includes('FF14 글래머 투영')) {
      nt = t.replace('FF14 글래머 투영', 'FF14 幻化投影');
    }
    if (nt && nt !== t && nt.length <= 160) document.title = nt;
  }

  function startEndCloset() {
    ensureZhxItemStyle('zhx-endcloset-item-style');
    bindZhxItemClick('__zhxEndClosetItemBound');
    safe(translateEndClosetPage, 'EndCloset 全扫')();
    safe(translateEndClosetTitle, 'EndCloset 标题')();
    // React SPA：childList + characterData（三语文本节点更新频繁）
    createObserver({
      root: document.documentElement,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'alt', 'aria-label'],
      filter: (m) => {
        const text = m.type === 'attributes' ? m.target?.getAttribute(m.attributeName) : m.target?.nodeValue;
        return !!text && (EC_KR.test(text) || EC_EN_WORD.test(text) || EC_JA.test(text));
      },
      debounce: 120,
      handler: (nodes, cds = []) => {
        for (const n of [...nodes, ...cds]) safe(translateEndClosetPage, 'EndCloset 局部')(n);
        safe(translateEndClosetTitle, 'EndCloset 标题')();
      },
    });
    // 中文搜索（独立框自动转换：输入中文 → 韩文/英文）
    startChineseSearch('endcloset');
    console.log('End Closet（韩服幻化站）汉化已启用');
  }

  /* @phase15-module-order:core/site-registry */
  /* @phase15-order-link:core/site-registry<-core/http */


    /* @zhixia:site-registry-start */
    /* ── Site Registry（v1.4 Phase 3）：六站唯一配置源 ─────────────────────
       一处维护：新增站点 = 本表加一条（并同步 userscript @match 头）；为某站
       新增索引 = 站内 indexes 加一项；调整所需数据表 = 站内 tables。hosts 用
       onHost 精确匹配（含子域）；boot = 页面加载即启动；pageshow = bfcache
       恢复补跑（各函数幂等，safe 包裹）。Phase 15 模块化构建时，本区段将
       原样抽出为 src/core/site-registry.js。 */
    // 域名精确匹配（含子域）：evilmirapri.com 不匹配、www.mirapri.com 匹配
    // （安全加固：原 endsWith('mirapri.com') 会被任意前缀域名绕过——CodeQL js/incomplete-url-substring-sanitization）
    const onHost = (h, d) => h === d || h.endsWith('.' + d);

    // 统一站点适配器工厂（v1.4 Phase 9）：六站标准接口——
    //   id / hosts / tables / indexes   配置面（Phase 3 约定）
    //   start()        页面加载即启动（原 boot 的站点入口）
    //   processRoot()  统一处理入口（root 缺省 = 全页；元素 = 局部）
    //   onDataReady()  数据就绪补扫（外置版；由 boot 统一登记到 onTablesReady）
    //   onPageShow()   bfcache 恢复补跑（原 pageshow）
    //   destroy()      预留：站点销毁（现状站点均常驻，无实现）
    // 站点实现（startXxx / translateXxx）仍居各自区段，后续渐进迁移；
    // Phase 15 模块化构建时，各 adapter 将随区段原样抽出为 src/sites/*.js。
    function createSiteAdapter(cfg) {
      const c = cfg || {};
      return {
        id: c.id,
        hosts: c.hosts || [],
        tables: c.tables || [],
        indexes: c.indexes || [],
        boot() {
          // Phase 18：适配器入口错误边界——单站启动失败不影响脚本其余部分（其余站点/兜底/探测照常）
          if (typeof c.start === 'function') { try { c.start(); } catch (e) { _zhxErr('boot:' + (c.id || 'site'), e); } }
          if (DATA_REMOTE && typeof c.onDataReady === 'function') {
            onTablesReady(() => { try { c.onDataReady(); } catch (e) { _zhxErr('dataReady:' + (c.id || 'site'), e); } });
          }
        },
        pageshow() {
          if (typeof c.onPageShow === 'function') { try { c.onPageShow(); } catch (e) { _zhxErr('pageshow:' + (c.id || 'site'), e); } }
        },
        processRoot: typeof c.processRoot === 'function' ? c.processRoot : () => {},
        destroy: typeof c.destroy === 'function' ? c.destroy : () => {},
      };
    }

    const SITE_REGISTRY = [
      // ── 站点拆分顺序（计划书 9.2）：① ronka ② ec ③ mirapri ④ fc ⑤ collection ⑥ wiki ──
      // （注册顺序 = 匹配优先级，保持 Phase 3 金标准不变）
      createSiteAdapter({
        id: 'mirapri', hosts: ['mirapri.com'], tables: ['items', 'dict'], indexes: ['nameMap', 'itemHash'],
        start() { startMirapri(); startItems(); },
        processRoot(root) { safe(translatePage, 'mirapri 处理')(root); },
        onPageShow() { safe(translatePage, 'pageshow')(); safe(applyItemZh, 'pageshow')(); },
      }),
      createSiteAdapter({
        id: 'ec', hosts: ['eorzeacollection.com'], tables: ['items', 'dict'], indexes: ['nameMap', 'itemHash'],
        start() { startEC(); startItems(); },
        processRoot(root) { safe(translateECPage, 'EC 处理')(root); safe(applyItemZh, 'EC 物品处理')(); },
        onDataReady() {
          safe(translateECPage, 'EC 补扫')();
          // 自动推导的套装名要等 V3 nameMap 加载，浏览器标题也需在此时补翻译。
          safe(translateECTitle, 'EC 数据就绪页面标题')();
        },
        onPageShow() {
          safe(translateECPage, 'pageshow')();
          safe(translateECTitle, 'EC pageshow 标题')();
          safe(bindECPieceTiles, 'pageshow')();
          safe(applyItemZh, 'pageshow')();
        },
      }),
      createSiteAdapter({
        id: 'wiki', hosts: ['huijiwiki.com'], tables: ['items', 'dict'], indexes: ['ecidMap', 'koByZh'],
        start() { startWiki(); },
        onDataReady() { safe(injectWikiButton, 'Wiki 反查刷新')(); },
        onPageShow() { safe(injectWikiButton, 'pageshow')(); },
      }),
      createSiteAdapter({
        id: 'fc', hosts: ['ff14-fc.com'], tables: ['items', 'series', 'dict'], indexes: ['nameMap', 'itemHash'],
        start() { startFC(); },
        processRoot(root) { safe(translateFCPage, 'FC 处理')(root); },
        onDataReady() { safe(translateFCPage, 'FC 补扫')(); safe(translateFCTitle, 'FC 标题')(); safe(fixFCMenu, 'FC 菜单')(); safe(bindFCBanners, 'FC 横幅')(); },
        onPageShow() { safe(translateFCPage, 'pageshow')(); },
      }),
      createSiteAdapter({
        id: 'ronka', hosts: ['ronkacloset.com'], tables: ['items', 'dict'], indexes: ['nameMap'],
        start() { startRonka(); },
        processRoot(root) { safe(translateRonkaPage, 'Ronka 处理')(root); },
        onDataReady() { safe(translateRonkaPage, 'Ronka 补扫')(); safe(translateRonkaTitle, 'Ronka 标题')(); },
        onPageShow() { safe(translateRonkaPage, 'pageshow')(); safe(translateRonkaTitle, 'pageshow')(); },
      }),
      createSiteAdapter({
        id: 'collection', hosts: ['ffxivcollection.com'], tables: ['items', 'series', 'acl', 'dict'], indexes: ['nameMap'],
        start() { startACL(); },
        processRoot(root) { safe(translateACLPage, 'ACL 处理')(root); },
        onDataReady() { safe(translateACLPage, 'ACL 补扫')(); safe(translateACLTitle, 'ACL 标题')(); },
        onPageShow() { safe(translateACLPage, 'pageshow')(); },
      }),
      createSiteAdapter({
        id: 'endcloset', hosts: ['end-closet.com'], tables: ['items', 'dict'], indexes: ['nameMap'],
        start() { startEndCloset(); },
        processRoot(root) { safe(translateEndClosetPage, 'EndCloset 处理')(root); },
        onDataReady() { safe(translateEndClosetPage, 'EndCloset 补扫')(); safe(translateEndClosetTitle, 'EndCloset 标题')(); },
        onPageShow() { safe(translateEndClosetPage, 'pageshow')(); safe(translateEndClosetTitle, 'pageshow')(); },
      }),
    ];

    // 测试钩子：__zhxTestSite 指定站点 id（file:// 集成测试用；生产不存在，零开销）
    function findSite() {
      if (window.__zhxTestSite) { for (const s of SITE_REGISTRY) { if (s.id === window.__zhxTestSite) return s; } }
      const h = location.hostname;
      for (const s of SITE_REGISTRY) {
        for (const d of s.hosts) { if (onHost(h, d)) return s; }
      }
      return null;
    }

    // 索引依据全库调用链核查——nameMap：各站文本翻译共用；itemHash：lookupZh
    // （EC/mirapri 装备链接）与 fcLinkZhName（FC）；ecidMap/koByZh：仅 wiki
    // 反查块（EC/韩服链接）。未知站点返回 null（全建，保守）。
    function neededTables() {
      if (window.__zhxTestTables) return window.__zhxTestTables;
      const s = findSite();
      return s ? s.tables : [];
    }

    function _siteIndexes() {
      if (window.__zhxTestIndexes) return window.__zhxTestIndexes;
      const s = findSite();
      return s ? s.indexes : null;
    }
    /* @zhixia:site-registry-end */

  /* @phase15-module-order:core/translator */
  /* @phase15-order-link:core/translator<-core/site-registry */


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

  /* @phase15-module-order:core/observer */
  /* @phase15-order-link:core/observer<-core/translator */


    /* @zhixia:core-observer-start */
    /* ── Core Observer（v1.4 Phase 7）：统一 MutationObserver 调度层——pending 队列 /
         debounce 计时 / 洪峰保护 / 祖先去重（dedupeByAncestor）/ childList 与可选
         characterData（按站点显式开启，禁止无条件开启）。所有站点的观察器都经由
         createObserver（或兼容包装 observeLocal）创建。Phase 15 模块化构建时，
         本区段将原样抽出为 src/core/observer.js。 */

    // 统一观察器工厂。
    // opts: {
    //   handler(nodes, cds)  必填——批次处理器（nodes = 去重后的新增节点；cds = characterData 变更目标，未开启时为空；signal 型站点可忽略）
    //   debounce = 350       debounce 毫秒（站点独立）
    //   characterData false  是否纳入 characterData 变更（仅确需的站点开启，如 Ronka）
    //   filter = null        characterData 逐条过滤器：(mutation) => boolean
    //   floodLimit = 800     pending 洪峰阈值：超阈值时重置计时器，待洪峰平息再处理
    //   root = null          观察根（默认 document.body || document.documentElement）
    // }
    // 返回 { disconnect } 便于站点销毁（现状站点均为常驻，保留扩展位）。
    // 观察统计（v1.4 Phase 10：Probe 读取——整数自增，无行为影响）
    const _obsStats = { ticks: 0, nodes: 0, ms: 0, maxMs: 0 };   // Phase 19：ms/maxMs = 回调处理时长累计/峰值（mutation processing）
    function createObserver(opts) {
      const o = opts || {};
      const debounce = o.debounce || 350;
      const floodLimit = o.floodLimit || 800;
      const root = o.root || document.body || document.documentElement;
      let timer = null;
      let pending = [];
      let pendingCD = [];              // v1.4.1：characterData 变更目标（与 pending 分列；nodes 语义不变）
      // v1.4.1：变更目标入队（独立函数——为 collectMuts 控制认知复杂度预算）
      const _queueCD = (t) => { if (t) pendingCD.push(t); };
      const _queueAttribute = (mutation) => {
        if (o.filter && !o.filter(mutation)) return;
        if (mutation.target) pending.push(mutation.target);
      };
      const _collectCharacterData = (mutation) => {
        if (!o.characterData || (o.filter && !o.filter(mutation))) return false;
        _queueCD(mutation.target);
        return true;
      };
      // mutation 明细收集拆为局部函数（仅降复杂度；判定与产物不变）
      const collectMuts = (muts) => {
        let hitCD = false;
        for (const m of muts) {
          if (m.type === 'characterData') {
            hitCD = _collectCharacterData(m) || hitCD;
            continue;
          }
          if (m.type === 'attributes') {
            _queueAttribute(m);
            continue;
          }
          for (const n of m.addedNodes) {
            if (n.nodeType === 1 || n.nodeType === 3) pending.push(n);
          }
        }
        return hitCD;
      };
      const mo = new MutationObserver((muts) => {
        const hitCD = collectMuts(muts);
        const flood = pending.length > floodLimit;          // 洪峰保护：避免 pending 无限增长
        if (flood && timer) { clearTimeout(timer); timer = null; }
        if (timer || (!pending.length && !hitCD)) return;
        timer = setTimeout(() => {
          timer = null;
          const nodes = dedupeByAncestor(pending);
          const cdTargets = dedupeByAncestor(pendingCD);        // v1.4.1：变更目标（去重后）随批次传出
          pending = [];
          pendingCD = [];
          _obsStats.ticks++; _obsStats.nodes += nodes.length;   // Phase 10：Probe 统计
          const t0 = _perfNow();                                // Phase 19：处理时长统计
          try { o.handler(nodes, cdTargets); } catch (e) { _zhxErr('createObserver', e); }
          const dt = _perfNow() - t0;
          _obsStats.ms += dt;
          if (dt > _obsStats.maxMs) _obsStats.maxMs = dt;
        }, debounce);
      });
      const subscription = { childList: true, subtree: true };
      if (o.characterData) subscription.characterData = true;
      if (o.attributes) {
        subscription.attributes = true;
        if (o.attributeFilter) subscription.attributeFilter = o.attributeFilter;
      }
      mo.observe(root, subscription);
      return { disconnect: () => mo.disconnect() };
    }

    // 兼容包装：既有站点的局部观察器（handler 收新增节点批次；delay 为 debounce）
    function observeLocal(handler, delay) {
      return createObserver({ handler, debounce: delay || 350 });
    }
    /* @zhixia:core-observer-end */

  /* @phase15-module-order:core/targets */
  /* @phase15-order-link:core/targets<-core/observer */


    /* @zhixia:core-targets-start */
    /* ── Core Targets（v1.4 Phase 8）：统一 DOM Target Pipeline——
       采集（collectTargets）→ 分派（dispatchTargets）→ 处理（processRoot）。
       root 缺省 = 全页（document 范围）；传元素 = 局部（Mutation 新增子树）：
       两条路径经同一采集 / 判定逻辑，行为与旧版逐项一致（golden 冻结）。
       Phase 15 模块化构建时原样抽出为 src/core/targets.js。 */

    // 统一采集：root 内（含自身）按类型收集候选，输出标准 target：
    //   { type, element, text, context }
    // type：item / plain-item / card / dye（EC 物品链；其他站按需扩展）
    // 全页（root 缺省）：仅 document.querySelectorAll；
    // 局部（root 为元素）：先 matches 自身、再子树，与旧 *In 版逐字一致。
    function collectTargets(root) {
      const local = root != null;
      const scope = local ? root : document;
      const list = [];
      if (local && !scope.querySelectorAll) return list;   // 局部根非元素：无目标
      const scan = (sel) => {
        const cands = [];
        if (local && scope.matches?.(sel)) cands.push(scope);
        scope.querySelectorAll(sel).forEach((el) => cands.push(el));
        return cands;
      };

      // 四类采集拆为局部函数（仅降复杂度；判定、顺序与产物逐字不变）
      const pushItems = () => {
        // item：装备链接（两站均用 eorzeadb_link 标记）
        for (const a of scan('a.eorzeadb_link')) {
          if (a.classList.contains('zhixia-item-zh')) continue;
          const el = a.querySelector('span') || a;
          const name = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (!name || name.length < 2 || name.length > 48) continue;
          if (/^(https?:|\/)/.test(name)) continue;
          list.push({ type: 'item', element: a, text: name, context: { el } });
        }
      };
      const pushPlainItems = () => {
        // plain-item：EC「套装」区块里的纯文本装备名（无链接、无 hash）
        for (const sp of scan('span[class*="has-text-rarity-"]')) {
          if (sp.classList.contains('zhixia-item-zh')) continue;
          const name = (sp.textContent || '').replace(/\s+/g, ' ').trim();
          if (!name || name.length < 3 || name.length > 48) continue;
          if (!resolveByName(name)) continue;
          list.push({ type: 'plain-item', element: sp, text: name, context: {} });
        }
      };
      const pushCards = () => {
        // card：EC 列表页卡片标题（外层 <a> 指向站内页）
        for (const el of scan(EC_CARD_SEL)) {
          if (el.dataset.zhixiaCard) continue;
          const name = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (!name || name.length < 3 || name.length > 48) continue;
          if (!resolveByName(name)) continue;
          list.push({ type: 'card', element: el, text: name, context: {} });
        }
      };
      const pushDyes = () => {
        // dye：染剂标签（「⬤ Ink Blue」）
        for (const el of scan('div.tag, span.tag')) {
          if (el.classList.contains('zhixia-dye-zh')) continue;
          const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
          const m = /^([\u25EF\u2B24\u25CB\u25CF])\s{0,8}(.{1,200})$/.exec(t);
          if (!m) continue;
          const name = m[2].trim();
          const zh = resolveByName(name) || (name === 'Undyed' ? '未染色' : null);
          if (!zh) continue;
          list.push({ type: 'dye', element: el, text: name, context: { zh } });
        }
      };
      pushItems();
      pushPlainItems();
      pushCards();
      pushDyes();

      return list;
    }

    // 统一分派：按 type 交给对应处理器；各处理器收到的仍是「同类 target 数组」，
    // 调用顺序固定为 item → plain-item → card → dye（与旧版四件套执行顺序一致）。
    function dispatchTargets(targets, applyMap) {
      const m = applyMap || {};
      const by = {};
      for (const t of targets) {
        if (!by[t.type]) by[t.type] = [];
        by[t.type].push(t);
      }
      if (m.item && by.item) m.item(by.item);
      if (m['plain-item'] && by['plain-item']) m['plain-item'](by['plain-item']);
      if (m.card && by.card) m.card(by.card);
      if (m.dye && by.dye) m.dye(by.dye);
    }

    // 统一处理路径：全页（root 缺省）与局部（元素）同路径；
    // context.applyMap 提供各 type 的处理器；返回本次采集到的 targets。
    // Phase 19：处理统计（次数 / 累计 / 峰值 / 首次耗时；整数与毫秒累加，无行为影响）
    const _domStats = { calls: 0, ms: 0, maxMs: 0, firstMs: -1 };
    function processRoot(root, context) {
      const c = context || {};
      const t0 = _perfNow();
      const targets = collectTargets(root);
      dispatchTargets(targets, c.applyMap);
      const dt = _perfNow() - t0;
      _domStats.calls++;
      _domStats.ms += dt;
      if (dt > _domStats.maxMs) _domStats.maxMs = dt;
      if (_domStats.firstMs < 0) _domStats.firstMs = dt;
      return targets;
    }
    /* @zhixia:core-targets-end */


    // EC 列表页（面饰 / 时尚配饰 / 陆行鸟 / 时尚趋势）的装备名是纯文本卡片标题，
    // 外层 <a> 指向 EC 站内页：这里把标题换成国服中文名，点标题直接去灰机 wiki。
    const EC_CARD_SEL = 'p.title.has-text-text.is-5, p.title.has-text-text,' +
                        ' h3[class*="has-text-rarity-"], h4[class*="has-text-rarity-"], h3.minititle';

    // 文本链需避让的「物品链管辖」选择器：这些元素内的文本由 zhApply / zhApplyPlain /
    // zhApplyCards 处理（链接改写 / 包装成 a / 打点标记），文本链若抢先翻译会让物品链
    // 拿不到原文而跳过（历史缺陷：EC 站装备链接点击不跳 wiki）。注意本常量引用
    // EC_CARD_SEL，只能在 4053 行（其定义）之后使用——调用均发生在脚本分发阶段，安全。
    const EC_ITEM_SKIP_SEL = 'a.eorzeadb_link, span[class*="has-text-rarity-"], ' + EC_CARD_SEL;

    function zhApplyCards(targets) {
      targets.forEach((t) => {
        const zh = resolveByName(t.name);
        if (!zh || zh === t.name) return;
        t.el.textContent = zh;
        t.el.dataset.zhixiaCard = '1';
        t.el.title = t.name + '（国服：' + zh + '）— 点击打开灰机 wiki';
        t.el.style.cursor = 'pointer';
        t.el.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open(WIKI_ITEM + encodeURIComponent(zh), '_blank', 'noopener');
        }, true);
      });
    }

    function zhApplyPlain(targets) {
      targets.forEach((t) => {
        const zh = resolveByName(t.name);
        if (!zh || zh === t.name) return;
        const a = document.createElement('a');
        a.className = t.sp.className;
        a.setAttribute('href', WIKI_ITEM + encodeURIComponent(zh));
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'nofollow noopener');
        a.title = t.name + '（国服：' + zh + '）';
        a.textContent = zh;
        a.classList.add('zhixia-item-zh');
        t.sp.replaceWith(a);
      });
    }

    // 输入框提示文字
    const PLACEHOLDER = {
      'Search by title': '按标题搜索',
      'Search by player': '按玩家搜索',
      'Search by name': '按名称搜索',
      'Search': '搜索',
      'Search...': '搜索…',
      'Filter': '筛选',
    };

    function applyPlaceholder(rootArg) {
      queryIn(localScope(rootArg), 'input[placeholder], textarea[placeholder]').forEach((el) => {
        if (el.dataset.zhixiaPh === '1') return;
        const t = (el.getAttribute('placeholder') || '').trim();
        if (!t) return;
        const v = PLACEHOLDER[t];
        if (!v) return;
        el.setAttribute('placeholder', v);
        el.dataset.zhixiaPh = '1';
      });
    }

    function zhApplyDye(targets) {
      targets.forEach((t) => {
        const zh = t.zh;
        if (!zh || zh === t.name) return;
        let changed = false;
        const walk = (node) => {
          for (const n of Array.from(node.childNodes)) {
            if (n.nodeType === 3) {
              if (n.nodeValue?.includes(t.name)) {
                n.nodeValue = n.nodeValue.replace(t.name, zh);
                changed = true;
              }
            } else if (n.nodeType === 1) {
              walk(n);
            }
          }
        };
        walk(t.el);
        if (changed) {
          t.el.classList.add('zhixia-dye-zh');
          t.el.title = t.name + '（国服：' + zh + '）';
        }
      });
    }

    function zhApply(targets) {
      targets.forEach((t) => {
        const zh = lookupZh(t.a, t.name);
        if (!zh || zh === t.name) return;
        t.el.textContent = zh;
        t.a.setAttribute('href', WIKI_ITEM + encodeURIComponent(zh));
        t.a.setAttribute('target', '_blank');
        t.a.setAttribute('rel', 'nofollow noopener');
        t.a.title = t.name + '（国服：' + zh + '）';
        t.a.classList.add('zhixia-item-zh');
      });
    }

    // EC 全局兜底：无论装备名以何种元素呈现，点击时一律跳国服灰机 wiki。
    // 用捕获阶段监听，抢在 EC 自己的跳转逻辑之前。
    function bindGlobalWikiJump() {
      if (window.__zhixiaWikiJumpBound) return;
      window.__zhixiaWikiJumpBound = true;
      document.addEventListener('click', (e) => {
        const el0 = e.target;
        if (!el0?.closest) return;
        const a = el0.closest('a[href*="lodestone"], a[href*="eorzeadb"], a.eorzeadb_link, a[href*="/gear/"], a[href*="garland"], a[href*="eriones"], a[href*="gamerescape"], a[href*="ffxivdb"]');
        let probe = a || el0;
        let guard = 0;
        let zh = null;
        while (probe && guard < 6) {
          const t = (probe.textContent || '').replace(/\s+/g, ' ').trim();
          if (t && t.length >= 2 && t.length <= 48) {
            const z = lookupZh(a, t);
            if (z && z !== t) { zh = z; break; }
          }
          probe = probe.parentElement;
          guard++;
        }
        if (!zh) return;
        e.preventDefault();
        e.stopPropagation();
        window.open(WIKI_ITEM + encodeURIComponent(zh), '_blank', 'noopener');
      }, true);
    }

    // EC 物品链统一分派映射：标准 target → 既有 apply（字段与行为逐字保持）
    const EC_ITEMS_APPLY = {
      item: (ts) => safe(zhApply, 'zhApply')(ts.map((t) => ({ a: t.element, el: t.context.el, name: t.text }))),
      'plain-item': (ts) => safe(zhApplyPlain, 'zhApplyPlain')(ts.map((t) => ({ sp: t.element, name: t.text }))),
      card: (ts) => safe(zhApplyCards, 'zhApplyCards')(ts.map((t) => ({ el: t.element, name: t.text }))),
      dye: (ts) => safe(zhApplyDye, 'zhApplyDye')(ts.map((t) => ({ el: t.element, name: t.text, zh: t.context.zh }))),
    };

    // 统一入口：装备/染剂/卡片/占位符 一次跑完（全页；经统一 Target Pipeline）
    function applyItemZh() {
      processRoot(null, { applyMap: EC_ITEMS_APPLY });
      safe(applyPlaceholder, 'placeholder')();
    }

    function startItems() {
      itemDbReady(() => {
        safe(bindGlobalWikiJump, 'wikiJump')();
        applyItemZh();
        // 局部：新增节点收窄到 subtree，避免全页重查（与全页同一条 Target Pipeline）
        observeLocal((nodes) => {
          for (const n of nodes) {
            if (n.nodeType === 1) safe(processRoot, 'EC 物品局部')(n, { applyMap: EC_ITEMS_APPLY });
          }
        }, 400);
      });
    }

  /* @phase15-module-order:core/probe */
  /* @phase15-order-link:core/probe<-core/targets */


    /* @zhixia:core-probe-start */
    /* ── Core Probe（v1.4 Phase 10 独立化）：运行与性能探测——默认关闭、近零
       开销、不写存储、不发网络请求、不影响正常执行路径。读取面：runtime
       timeline（__zhxMarks）/ data stats / observer stats（_obsStats）/
       resolver hit-miss（_irStats）/ 处理统计（_domStats）/ 数据来源（_dlStats）/
       Wiki stats；Phase 19 起另提供 __zhxDiagRecord() JSON 记录与
       window.__zhxDiagOn 无面板测量开关（基准 / 自动化用）。Phase 15 模块化构建时，本区段
       将原样抽出为 src/core/probe.js（或 src/dev/probe.js，由构建系统决定是否
       保留生产能力）。 */
    /* =====================================================================
     * 运行与性能探测（v1.3.1）：URL 附带 zhx_probe 参数（?zhx_probe=1 或
     * #zhx_probe）时启用——页面右下角显示「可复制的诊断报告」（环境 / 时间线 /
     * 数据规模 / wiki 专项），供手机端实测反馈。默认关闭、近零开销；报告仅本地
     * 显示，不写入存储、不发送任何网络请求。
     * ===================================================================== */
    let __zhxProbeFlag = null;   // null=尚未初始化；true/false=探测开关 // NOSONAR
    let __zhxDiagFlag = false;   // Phase 19：独立测量开关（读取 window.__zhxDiagOn；仅时间线/统计记录，无面板） // NOSONAR
    const __zhxProbeBtnCss = 'padding:6px 10px;font-size:12px;border:1px solid #8ab4d8;border-radius:8px;background:#eaf4fe;color:#1d5c96;cursor:pointer;';

    function __zhxMark(name) {
      try {
        if (!__zhxProbeFlag && !__zhxDiagFlag) return;
        const m = (window.__zhxMarks = window.__zhxMarks || {});
        const now = _perfNow();
        m[name] = Math.round(now - (__zhxBootAt || 0));
      } catch (e) { /* 忽略：探测永不阻断主流程 */ }
    }

    function __zhxProbeOn() {
      try { return /zhx_probe/.test((location.search || '') + (location.hash || '')); } catch (e) { /* 忽略：地址不可读时视为未启用 */ return false; }
    }

    function __zhxProbeEnv(L) {
      L.push('ZHX-PROBE: v1');
      const gi = (typeof GM_info !== 'undefined' && GM_info?.script) || null;
      L.push(
        'ver: ' + ((gi?.version) || 'n/a'),
        'site: ' + location.hostname,
        'url: ' + String(location.href).slice(0, 220),
        'ua: ' + String(navigator.userAgent || '').slice(0, 200),
        'view: ' + window.innerWidth + 'x' + window.innerHeight + ' dpr=' + (window.devicePixelRatio || 1),
        'ts: ' + new Date().toISOString(),
        'ready: ' + document.readyState,
        'gm: get=' + typeof GM_getValue + ' set=' + typeof GM_setValue + ' xhr=' + typeof GM_xmlhttpRequest);
    }

    // Phase 19：内嵌词典规模（字符数近似：各层 JSON 序列化长度求和；仅诊断读取）
    function __zhxDictChars() {
      const size = () => {
        let n = 0;
        for (const k of Object.keys(DICT_LAYERS)) { const o = DICT_LAYERS[k]; if (o) n += JSON.stringify(o).length; }
        return n;
      };
      try {
        return size();
      } catch (e) { /* 忽略：规模统计失败按 0 计（诊断不阻断） */ }
      return 0;
    }

    // Phase 19：可复用诊断记录 API（稳定 JSON 结构；基准 / 自动化与 Probe 共用）
    function __zhxDiagRecord() {
      const rec = { v: 1, boot: Math.round(__zhxBootAt || 0), marks: {}, obs: {}, dom: {}, scan: {}, dl: {}, res: {}, cache: {}, data: {}, dict: {} };
      try { rec.marks = { ...window.__zhxMarks }; } catch (e) { /* 忽略：时间线读取失败（返回空） */ }
      try { rec.obs = { ticks: _obsStats.ticks, nodes: _obsStats.nodes, ms: _obsStats.ms, maxMs: _obsStats.maxMs }; } catch (e) { /* 忽略：观察统计读取失败 */ }
      try { rec.dom = { calls: _domStats.calls, ms: _domStats.ms, maxMs: _domStats.maxMs, firstMs: _domStats.firstMs }; } catch (e) { /* 忽略：处理统计读取失败 */ }
      try { rec.dl = { cache: _dlStats.cache, net: _dlStats.net, fallback: _dlStats.fallback }; } catch (e) { /* 忽略：数据来源统计读取失败 */ }
      try { rec.res = { hit: _irStats.hit, miss: _irStats.miss }; } catch (e) { /* 忽略：解析统计读取失败 */ }
      try { rec.scan = { global: _scanStats.global, local: _scanStats.local }; } catch (e) { /* 忽略：扫描统计读取失败 */ }
      try { rec.cache = cacheInfo(); } catch (e) { /* 忽略：缓存信息读取失败 */ }
      try { rec.data = { names: Object.keys(dataGetIndex('nameMap') || {}).length, series: DATA_TEXT.series ? DATA_TEXT.series.length : 0, acl: DATA_TEXT.acl ? DATA_TEXT.acl.length : 0, ver: DATA_VER || '' }; } catch (e) { /* 忽略：数据规模读取失败 */ }
      try { rec.dict = { chars: __zhxDictChars() }; } catch (e) { /* 忽略：词典规模读取失败 */ }
      return rec;
    }

    function __zhxProbeData(L) {
      L.push('marks: ' + JSON.stringify(window.__zhxMarks || {}), 'boot0: ' + Math.round(__zhxBootAt || 0));
      try { L.push('obs: ' + JSON.stringify(_obsStats) + ' resolver: ' + JSON.stringify(_irStats) + ' dom: ' + JSON.stringify(_domStats) + ' dl: ' + JSON.stringify(_dlStats) + ' scan: ' + JSON.stringify(_scanStats)); } catch (e) { /* 忽略：统计读取失败（可能尚未初始化） */ }
      try {
        L.push('data: names=' + Object.keys(dataGetIndex('nameMap') || {}).length
          + ' series=' + (DATA_TEXT.series ? DATA_TEXT.series.length : 0)
          + ' acl=' + (DATA_TEXT.acl ? DATA_TEXT.acl.length : 0)
          + ' ver=' + (DATA_VER || 'n/a'));
      } catch (e) { /* 忽略：数据规模读取失败（可能尚未就绪） */ }
      try {
        const idx = { nameMap: dataGetIndex('nameMap'), itemHash: dataGetIndex('itemHash'), ecidMap: dataGetIndex('ecidMap'), koByZh: dataGetIndex('koByZh') };
      L.push('idx: nameMap=' + Object.keys(idx.nameMap || {}).length
          + ' itemHash=' + Object.keys(idx.itemHash || {}).length
          + ' ecidMap=' + Object.keys(idx.ecidMap || {}).length
          + ' koByZh=' + Object.keys(idx.koByZh || {}).length);
      } catch (e) { /* 忽略：索引规模读取失败 */ }
      try { L.push('cache: ' + JSON.stringify(cacheInfo())); } catch (e) { /* 忽略：缓存信息读取失败 */ }
      try { L.push('dict: ' + __zhxDictChars()); } catch (e) { /* 忽略：词典规模读取失败 */ }
    }

    function __zhxProbeWiki(L) {
      if (location.protocol !== 'file:' && !/huijiwiki\.com/.test(location.hostname)) return;   // file: 供本地夹具测试
      const T = (f) => { try { return f(); } catch (e) { return 'ERR'; /* 忽略：子项读取失败 */ } };
      try {
        const W = {};
        W.done = T(() => document.documentElement.dataset.zhixiaWikiDone || '0');
        W.tries = T(() => window.__zhxWikiTries || 0);
        W.slot = T(() => { const s = getSlot(); return s ? (s.label + '/' + s.key) : 'null'; });
        W.zh = T(() => getItemZhName() || 'null');
        W.jp = T(() => getJapaneseName() || 'null');
        W.id = T(() => getItemId() || 'null');
        W.ko = T(() => { const z = getItemZhName(); const k = z ? resolveKo(z) : null; return k || 'null'; });
        W.blocks = T(() => document.querySelectorAll('.ff14-content-box-block').length);
        W.src = T(() => !!blockByTitle('其他站点链接'));
        W.lang = T(() => !!blockByTitle('各语言名称'));
        W.infobox = T(() => document.querySelectorAll('.infobox, [class*="infobox"]').length);
        W.h1 = T(() => { const h = document.querySelector('#firstHeading'); return h ? String(h.innerText || '').split('\n')[0].slice(0, 40) : 'no-h1'; });
        W.items = T(() => wikiReverseItems().length);
        W.inj = T(() => !!document.querySelector('.zhixia-reverse-block'));
        L.push('wiki: ' + JSON.stringify(W));
      } catch (e) { /* 忽略：wiki 专项收集失败不影响其它诊断 */ }
    }

    function __zhxProbeText() {
      const L = [];
      __zhxProbeEnv(L);
      __zhxProbeData(L);
      __zhxProbeWiki(L);
      try { L.push('errs: ' + JSON.stringify(window.__zhxErrs || [])); } catch (e) { /* 忽略：错误列表读取失败 */ }
      return L.join('\n');
    }

    function __zhxProbePanel(text) {
      let box = document.getElementById('zhx-probe-box');
      if (!box) {
        box = document.createElement('div');
        box.id = 'zhx-probe-box';
        box.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:2147483000;width:min(92vw,460px);max-height:74vh;overflow:auto;background:#fff;color:#222;border:1px solid #8ab4d8;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.28);font:12px/1.5 ui-monospace,Consolas,monospace;padding:10px;';
        const head = document.createElement('div');
        head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;';
        const h = document.createElement('b');
        h.textContent = '栀夏 · 运行探测（仅本地显示）';
        head.appendChild(h);
        const bClose = document.createElement('button');
        bClose.textContent = '关闭';
        bClose.style.cssText = __zhxProbeBtnCss;
        bClose.onclick = () => { try { box.remove(); } catch (e) { /* 忽略：面板已移除 */ } };
        head.appendChild(bClose);
        box.appendChild(head);
        const ta = document.createElement('textarea');
        ta.id = 'zhx-probe-text';
        ta.readOnly = true;
        ta.style.cssText = 'width:100%;height:38vh;min-height:180px;box-sizing:border-box;font:11px/1.45 ui-monospace,Consolas,monospace;white-space:pre;color:#222;background:#f7fbff;border:1px solid #cfe2f3;border-radius:8px;padding:8px;';
        box.appendChild(ta);
        const bar = document.createElement('div');
        bar.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
        const bCopy = document.createElement('button');
        bCopy.textContent = '复制报告';
        bCopy.style.cssText = __zhxProbeBtnCss;
        bCopy.onclick = () => { __zhxProbeCopy(ta); };
        const bRef = document.createElement('button');
        bRef.textContent = '刷新报告';
        bRef.style.cssText = __zhxProbeBtnCss;
        bRef.onclick = () => { try { ta.value = __zhxProbeText(); } catch (e) { /* 忽略：刷新失败保留旧报告 */ } };
        bar.appendChild(bCopy);
        bar.appendChild(bRef);
        box.appendChild(bar);
        (document.body || document.documentElement).appendChild(box);
      }
      const ta2 = box.querySelector('#zhx-probe-text');
      if (ta2) ta2.value = text;
    }

    function __zhxProbeCopy(ta) {
      const text = ta.value || '';
      const cb = navigator.clipboard;
      if (typeof cb?.writeText === 'function') {
        cb.writeText(text).then(
          () => __zhxProbeToast('已复制，发送给栀夏即可'),
          () => __zhxProbeFallbackCopy(ta));
        return;
      }
      __zhxProbeFallbackCopy(ta);
    }

    function __zhxProbeFallbackCopy(ta) {
      let ok = false;
      try {
        ta.focus();
        ta.select();
        ok = !!document.execCommand?.('copy');   // NOSONAR —— 老浏览器兜底路径（clipboard 不可用时的最后手段）
      } catch (e) {
        // 忽略：无法自动复制（环境限制）——下方统一提示手动长按
      }
      __zhxProbeToast(ok ? '已复制，发送给栀夏即可' : '请长按选择文本后复制');
    }

    function __zhxProbeToast(msg) {
      try {
        let t = document.getElementById('zhx-probe-toast');
        if (!t) {
          t = document.createElement('div');
          t.id = 'zhx-probe-toast';
          t.style.cssText = 'position:fixed;right:12px;top:12px;z-index:2147483001;background:#1d5c96;color:#fff;font-size:12px;padding:6px 10px;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.3);';
          (document.body || document.documentElement).appendChild(t);
        }
        t.textContent = msg;
        clearTimeout(t.__zhxH || 0);
        t.__zhxH = setTimeout(() => { try { t.remove(); } catch (e) { /* 忽略：已移除 */ } }, 2600);
      } catch (e) { /* 忽略：提示条失败不影响复制 */ }
    }

    function __zhxProbeSetup() {
      __zhxProbeFlag = true;
      try { window.__zhxProbeDump = __zhxProbeText; } catch (e) { /* 忽略：控制台辅助入口注册失败 */ }
      try {
        window.__zhxErrs = window.__zhxErrs || [];
        // Phase 18：把启用前已记录的边界错误转移进诊断列表（保留启动早期失败信息）
        try { for (const m of _errLog) { if (window.__zhxErrs.length < 20) { window.__zhxErrs.push(m); } else { break; } } } catch (e) { /* 忽略：既有日志转移失败 */ }
        window.addEventListener('error', (ev) => {
          try {
            if (window.__zhxErrs.length < 20) {
              window.__zhxErrs.push(String(ev?.message || 'e').slice(0, 120) + ' @L' + (ev?.lineno || 0));
            }
          } catch (e) { /* 忽略：错误采集失败 */ }
        });
      } catch (e) { /* 忽略：错误采集注册失败 */ }
      const show = () => { try { __zhxProbePanel(__zhxProbeText()); } catch (e) { /* 忽略：面板生成失败 */ } };
      if (document.readyState === 'complete') setTimeout(show, 2500);
      else window.addEventListener('load', () => setTimeout(show, 2500), { once: true });
      setTimeout(show, 22000);   // 晚到数据/慢注入的第二轮快照
    }

    // 探测启用判断（必须在任何异步回调前定值；未启用时各 mark 直接短路）
    __zhxProbeFlag = __zhxProbeOn();
    __zhxDiagFlag = false;
    try { __zhxDiagFlag = !!window.__zhxDiagOn; } catch (e) { /* 忽略：开关读取失败按未启用 */ }
    // 探测初始化与诊断入口注册（收束为函数：降低 IIFE 认知复杂度；防护语义不变）
    function _bootProbeTail() {
      if (__zhxProbeFlag) {
        try { __zhxProbeSetup(); } catch (e) { /* 忽略：探测初始化失败不影响脚本主功能 */ }
      }
      if (__zhxProbeFlag || __zhxDiagFlag) {
        try { window.__zhxDiagRecord = __zhxDiagRecord; } catch (e) { /* 忽略：诊断入口注册失败 */ }
      }
    }
    _bootProbeTail();
    /* @zhixia:core-probe-end */

  /* @phase15-module-order:main */
  /* @phase15-order-link:main<-core/probe */


    /* @zhixia:core-item-resolver-end */

    /* ===================================================================== */

    const host = location.hostname;
    const _ver = (typeof GM_info !== 'undefined' && GM_info?.script?.version) ? GM_info.script.version : 'dev';
    console.log('FF14 幻化站中文化脚本已加载 v' + _ver + ' →', host);
    // 外置版：先行触发数据加载（各站的就绪回调在数据到达后补扫）
    if (DATA_REMOTE && typeof ensureTables === 'function') safe(ensureTables, '数据预加载')();
    const __site = findSite();
    safe(startChineseSearch, '中文装备搜索')(__site?.id);
    if (__site) { try { __site.boot(); } catch (e) { _zhxErr('boot:' + __site.id, e); } }   // 站点入口（Site Registry 配置驱动；Phase 18 边界）

    // v1.3：bfcache 兜底——页面从浏览器缓存恢复（快速刷新/后退前进）时可能带着
    // 未完成的注入状态回来，补跑一次各站入口（全部幂等）+ 数据就绪检查。
    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      try {
        if (__site) __site.pageshow();   // 各站补跑入口（Site Registry 配置驱动）
        safe(ensureTables, 'pageshow 数据')();
      } catch (err) { _zhxErr('pageshow', err); }
    });

})();
