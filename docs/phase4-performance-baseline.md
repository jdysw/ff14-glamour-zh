# 第四阶段 EC 模拟弱性能基准：首次测量

## 测量来源和口径

- 运行时间：2026-10-11 UTC。
- [GitHub Actions 基准运行 #38164185419](https://github.com/jdysw/ff14-glamour-zh/actions/runs/38164185419)，使用其上传的 `ec-chrome-performance-reports` JSON 工件。
- 环境：GitHub 托管的 Ubuntu / Headless Chrome，通过 CDP 模拟 CPU 节流（1× / 4× / 8×）。使用 EC 离线页面夹具，预热并预置真实 V3 manifest/内容寻址数据缓存；拒绝非预期网络请求。
- 每档 **5 轮**；P50/P95 使用最近秩计算。此规模下 P95 基本由该档最慢一轮决定，适合回归方向性观察，不能替代统计充分的真机 P95。
- 堆内存使用 `Runtime.getHeapUsage`，单位 MiB；不是整机物理内存、私有工作集或移动操作系统实际占用。

## 缓存读取路径（EC）

| CPU 节流 | ready P50 | ready P95 | JS 堆 P50 | JS 堆 P95 |
|---|---:|---:|---:|---:|
| 1× | 283 ms | 322 ms | 29.4 MiB | 30.0 MiB |
| 4× | 1236 ms | 1283 ms | 18.7 MiB | 28.9 MiB |
| 8× | 2750 ms | 2782 ms | 29.4 MiB | 29.4 MiB |

每档的 V3 数据缓存命中计数均为 5，网络请求为 0；name keys 为 50,620，词典字符数为 119,466。注意堆内存采样时机、垃圾回收时机及运行器变化会产生明显波动，不能仅凭单次 P95 判断泄漏或绝对性能。

## 生命周期基准（EC，4× CPU 节流）

| 指标 | 结果 |
|---|---:|
| ready P50 | 1243 ms |
| ready P95 | 1334 ms |
| JS 堆 P50 | 约 30.33 MiB |
| JS 堆 P95 | 约 30.33 MiB |

生命周期基准另外保存 fireDone、MutationObserver 批处理、DOM、resolver、缓存命中和完整的原始轮次，供后续同环境对比。

## 已落实的工程保护

- `tests/benchmark/report.mjs` 新增最近秩统计函数与固定样本单元测试。
- `tests/benchmark/bench-read-path.mjs` 拒绝有效轮次不足的报告，不把缺失数据按零耗时处理。
- `tests/benchmark/bench-lifecycle.mjs` 同时记录 CPU 节流倍率、P50/P95 及实际 JS 堆采样。
- `.github/workflows/performance-regression.yml` 在基准脚本变更时自动运行，并在手动触发时允许重复采样和上传 JSON 工件。

## 尚需设备实测

当前已经形成**可复现的实验室模拟性能基线**；仍缺少针对实际 Android / iOS 设备、不同内存等级、网络条件、复杂页面（大量装备节点）及长时间滚动会话的性能数据。设备实测需要目标设备或合法设备云环境，不能用 Chrome CPU 节流替代，也不能承诺移动端 P95 绝对上限。
