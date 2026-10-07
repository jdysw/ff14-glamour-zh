// ==UserScript==
// @name         FF14 幻化站中文化 · 与灰机 wiki 双向互查
// @namespace    https://github.com/jdysw/ff14-glamour-zh
// @version      1.3.1
// @description  FF14 幻化站中文化（Mirapri / Eorzea Collection / FF14-FC / Ronka LookBook / FFXIV ARMOURY COLLECTION）：界面与装备、染剂名显示为国服中文，装备名可点击直达灰机 wiki 物品页；灰机 wiki 物品页另附「幻化反查链接」（光之收藏家 / 日服 / 国际服 / 韩服），幻化站与 wiki 双向互查。词库按需下载、本地缓存，每日至多检查一次更新；不收集、不上传任何用户信息。
// @author       zhixia
// @license      GPL-3.0
// @match        https://mirapri.com/*
// @match        https://ffxiv.eorzeacollection.com/*
// @match        https://ff14.huijiwiki.com/wiki/*
// @match        https://ff14-fc.com/*
// @match        https://lookbook.ronkacloset.com/*
// @match        https://www.ffxivcollection.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      zhixia-data.pages.dev
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  /* @zhixia:core-runtime-start */
  /* ── Core Runtime（v1.4 Phase 4）：脚本注入时刻（运行探测用；未启用时零
       开销）。本模块共 2 处标记区段（段2 = 错误边界 safe，见下文）；Phase 15
       模块化构建时，本区段将原样抽出为 src/core/runtime.js。 */
  // 运行探测（URL 带 zhx_probe 参数时启用）用：脚本注入时刻；未启用时零开销
  let __zhxBootAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  // Phase 19：测量用单调时钟（performance 缺失时回退 Date.now；供处理统计与时间线共用）
  function _perfNow() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
  /* @zhixia:core-runtime-end */

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
  };

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

  // 英文名 -> 国服中文名（单条查找 + 缓存）。用于 EC 上没进固定词典的
  // 装备名/染剂名等短英文串（如 Tule Tunic、Charcoal Grey）。
  const _en2zhCache = new Map();
  function tryEnToZh(en) {
    if (!en) return null;
    if (_en2zhCache.has(en)) return _en2zhCache.get(en);
    // 物品总表统一索引（英/日/韩名 → 中文名；染剂色名回退已由 buildTables 展开）
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

  let ecBusy = false;

  // 属性翻译：EC 部分导航/图标的文字在 alt / aria-label / title 属性里，
  // 文本节点遍历够不到，这里补齐。（被汉化标记过 title 的元素的 title 不动）
  const _zhixiaTitleKeep = new WeakSet();

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
  let busy = false;

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
    const next = tr(raw);
    if (next !== raw) {
      const p = node.parentElement;
      if (p && !p.title) { p.title = raw.trim(); _zhixiaTitleKeep.add(p); }
      node.nodeValue = next;
    }
  }

  function trEl(el) {
    const ph = el.getAttribute('placeholder');
    if (ph) { const n = tr(ph); if (n !== ph) el.setAttribute('placeholder', n); }
    const val = el.getAttribute('value');
    if (val) { const n = tr(val); if (n !== val) el.setAttribute('value', n); }
  }

  function translatePage(rootArg) {
    if (busy) return;
    busy = true;
    const isFull = !rootArg;
    try {
      const root = rootArg || document.body || document.documentElement;
      if (!root) return;
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode: (n) => {
          if (n.nodeType === 1 && SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const batch = [];
      while (w.nextNode()) batch.push(w.currentNode);
      for (const n of batch) {
        if (n.nodeType === 3) trNode(n);
        else if (n.tagName === 'INPUT') trEl(n);
      }
      if (isFull && document.title) {
        document.title = document.title
          .replace('FF14ミラプリSS投稿・共有サイト', 'FF14 幻化截图投稿 · 分享站')
          .replace('ミラプリを投稿', '发布幻化')
          .replace('このサイトについて', '关于本站')
          .replace('ガイドライン', '指南')
          .replace('お問い合わせ', '联系我们');
      }
    } finally {
      busy = false;
    }
  }

  function startMirapri() {
    safe(translatePage, 'mirapri 全扫')();
    // 局部：只翻译新增子树（祖先去重后逐个处理）
    observeLocal((nodes) => {
      for (const n of nodes) safe(translatePage, 'mirapri 局部')(n);
    }, 300);
    document.addEventListener('turbo:load', safe(translatePage, 'turbo'), false);
    document.addEventListener('pjax:end', safe(translatePage, 'pjax'), false);
  }

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

  function blockByTitle(title) {
    const blocks = document.querySelectorAll('.ff14-content-box-block');
    for (const b of blocks) {
      const t = b.querySelector('.ff14-content-box-block--title');
      if (t && t.textContent.trim() === title) return b;
    }
    return null;
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

  function _mountReverseBlock(block, src) {
    // 位置：「其他站点链接」之后；无该区块时退回 infobox / 正文顶
    if (src?.parentElement) {
      src.parentElement.insertBefore(block, src.nextSibling);
      return;
    }
    const info = document.querySelector('.infobox, [class*="infobox"]');
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
  };


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

  // ── 系列名前缀查找（v1.12.0）：从单件装备表自动推导的系列名（如 ファントムヴィジョン・ディフェンダー → 幻境意象御敌）
  let _seriesMap = null;
  function _getSeriesMap() {
    if (_seriesMap) return _seriesMap;
    _seriesMap = new Map();
    if (typeof SERIES_TEXT === 'string' && SERIES_TEXT) {
      for (const line of SERIES_TEXT.split('\n')) {
        if (!line) continue;
        const i = line.indexOf('|');
        if (i > 0) _seriesMap.set(line.slice(0, i), line.slice(i + 1));
      }
    }
    return _seriesMap;
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
    // 有未命中的段：仅当未命中段可安全保留（短拉丁/数字）才输出
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
  function _trFCSubstr(text, t0, core) {
    if (!_tablesReady || (core || t0).length < 2 || !/[^\x00-\x7F]/.test(t0)) return null;
    let out = text;
    let changed = false;
    // 长词优先，避免短词先替换（v1.1.6：含系列 + 物品前缀推导）
    for (const k of _getSubstrKeysAll()) {
      if (!out.includes(k)) continue;
      const v = DICT_FC[k] != null ? DICT_FC[k] : _getSeriesPfx().get(k) || _getItemPfx().get(k);
      if (v == null) continue;
      out = out.split(k).join(v);
      changed = true;
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

  // 子串替换词表：长度 ≥ 2 的键按长→短排序（用于长句/alt 兜底）
  // v1.2.0：改为懒构建函数——词库运行时更新（dict.json）后清缓存即可重算
  let _fcSubstrCache = null;
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
  let _seriesPfxCache = null;
  let _allKeysCache = null;
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
  let _itemPfxCache = null;
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

  const FC_SKIP_SEL = 'script, style, noscript, textarea, .sns, .twitter, .line';

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

  function _procFCImg(n) {
    const alt = n.getAttribute('alt');
    if (!alt || alt.length < 2 || alt.length > 90) return;
    const nn = trFC(alt);
    if (nn !== alt && !n.dataset.zhixiaFcAlt) { n.setAttribute('alt', nn); n.dataset.zhixiaFcAlt = '1'; }
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
  function fixFCMenu() {
    let changed = false;
    document.querySelectorAll('a[href*="/summary_equipment_id/"]').forEach((a) => {
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
  function bindFCBanners() {
    let changed = false;
    document.querySelectorAll('div.banner-wrap a').forEach((a) => {
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
        l2.textContent = '一览・搜索';
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
    document.querySelectorAll('li.weapon-banner-item a').forEach((a) => {
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
      for (const n of nodes) safe(translateFCPage, 'FC 局部')(n);
      safe(fixFCMenu, 'FC 菜单')();
      safe(bindFCBanners, 'FC 横幅')();
    }, 300);
    // 数据就绪补扫由 Site Adapter 统一登记（见 SITE_REGISTRY 的 onDataReady）
  }

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
  };

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

  // 副本名单条查找：「日文名|中文名」表（内嵌 ACL_CFC_TEXT）
  function lookupAclCfc(ja) {
    if (!ja || typeof ACL_CFC_TEXT !== 'string' || !ACL_CFC_TEXT) return null;
    const key = '\n' + ja + '|';
    const at = ACL_CFC_TEXT.indexOf(key);
    if (at < 0) return null;
    const s0 = at + 1 + ja.length + 1;
    const e0 = ACL_CFC_TEXT.indexOf('\n', s0);
    const v = ACL_CFC_TEXT.slice(s0, e0 < 0 ? undefined : e0).trim();
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

  function replaceACLLodestone() {
    const links = document.querySelectorAll('a.item-link-1[href*="lodestone"]');
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
    const next = trACL(raw);
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

  function _procACLNode(n) {
    if (n.nodeType === 3) { trimACLNode(n); return; }
    if (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA') {
      const ph = n.getAttribute('placeholder');
      if (ph) { const nn = trACL(ph); if (nn !== ph) n.setAttribute('placeholder', nn); }
      return;
    }
    if (n.hasAttribute?.('title')) {
      const ti = n.getAttribute('title');
      if (ti && /[\u3040-\u30ff]/.test(ti)) { const nn = trACL(ti); if (nn !== ti) n.setAttribute('title', nn); }
    }
  }

  function translateACLPage(rootArg) {
    if (rootArg?.nodeType === 3) { trimACLNode(rootArg); return; }
    const root = rootArg || document.body || document.documentElement;
    if (!root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: _aclAcceptNode,
    });
    const batch = [];
    while (w.nextNode()) batch.push(w.currentNode);
    for (const n of batch) _procACLNode(n);
    safe(replaceACLLodestone, 'ACL lodestone 替换')();
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
  let _ronkaCacheN = 0;
  function ronkaItemLookup(ko) {
    if (!ko || ko.length > 80) return null;
    if (ko in RONKA_ITEM_CACHE) return RONKA_ITEM_CACHE[ko];
    const v = resolveByName(ko);
    if (cacheGuard(RONKA_ITEM_CACHE, CACHE_CAP_LOOKUP, _ronkaCacheN)) _ronkaCacheN = 0;
    RONKA_ITEM_CACHE[ko] = v;
    _ronkaCacheN++;
    return v;
  }

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
  function replaceRonkaLodestone() {
    const links = document.querySelectorAll('.post-search-modal a[href*="lodestone"]');
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
    const lis = document.querySelectorAll('.rule-list-wrap li, .rule-block-wrap li');
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
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: _ronkaAcceptNode,
    });
    const batch = [];
    while (w.nextNode()) batch.push(w.currentNode);
    for (const n of batch) _procRonkaNode(n);
    safe(replaceRonkaLodestone, 'Ronka lodestone 替换')();
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
      handler: () => {
        safe(translateRonkaPage, 'Ronka 局部')();
        safe(translateRonkaTitle, 'Ronka 标题')();
      },
    });
    // 数据就绪补扫由 Site Adapter 统一登记（见 SITE_REGISTRY 的 onDataReady）
    console.log('Ronka（韩服幻化站）汉化已启用');
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

  /* ── 数据就绪广播（外置版 / 内嵌版共用）────────────────────────────
     外置版：数据异步到达并建表后触发；内嵌版：建表完成时触发。
     需要等数据就绪的补扫 / 刷新，通过 onTablesReady(fn) 登记。 */
  // 数据版本（外置版由加载器在版本清单到达后赋值；内嵌版保持空 = 随脚本版本）
  let DATA_VER = '';

  const _readyCbs = [];
  let _tablesReady = false;
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

  /* @zhixia:data-layer-start */
  /* ── 外置数据版（Greasy Fork 发布版）：按需下载 + 版本化本地缓存 ──
     内嵌自用版构建链已退役（v1.4），仅维护本外置版。 */
  /* @zhixia:core-constants-start */
  /* ── Core Constants（v1.4 Phase 4）：数据源与网络契约（DATA_BASE /
       DATA_FILES，均为 https）。Phase 15 模块化构建时，本区段将原样抽出为
       src/core/constants.js。 */
  const DATA_REMOTE = true;
  const DATA_BASE = 'https://zhixia-data.pages.dev/ff14/v2/';
  const DATA_BASE_V3 = 'https://zhixia-data.pages.dev/ff14/v3/';   // Runtime Data v3（Phase 12；失败回退 v2）
  const DATA_FILES = {
    items: 'items.tsv',   // 「key|中|英|日|韩|hash|EC_ID|别名」（制表符分隔，一物品一行）
    series: 'series.txt', // 「日文系列名|国服中文名」
    acl: 'acl.txt',       // 「日文副本名|国服中文名」
    dict: 'dict.json',    // 词库（6 层合并紧凑 JSON；v1.2.0 起运行时更新，改词无需发版）
  };

  /* @zhixia:core-constants-end */
  // （站点 → 数据表/索引/页面入口配置：见下方「Site Registry」单一配置源）

  let ITEM_DB_TEXT = '';   // 数据到达前为空串，各查表函数静默跳过
  let SERIES_TEXT = '';
  let ACL_CFC_TEXT = '';

  let itemHash = null;   // hash -> 中文名（EC / mirapri 用）
  let ecidMap = null;    // 中文名 -> EC_ID（wiki / EC 链接用）
  let nameMap = null;    // 英/日/韩名 -> 中文名（含染剂色名回退；各站共用）
  let koByZh = null;     // 中文名 -> 韩文名（ronka 反查用）

  // （EC 装备 ID 单条查找已并入 Item Resolver：resolveEcId，v1.4 Phase 10）
  // v1.2.x：单行解析拆出（降认知复杂度）；v1.3：按需写目标索引 + 染剂候选顺手收集
  function _btHashRow(p, zh, t) {
    if (p[0] === '-') return;
    if (t.itemHash && p[5] && t.itemHash[p[5]] === undefined) t.itemHash[p[5]] = zh;   // hash -> 中文名
    if (t.ecidMap && p[6] && t.ecidMap[zh] === undefined) t.ecidMap[zh] = p[6];       // 中文名 -> EC_ID
  }

  // 写入一个名字键；成功写入且形如「Xxx Dye」时顺手收集（构建后统一补开）
  function _btNamePut(nm, key, zh, dye) {
    if (!nm || !key || nm[key] !== undefined) return;
    nm[key] = zh;
    if (dye && key.length > 4 && key.endsWith(' Dye')) dye.push(key);
  }

  function _btNameRow(zh, en, ja, ko, t) {
    _btNamePut(t.nameMap, en, zh, t.dye);
    _btNamePut(t.nameMap, ja, zh, t.dye);
    _btNamePut(t.nameMap, ko, zh, t.dye);
    if (t.koByZh && zh && ko && t.koByZh[zh] === undefined) t.koByZh[zh] = ko;
  }

  function _btRow(ln, t) {
    const c0 = ln.codePointAt(0);
    if (c0 !== 45 && (c0 < 48 || c0 > 57)) return;   // 仅「数字」或「-」开头的行（跳过表头）
    const p = ln.split('\t');
    if (p.length < 5) return;
    const zh = p[1] || '', en = p[2] || '', ja = p[3] || '', ko = p[4] || '';
    _btHashRow(p, zh, t);
    _btNameRow(zh, en, ja, ko, t);
  }

  // 构建目标：按站裁剪所需索引（scope 为 null 时全建——未知站点/测试环境），
  // 并携带染剂候选缓冲（构建中顺手收集，替代原先对 nameMap 十余万键的全量扫描）
  function _btTargets(scope) {
    const pick = (k) => !scope || scope.includes(k);
    return {
      itemHash: pick('itemHash') ? {} : null,
      ecidMap: pick('ecidMap') ? {} : null,
      nameMap: pick('nameMap') ? {} : null,
      koByZh: pick('koByZh') ? {} : null,
      dye: [],
    };
  }

  /* v1.3 分片构建：每片目标 ≤8ms 后让出主线程，避免移动端主线程被连续阻塞
     1-2 秒（页面渲染/交互停顿、圈圈转不出）。构建在局部对象上完成，全部完成
     前各查表函数仍拿到 null（静默跳过）——与原同步版语义一致；完成后一次性
     赋值 + 染剂回退 + 回调。
     v1.3.1：让出改用 MessageChannel（嵌套 setTimeout 到第 5 级后每级被浏览器
     钳 +4~8ms，MC 恒定 ~0.2ms；创建失败或运行异常时回退分片 setTimeout）。 */
  function buildTables(scope, done) {
    const st = { i: 0, mc: null, done: done, t: _btTargets(scope), lines: ITEM_DB_TEXT.split('\n') };
    try {
      const m = new MessageChannel();
      m.port2.onmessage = () => _btStep(st);
      st.mc = m;
    } catch (e) {
      // 忽略：MessageChannel 不可用（旧环境/异常）——mc 保持 null，回退分片 setTimeout 让出
    }
    _btStep(st);
  }
  // 分片让出调度：MC 优先（~0.2ms/级），端口失效则置空并改走 setTimeout
  function _btNext(st) {
    if (st.mc) {
      let ok = false;
      try { st.mc.port1.postMessage(0); ok = true; } catch (e) { /* 忽略：MC 端口失效——置空后改走 setTimeout */ }
      if (ok) return;
      st.mc = null;
    }
    setTimeout(() => _btStep(st), 0);
  }
  // 单片构建：≤8ms 或 ≤250 行后让出
  function _btStep(st) {
    try {
      const deadline = Date.now() + 8;
      while (st.i < st.lines.length) {
        const end = Math.min(st.i + 250, st.lines.length);
        while (st.i < end) {
          const ln = st.lines[st.i++];
          if (ln) _btRow(ln, st.t);
        }
        if (Date.now() >= deadline) break;
      }
    } catch (e) { /* 忽略：单行解析失败不阻断（尽力构建） */ }
    if (st.i < st.lines.length) { _btNext(st); return; }
    _btApplyTargets(st.t);
    if (typeof st.done === 'function') { try { st.done(); } catch (e) { /* 忽略：完成回调异常不上抛 */ } }
  }
  // 构建收尾：染剂色名回退 + 一次性赋值索引
  function _btApplyTargets(t) {
    try {
      // 染剂色名回退（顺手收集版）：「Xxx Dye → 中文名」补开「Xxx → 中文名」
      if (t.nameMap && t.dye.length) {
        for (const key of t.dye) {
          const base = key.slice(0, -4);
          if (t.nameMap[base] === undefined) t.nameMap[base] = t.nameMap[key];
        }
      }
      itemHash = t.itemHash; ecidMap = t.ecidMap; nameMap = t.nameMap; koByZh = t.koByZh;
    } catch (e) { /* 忽略：构建收尾 best-effort */ }
  }

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
  function storeSet(k, v) {
    try {
      if (typeof GM_setValue === 'function') {
        const r = GM_setValue(k, v);
        if (r && typeof r.then === 'function') r.then(() => {}, () => {});
        return;
      }
      if (typeof GM !== 'undefined' && GM && typeof GM.setValue === 'function') {
        GM.setValue(k, v).then(() => {}, () => {});
        return;
      }
    } catch (e) { /* 忽略：存储写入失败不阻断主流程 */ }
  }

  /* @zhixia:core-storage-end */

  /* @zhixia:core-http-start */
  /* ── Core HTTP（v1.4 Phase 4）：GM_xmlhttpRequest 优先（不受页面 CSP /
       CORS 限制），无则 fetch 兜底；统一 timeout 与错误策略。Phase 15 模块化
       构建时，本区段将原样抽出为 src/core/http.js。 */

  /* ── 网络：优先 GM_xmlhttpRequest（不受页面 CSP/CORS 限制），无则 fetch ── */
  function httpGet(url, timeout) {
    return new Promise((resolve, reject) => {
      let done = false;
      const ok = (t) => { if (!done) { done = true; resolve(t); } };
      const bad = (e) => { if (!done) { done = true; reject(e instanceof Error ? e : new Error(String(e))); } };
      try {
        if (typeof GM_xmlhttpRequest === 'function') {
          GM_xmlhttpRequest({
            method: 'GET', url,
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
          fetch(url, ctl ? { signal: ctl.signal } : {}).then(
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

  /* @zhixia:core-cache-start */
  /* ── Core Cache（v1.4 Phase 4，段1/2）：缓存策略——每日至多一次版本探测、
       元数据与表缓存键。本模块共 2 处标记区段（段2 = 读写接口，见下文）；
       Phase 15 模块化构建时，原样抽出为 src/core/cache.js。 */

  /* ── 版本与缓存：每日至多一次版本探测；指纹一致直接复用本地缓存 ──
     缓存键 zhx.dt.<表名> = 「指纹 + 换行 + 文本」（单键原子写入） */
  const DAY_MS = 24 * 60 * 60 * 1000;
  const META_KEY = 'zhx.meta';        // {"v":"...","t":时间戳}
  const DT_PREFIX = 'zhx.dt.';

  /* @zhixia:core-cache-end */

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
      onDataReady() { safe(translateECPage, 'EC 补扫')(); },
      onPageShow() { safe(translateECPage, 'pageshow')(); safe(bindECPieceTiles, 'pageshow')(); safe(applyItemZh, 'pageshow')(); },
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

  function applyTable(name, txt) {
    if (typeof txt !== 'string' || !txt) return;
    switch (name) {
      case 'items':  ITEM_DB_TEXT = txt; break;        // 物品总表（8 列，制表符分隔）
      case 'series': SERIES_TEXT = '\n' + txt; break;  // 行首锚定查找需要前导换行
      case 'acl':    ACL_CFC_TEXT = '\n' + txt; break;
      case 'dict':   applyRuntimeDict(txt); break;     // 词库运行时合并（v1.2.0）
    }
  }

  /* @zhixia:core-cache-start */
  /* ── Core Cache（段2/2）：缓存读取 / 写入接口——zhx.dt.* 序列化格式
       （指纹 + 换行 + 文本）与空闲延迟写入。Phase 15 随段1 一同抽出为
       src/core/cache.js。 */
  function _readCachedTable(t) {
    return storeGetAsync(DT_PREFIX + t).then((raw) => {
      if (!raw) return null;
      const i = raw.indexOf('\n');
      if (i <= 0) return null;
      const fp = raw.slice(0, i);
      const tx = raw.slice(i + 1);
      return (fp && tx && tx.length > 100) ? { fp: fp, tx: tx } : null;
    });
  }
  function _writeCachedTable(t, fp, tx) {
    if (!fp || !tx) return;
    // v1.3：大字符串（数 MB 级）写入推迟到页面空闲，避免同步写造成瞬时卡顿；
    // 写入失败仅影响下次重新下载，可接受
    const key = DT_PREFIX + t, val = fp + '\n' + tx;
    const put = () => { try { storeSet(key, val); } catch (e) { /* 忽略：缓存写入失败仅影响下次重新下载（见上注释） */ } };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(put, { timeout: 3000 });
    else setTimeout(put, 50);
  }

  /* @zhixia:core-cache-end */

  /* @zhixia:core-cache-registry-start */
  /* ── Core Cache Registry（v1.4 Phase 14）：缓存体系集中登记 ─────────────
     目标：每类缓存的「职责 / 生命周期 / 容量 / 失效」在此唯一登记，
     禁止散落的手工 reset。新增缓存时，在本段 cacheRegister 一行登记即可，
     并由 unit/test-cache.mjs 守卫（登记数量断言）。

     四类缓存（按职责划分，不强制统一数据结构）：
       · data      数据缓存（持久，GM 存储）：zhx.meta / zhx.dt.* / zhx.v3.*
                   生命周期：跨会话；由版本探测与 dataInvalidate 管理（不在此登记）
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

  /* @zhixia:core-data-manager-start */
  /* ── Core Data Manager（v1.4 Phase 11）：远程数据 + 版本 + 缓存 + 重试 +
       ready + fallback 的集中管理。既有链路行为逐字保留（ensureTables /
       itemDbReady / onTablesReady 均为原语义）；对外的 dataManager 对象
       提供统一 API：ensure / ready / getTable / getIndex / invalidate。
       缓存与版本探测契约见 Core Cache（段1/2）；Phase 15 模块化构建时，
       本区段将原样抽出为 src/core/data-manager.js。 */
  let _ensurePromise = null;
  // v1.2.x：局部缓存读取与单表拉取拆出（降认知复杂度）
  // Phase 19：数据来源统计（cache=本地缓存交付 / net=网络下载交付 / fallback=下载失败旧缓存兜底）
  const _dlStats = { cache: 0, net: 0, fallback: 0 };
  function _ensureReadLocal(need) {
    const local = {};
    return Promise.all(need.map((t) => _readCachedTable(t).then((c) => { if (c) local[t] = c; }, () => {}))).then(() => local);
  }

  async function _ensureFetchTable(t, vfps, local) {
    const fp = vfps?.[t] ? String(vfps[t]) : null;
    const cached = local[t] || null;
    if (fp && cached?.fp === fp) { applyTable(t, cached.tx); _dlStats.cache++; return 1; }
    if (!fp && cached) { applyTable(t, cached.tx); _dlStats.cache++; return 1; }   // 无版本信息时不盲刷
    let txt = null;
    try { txt = await httpGet(DATA_BASE + DATA_FILES[t], 25000); }
    catch (e) { txt = null; _zhxErr('fetch:' + t, e); }
    const fmtOk = (t === 'dict') ? (txt?.charAt(0) === '{') : (txt && (txt.includes('\t') || txt.includes('|')));
    if (txt && txt.length > 100 && fmtOk) {
      applyTable(t, txt);
      _writeCachedTable(t, fp, txt);
      _dlStats.net++;
      return 1;
    }
    if (cached) { applyTable(t, cached.tx); _dlStats.fallback++; return 1; }   // 下载失败 → 兜底旧缓存
    return 0;
  }

  // v1.2.x：主体抽为具名函数（匿名 IIFE 会把复杂度并入 ensureTables 度量）
  // ① 读本地缓存；「缓存齐全 + 24 小时内已对齐版本」则零网络直接用
  async function _ensureTryFast(need) {
    const local = await _ensureReadLocal(need);
    __zhxMark('readEnd');   // Phase 19：本地读取结束
    let meta = null;
    try { const s = await storeGetAsync(META_KEY); meta = s ? JSON.parse(s) : null; } catch (e) { /* 忽略：元数据读取失败按无缓存处理（meta 保持 null） */ }
    const fresh = !!(meta?.t && (Date.now() - meta.t < DAY_MS));
    const allCached = need.every((t) => !!local[t]);
    if (!allCached || !fresh) return { local };
    for (const t of need) applyTable(t, local[t].tx);
    DATA_VER = (meta.v ? String(meta.v) : '');
    _dlStats.cache += need.length;
    __zhxMark('applied');   // Phase 19：缓存文本应用完成
    return null;
  }

  // ②③④ 版本清单 + 逐表拉取（指纹一致→缓存；不一致/缺失→下载，失败回退旧缓存）+ 记录检查时间
  async function _ensureFetchAll(need, local) {
    let ver = null;
    try { ver = JSON.parse(await httpGet(DATA_BASE + 'version.json', 10000)); } catch (e) { ver = null; _zhxErr('version', e); }
    const vfps = (ver?.files && typeof ver.files === 'object') ? ver.files : null;
    let okCount = 0;
    (await Promise.all(need.map((t) => _ensureFetchTable(t, vfps, local).catch((e) => { _zhxErr('table:' + t, e); return 0; })))).forEach((v) => { okCount += v; });
    if (ver?.v) DATA_VER = String(ver.v);
    __zhxMark('applied');   // Phase 19：表格拉取/应用完成
    if (ver && okCount === need.length) {
      storeSet(META_KEY, JSON.stringify({ v: (ver.v ? String(ver.v) : ''), t: Date.now() }));
    }
  }

  // ⑤ 建表 + 广播（无论成败：页面按可用数据尽力工作，界面词不受影响）
  // v1.3：buildTables 改分片（回调式）——分片全部完成后才广播就绪
  function _ensureFinalize() {
    __zhxMark('finalize');
    return new Promise((resolve) => {
      const go = () => {
        __zhxMark('buildStart');
        const finish = () => {
          __zhxMark('buildEnd');
          try { _fireTablesReady(); } catch (e) { _zhxErr('fireReady', e); }
          __zhxMark('ready');
          try {
            console.info('幻化数据就绪 → 物品表 ' + (ITEM_DB_TEXT ? ITEM_DB_TEXT.length : 0)
              + ' / 系列表 ' + (SERIES_TEXT ? SERIES_TEXT.length : 0)
              + ' / 副本表 ' + (ACL_CFC_TEXT ? ACL_CFC_TEXT.length : 0)
              + ' / 数据版本 ' + (DATA_VER || '未记录'));
          } catch (e) { /* 忽略：日志输出失败不影响就绪 */ }
          resolve();
        };
        if (_v3Applied) { finish(); return; }   // v3：索引已直接就绪，跳过 v2 建表
        buildTables(_buildScope, finish);
      };
      if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 500 }); // v1.3.1：兜底 2000→500，消除静止页面等满 2s 的最坏情况
      else setTimeout(go, 50);
    });
  }

  // 首屏优先：网络下载推迟到页面 load 之后（弱网/移动端避免与页面自身资源抢带宽，
  // 缓解页面图片流被饿死/加载缓慢；缓存命中路径不受影响），最长兜底等待 12s，
  // 防 load 迟迟不触发时数据永不拉取。
  function _waitPageLoad() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') { resolve(); return; }
      let done = false;
      const fin = () => { if (!done) { done = true; resolve(); } };
      try { window.addEventListener('load', fin, { once: true }); } catch (e) { /* 兜底计时器保底 */ }
      setTimeout(fin, 12000);
    });
  }

  let _buildScope = null;   // 本页索引构建范围（按站裁剪；null = 全建）

  // ── Runtime Data v3（v1.4 Phase 12）：按站最小数据 + manifest ——
  // 加载顺序：v3 →（失败 / schema 不兼容）→ v2 → 缓存 / 内嵌 fallback。
  // v3 文件清单/格式由 build/make-runtime-data.py 生成（生成器侧已完成首行胜、
  // 染剂回退展开、'-' 行跳过等语义等价处理；此处直接建索引一次赋值）。
  // 缓存：manifest（zhx.v3.manifest = t + '\n' + 原文）；文件（zhx.v3.f.<site>.<name>
  // = sha256 + '\n' + 文本）。sha256 校验在 crypto.subtle 可用时执行，不可用不阻塞。
  let _v3Applied = false;

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

  // v3 数据应用（一次性赋值——与 v2 构建收尾同语义；'_' 前缀变量跨段引用见 IIFE 说明）
  function _applyV3(files) {
    // 取值包装拆为局部函数（仅降复杂度；取值顺序与语义不变）
    const take = (key, multi) => (files[key] ? _v3Pairs(files[key], multi) : null);
    try {
      const names = take('names');
      const hash = take('hash');
      const ecid = take('ecid');
      const ko = take('ko');
      const ali = take('alias', true);
      const dup = take('dup', true);
      if (names) nameMap = names;
      if (hash) itemHash = hash;
      if (ecid) ecidMap = ecid;
      if (ko) koByZh = ko;
      if (ali) _irAliasMap = ali;
      if (dup) _irDupMap = dup;
      if (files.series) SERIES_TEXT = '\n' + files.series;
      if (files.acl) ACL_CFC_TEXT = '\n' + files.acl;
      if (files.dict) applyRuntimeDict(files.dict);
      _v3Applied = true;
      return true;
    } catch (e) {
      _zhxErr('v3apply', e);
      return false;
    }
  }

  // v3 单文件获取：缓存命中且 sha 一致直接用；否则下载 + sha 校验 + 写缓存
  async function _v3FetchFile(siteId, name, meta) {
    if (!meta?.url) return null;
    const ck = 'zhx.v3.f.' + siteId + '.' + name;
    try {
      const raw = await storeGetAsync(ck);
      if (raw) {
        const i = raw.indexOf('\n');
        if (i > 0 && raw.slice(0, i) === meta.sha256) return raw.slice(i + 1);
      }
    } catch (e) { /* 忽略：缓存读取失败走网络 */ }
    let txt = null;
    try { txt = await httpGet(DATA_BASE_V3 + meta.url, 25000); } catch (e) { txt = null; }
    if (typeof txt !== 'string' || !txt) return null;
    try {
      if (meta.sha256 && typeof crypto !== 'undefined' && crypto?.subtle && typeof TextEncoder === 'function') {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
        const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
        if (hex !== meta.sha256) return null;
      }
    } catch (e) { /* 忽略：校验不可用/失败不阻塞（下载成功即可用） */ }
    try { storeSet(ck, meta.sha256 + '\n' + txt); } catch (e) { /* 忽略：缓存写入失败不影响本次使用 */ }
    return txt;
  }

  // v3 主流程：manifest（24h 缓存）→ 站点文件（缓存优先）→ 应用。
  // 任何一步失败/缺文件 → false（调用方回退 v2，不改变现有行为）。
  async function _ensureTryV3() {
    // 缓存 manifest 读取（读取/解析失败视为无缓存；返回 {manT, man}）
    async function readCachedManifest() {
      try {
        const mraw = await storeGetAsync('zhx.v3.manifest');
        if (mraw) {
          const i = mraw.indexOf('\n');
          if (i > 0) return { manT: Number(mraw.slice(0, i)) || 0, man: JSON.parse(mraw.slice(i + 1)) };
        }
      } catch (e) { _zhxErr('v3manifest', e); }
      return { manT: 0, man: null };
    }
    // 网络刷新 manifest（每日至多一次探测路径；失败返回 null）
    async function fetchManifest() {
      let txt = null;
      try { txt = await httpGet(DATA_BASE_V3 + 'manifest.json', 10000); } catch (e) { txt = null; }
      if (typeof txt !== 'string' || !txt) return null;
      try {
        const m2 = JSON.parse(txt);
        if (m2?.schema === 3 && m2.sites) {
          const manT = Date.now();
          try { storeSet('zhx.v3.manifest', String(manT) + '\n' + txt); } catch (e) { /* 忽略：缓存写入失败不影响本次使用 */ }
          return m2;
        }
      } catch (e) { /* 忽略：manifest 解析失败 → 回退 v2 */ }
      return null;
    }
    // 缓存优先 → 必要时网络（站点是否在列由下方统一判断）
    async function loadManifest() {
      const c = await readCachedManifest();
      const fresh = !!(c.manT && (Date.now() - c.manT < DAY_MS));
      if (c.man && fresh && c.man.schema === 3 && c.man.sites) return c.man;
      return await fetchManifest();
    }
    // 站点文件并行获取（含共享词库）
    async function fetchStationFiles(siteId, names, sm, sharedDict) {
      const files = {};
      const jobs = names.map((n) => _v3FetchFile(siteId, n, sm[n])
        .then((t) => { files[n] = t; }, () => { files[n] = null; }));
      if (sharedDict) {
        jobs.push(_v3FetchFile(siteId, 'dict', sharedDict)
          .then((t) => { files.dict = t; }, () => { files.dict = null; }));
      }
      await Promise.all(jobs);
      return files;
    }
    function allFilesReady(names, files, sharedDict) {
      for (const n of names) { if (files[n] == null) return false; }
      return !(sharedDict && files.dict == null);
    }

    const site = findSite();
    if (!site?.id) return false;
    try {
      const man = await loadManifest();
      if (!man?.sites?.[site.id]) return false;
      const sm = man.sites[site.id].files || {};
      const names = Object.keys(sm);
      if (!names.length) return false;
      const need = neededTables();
      // 共享词库（manifest.shared.dict；neededTables 含 dict 的站点拉取）
      const sharedDict = (need.includes('dict') && man.shared?.dict) || null;
      const files = await fetchStationFiles(site.id, names, sm, sharedDict);
      if (!allFilesReady(names, files, sharedDict)) return false;
      if (!_applyV3(files)) return false;
      try { if (man.version) DATA_VER = String(man.version); } catch (e) { /* 忽略 */ }
      return true;
    } catch (e) {
      _zhxErr('v3', e);
      return false;
    }
  }

  async function _ensureMain() {
    const need = neededTables();
    if (!need.length) return;
    _buildScope = _siteIndexes();
    // v3 优先：成功即返回（_ensureFinalize 将跳过 v2 建表）；失败 → 现有 v2 链
    const v3 = await _ensureTryV3();
    if (v3) return;
    const fast = await _ensureTryFast(need);
    if (!fast) return;
    await _waitPageLoad();
    await _ensureFetchAll(need, fast.local);
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
      case 'items': return ITEM_DB_TEXT || null;
      case 'series': return SERIES_TEXT || null;
      case 'acl': return ACL_CFC_TEXT || null;
      default: return null;
    }
  }
  function dataGetIndex(name) {
    // 索引引用（数据层与核心模块内部/调试用途；业务侧查询一律走 Item Resolver）
    switch (name) {
      case 'itemHash': return itemHash || null;
      case 'nameMap': return nameMap || null;
      case 'ecidMap': return ecidMap || null;
      case 'koByZh': return koByZh || null;
      default: return null;
    }
  }
  function dataInvalidate() {
    // 失效就绪状态：下次 ensure 重新探测版本（表缓存不删除——旧缓存仍可兜底复用）
    _ensurePromise = null;
    DATA_VER = '';
    try { storeSet(META_KEY, ''); } catch (e) { /* 忽略：元数据清除失败不影响主流程 */ }
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

  let _irDupMap = null;     // 重名键（同键多译）: key → zh[]（含首行=nameMap 现值，按行序）
  let _irAliasMap = null;   // 别名表: alias → zh[]（按行序；alias 列以全角分号拆分）

  // 从物品总表建立衍生注册表（重名 / 别名）。须在 nameMap 就绪后调用（itemDbReady 钩子）；
  // 未就绪或异常时保持/回退 null——所有查询路径对空表安全（等同主索引既有行为）。
  function _irBuildAux(text) {
    if (_v3Applied) return true;   // v3：dup/alias 已由服务端预构建直读（Phase 13），跳过全表二次扫描
    if (typeof text !== 'string' || !text || !nameMap) return false;
    const dup = Object.create(null);
    const ali = Object.create(null);
    for (const ln of text.split('\n')) {
      _irScanLine(ln, dup, ali);
    }
    _irDupMap = dup;
    _irAliasMap = ali;
    return true;
  }

  // 单行扫描：登记重名（同键多译）与别名（alias 列以全角分号拆分）
  function _irScanLine(ln, dup, ali) {
    const c0 = ln.codePointAt(0);
    if (c0 !== 45 && (c0 < 48 || c0 > 57)) return;   // 仅「数字」或「-」开头（与构建器同规则，跳过表头）
    const p = ln.split('\t');
    if (!p[1]) return;
    const zh = p[1];
    for (let ci = 2; ci <= 4 && ci < p.length; ci++) {
      _irRegDup(p[ci], zh, dup);
    }
    if (p.length > 7 && p[7]) {
      for (const part of p[7].split('；')) {
        const a = part.trim();
        if (a) _irRegAlias(a, zh, ali);
      }
    }
  }

  // 登记重名键（仅「同键多译」；同名同译的直接跳过）
  function _irRegDup(k, zh, dup) {
    if (!k) return;
    const cur = nameMap[k];
    if (cur === undefined || cur === zh) return;
    const d = dup[k] || (dup[k] = [cur]);
    if (!d.includes(zh)) d.push(zh);
  }

  // 登记别名（1 别名 → 多 zh，按行序）
  function _irRegAlias(a, zh, ali) {
    const d = ali[a] || (ali[a] = []);
    if (!d.includes(zh)) d.push(zh);
  }

  // 解析统计（v1.4 Phase 10：Probe 读取——整数自增，无行为影响）
  const _irStats = { hit: 0, miss: 0 };
  function resolveByHash(hash) { const z = (hash && itemHash?.[hash]) ? itemHash[hash] : null; _irStats[z ? 'hit' : 'miss']++; return z; }
  function resolveByName(name) { const z = (name && nameMap?.[name]) ? nameMap[name] : null; _irStats[z ? 'hit' : 'miss']++; return z; }
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

  // 数据就绪后建立衍生注册表（加载早期未注册时保持 null——查询路径均有回退）。
  if (typeof itemDbReady === 'function') {
    try { itemDbReady(() => { try { _irBuildAux(ITEM_DB_TEXT); } catch (e) { _zhxErr('resolverAux', e); } }); }
    catch (e) { _zhxErr('itemDbReady', e); }
  }
  /* @zhixia:core-item-resolver-end */

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
  let _dictFixesBuf = null;

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
    const layers = ['main', 'ec', 'fc', 'ronka', 'acl'];
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
  let _dictRevision = 0;
  // 六层词表引用（common 为公共层；applyRuntimeDict 对 5 站层单独合并）
  const DICT_LAYERS = { common: DICT_COMMON, main: DICT, ec: DICT_EC, fc: DICT_FC, ronka: DICT_RONKA, acl: DICT_ACL };
  function dictGet(key, layer) { const o = DICT_LAYERS[layer || 'main']; return (o && Object.hasOwn(o, key)) ? o[key] : undefined; }   // NOSONAR —— 接口层：tests/unit 经 dist 区段装配调用（冻结契约）；生产路径暂不直呼
  function dictHas(key, layer) { const o = DICT_LAYERS[layer || 'main']; return !!o && Object.hasOwn(o, key); }   // NOSONAR —— 接口层：tests/unit 经 dist 区段装配调用（冻结契约）；生产路径暂不直呼
  function dictGetRevision() { return _dictRevision; }
  function dictInvalidate() { cacheReset('translate'); }
  function dictUpdate(txt) { return applyRuntimeDict(txt); }   // NOSONAR —— 接口层：tests/unit 经 dist 区段装配调用（冻结契约）；生产路径暂不直呼
  /* @zhixia:core-dictionary-end */

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

  /* @zhixia:core-dom-end */

  /* @zhixia:core-observer-start */
  /* ── Core Observer（v1.4 Phase 7）：统一 MutationObserver 调度层——pending 队列 /
       debounce 计时 / 洪峰保护 / 祖先去重（dedupeByAncestor）/ childList 与可选
       characterData（按站点显式开启，禁止无条件开启）。所有站点的观察器都经由
       createObserver（或兼容包装 observeLocal）创建。Phase 15 模块化构建时，
       本区段将原样抽出为 src/core/observer.js。 */

  // 统一观察器工厂。
  // opts: {
  //   handler(nodes)       必填——批次处理器（nodes = 去重后的新增节点；signal 型站点可忽略）
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
    // mutation 明细收集拆为局部函数（仅降复杂度；判定与产物不变）
    const collectMuts = (muts) => {
      let hitCD = false;
      for (const m of muts) {
        if (m.type === 'characterData') {
          if (!o.characterData) continue;                 // 未开启：完全忽略
          if (o.filter && !o.filter(m)) continue;         // 站点过滤（如 RONKA_KR）
          hitCD = true;
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
        pending = [];
        _obsStats.ticks++; _obsStats.nodes += nodes.length;   // Phase 10：Probe 统计
        const t0 = _perfNow();                                // Phase 19：处理时长统计
        try { o.handler(nodes); } catch (e) { _zhxErr('createObserver', e); }
        const dt = _perfNow() - t0;
        _obsStats.ms += dt;
        if (dt > _obsStats.maxMs) _obsStats.maxMs = dt;
      }, debounce);
    });
    mo.observe(root, o.characterData
      ? { childList: true, subtree: true, characterData: true }
      : { childList: true, subtree: true });
    return { disconnect: () => mo.disconnect() };
  }

  // 兼容包装：既有站点的局部观察器（handler 收新增节点批次；delay 为 debounce）
  function observeLocal(handler, delay) {
    return createObserver({ handler, debounce: delay || 350 });
  }
  /* @zhixia:core-observer-end */

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

  function applyPlaceholder() {
    document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach((el) => {
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

  /* ===================================================================== */

  const host = location.hostname;
  const _ver = (typeof GM_info !== 'undefined' && GM_info?.script?.version) ? GM_info.script.version : 'dev';
  console.log('FF14 幻化站中文化脚本已加载 v' + _ver + ' →', host);
  // 外置版：先行触发数据加载（各站的就绪回调在数据到达后补扫）
  if (DATA_REMOTE && typeof ensureTables === 'function') safe(ensureTables, '数据预加载')();
  const __site = findSite();
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
  let __zhxProbeFlag = null;   // null=尚未初始化；true/false=探测开关
  let __zhxDiagFlag = false;   // Phase 19：独立测量开关（读取 window.__zhxDiagOn；仅时间线/统计记录，无面板）
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
    const rec = { v: 1, boot: Math.round(__zhxBootAt || 0), marks: {}, obs: {}, dom: {}, dl: {}, res: {}, cache: {}, data: {}, dict: {} };
    try { rec.marks = { ...(window.__zhxMarks || {}) }; } catch (e) { /* 忽略：时间线读取失败（返回空） */ }
    try { rec.obs = { ticks: _obsStats.ticks, nodes: _obsStats.nodes, ms: _obsStats.ms, maxMs: _obsStats.maxMs }; } catch (e) { /* 忽略：观察统计读取失败 */ }
    try { rec.dom = { calls: _domStats.calls, ms: _domStats.ms, maxMs: _domStats.maxMs, firstMs: _domStats.firstMs }; } catch (e) { /* 忽略：处理统计读取失败 */ }
    try { rec.dl = { cache: _dlStats.cache, net: _dlStats.net, fallback: _dlStats.fallback }; } catch (e) { /* 忽略：数据来源统计读取失败 */ }
    try { rec.res = { hit: _irStats.hit, miss: _irStats.miss }; } catch (e) { /* 忽略：解析统计读取失败 */ }
    try { rec.cache = cacheInfo(); } catch (e) { /* 忽略：缓存信息读取失败 */ }
    try { rec.data = { items: ITEM_DB_TEXT ? ITEM_DB_TEXT.length : 0, series: SERIES_TEXT ? SERIES_TEXT.length : 0, acl: ACL_CFC_TEXT ? ACL_CFC_TEXT.length : 0, ver: DATA_VER || '' }; } catch (e) { /* 忽略：数据规模读取失败 */ }
    try { rec.dict = { chars: __zhxDictChars() }; } catch (e) { /* 忽略：词典规模读取失败 */ }
    return rec;
  }

  function __zhxProbeData(L) {
    L.push('marks: ' + JSON.stringify(window.__zhxMarks || {}), 'boot0: ' + Math.round(__zhxBootAt || 0));
    try { L.push('obs: ' + JSON.stringify(_obsStats) + ' resolver: ' + JSON.stringify(_irStats) + ' dom: ' + JSON.stringify(_domStats) + ' dl: ' + JSON.stringify(_dlStats)); } catch (e) { /* 忽略：统计读取失败（可能尚未初始化） */ }
    try {
      L.push('data: items=' + (ITEM_DB_TEXT ? ITEM_DB_TEXT.length : 0)
        + ' series=' + (SERIES_TEXT ? SERIES_TEXT.length : 0)
        + ' acl=' + (ACL_CFC_TEXT ? ACL_CFC_TEXT.length : 0)
        + ' ver=' + (DATA_VER || 'n/a'));
    } catch (e) { /* 忽略：数据规模读取失败（可能尚未就绪） */ }
    try {
      L.push('idx: nameMap=' + (nameMap ? Object.keys(nameMap).length : 0)
        + ' itemHash=' + (itemHash ? Object.keys(itemHash).length : 0)
        + ' ecidMap=' + (ecidMap ? Object.keys(ecidMap).length : 0)
        + ' koByZh=' + (koByZh ? Object.keys(koByZh).length : 0));
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
})();
