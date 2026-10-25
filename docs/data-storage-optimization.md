# V3 数据存储与发布

生产脚本只使用当前 V3 协议。十个应用站点复用八个发布数据集；Eden 和 xivc 使用 Miramiru 的多语数据。清单入口、文件 URL、GM 缓存键和完整八层词典保持稳定。

## 当前实现

- `build/make-runtime-data.py` 生成站点所需数据与清单。
- `tools/data/verify-publish-contract.mjs` 校验全部必需文件、SHA-256、字节长度、UTF-8 和共享词典结构。
- `tools/data/verify-shared-candidates.mjs` 验证共享候选数据一致性。
- `tools/data/verify-pages-assets.mjs` 检查部署目录的静态资源大小和路径边界。
- `tools/data/dedupe-pages.mjs` 按相同 SHA-256、后缀和长度合并物理副本，通过 Pages `_redirects` 的 200 内部代理保留原 V3 URL。
- `tools/data/verify-pages-http.mjs` 在 Wrangler Pages 运行时逐一核验原 URL 返回 200、无可见跳转且正文摘要与长度一致。
- `tools/data/verify-pages-production.mjs` 按已发布基线检查线上资源；PR 候选数据不要求提前部署。

发布顺序仍为：生成 → 完整性校验 → 候选及平台限制校验 → 静态文件去重 → 全部路径复核 → 上传。去重不修改清单内容，不改变客户端请求路径，也不省略缓存损坏和网络失败处理。

## 存储审计与验证

```bash
python3 .github/deploy/prepare.py
node tools/data/verify-publish-contract.mjs --dir site/ff14/v3
node tools/data/audit-storage.mjs --dir site/ff14/v3 --out storage-baseline.json
node tools/data/dedupe-pages.mjs --site site
node tools/data/dedupe-pages.mjs --site site --verify
node tools/data/verify-pages-assets.mjs --dir site
```

生成过程需要有效的装备部位 CSV，具体环境与固定输入校验以部署工作流为准。存储报告在去重之前对完整 V3 产物生成；gzip/Brotli 数值是离线估算，不代表实际 CDN 流量或计费。

`V3 Storage Baseline` 工作流保留存储审计、发布契约、去重和原 URL HTTP 验证，不进行生产部署。`deploy-data.yml` 是生产数据部署入口，脚本发行继续通过独立的 Release 工作流执行。

## 协议边界

仅维护现行 V3，不保留另一套预览协议、试读器或双版本发布链。当前生产 V3 的安全校验、缓存更新和故障回退机制继续保留。
