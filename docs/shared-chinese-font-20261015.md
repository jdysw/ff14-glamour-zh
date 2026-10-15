# 支持站点统一中文字体

将 Miramiru 的字体规则移到 `src/core/dom.js`，由 `src/main.js` 在找到受支持站点后统一启用。适用于 Mirapri、Eorzea Collection、FF14-FC、Ronka、FFXIV ARMOURY COLLECTION（含武器站）、End Closet、Miramiru 及灰机 Wiki。未知站点不启用，bfcache 恢复时幂等补回样式。

正文、标题、表单及动态 HTML 弹层使用同一简体中文优先的本地字体列表。Windows 优先微软雅黑 UI／微软雅黑，其他系统回退至苹方、思源黑体等。不改变字号、粗细或页面语言，不新增字体下载。代码等宽字体、SVG 和常见 Font Awesome／Material Icons／MDI 图标字体保留。

## 临时安装测试

运行 `npm run build:font-test`，生成 `dist/ff14-chinese-font-1.4.5-test.user.js`。这是一份独立的字体辅助脚本，可与已安装的汉化脚本同时启用，覆盖全部受支持域名；它只注入字体样式，不访问词库或修改缓存。正式汉化脚本更新后可停用辅助脚本，避免重复安装。

Miramiru 原有独立测试版本也已重新生成并使用同一共用规则。

## 验证

八个站点的真实启动入口通过离线页面验证，覆盖正文、控件、动态弹层、图标和代码字体，验证重复运行及 pageshow 后样式恢复。源码测试与单元套件均通过。线上检查单独记录访问验证或加载失败，不将验证页算成站点页面验收；原始逐站检查保留在本地 `.cache/all-site-font-results.json`。
