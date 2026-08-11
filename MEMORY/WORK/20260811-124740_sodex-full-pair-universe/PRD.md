---
task: 支持 SoDEX 全部永续交易对的跨所对比
slug: 20260811-124740_sodex-full-pair-universe
effort: advanced
phase: complete
progress: 31/31
mode: interactive
started: 2026-08-11T04:47:40Z
updated: 2026-08-11T04:55:00Z
---

## Context

当前 `PAIRS` 硬编码 4 个(BTC/ETH/SOL/GOLD),每个适配器各自维护一张 4 行的
`PAIR_SYMBOLS` 手写映射。用户要求覆盖 SoDEX 上**全部** 83 个永续对并保持跨所对比。

**SoDEX 品种构成(实测 `/m/symbols`,83 个全部 PERPETUAL + online,contractSize 均为 1)**

| 类别 | 示例 |
|------|------|
| 加密主流 | BTC ETH SOL BNB XRP DOGE ADA LTC |
| Meme | 1000BONK 1000PEPE 1000SHIB WIF FARTCOIN PUMP PENGU TRUMP |
| 美股 | NVDA TSLA AAPL MSFT GOOGL AMZN META COIN MSTR PLTR HOOD |
| 商品 | CL COPPER NATGAS SILVER XAUt |
| 指数 | US500 USTECH100 EWY |
| Pre-IPO / 私募 | ZHIPU SAMSUNG CXMT DRAM MINIMAX SKHX SKHY MON |

**可对比密度(实测其他 7 家的合约清单)**

| 其他所覆盖数 | 品种数 |
|---|---|
| 7 家 | 41 |
| 6 家 | 7 |
| 5 家 | 26 |
| 4 家 | 2 |
| 3 家 | 2 |
| 2 家 | 1 |
| 1 家 | 1 |
| 0 家(SoDEX 独有) | 3 → US500 / USTECH100 / SKHX |

币安现有 746 个活跃永续,确实包含 MSFT/TSLA/NVDA/ZHIPU/SAMSUNG/COPPER/CL —— 股票与商品
永续在主流所已普遍上线,可对比性远高于预期。

**规模冲击**
每采集周期抓取量由 36 增至约 600(约 17 倍)。现有 collector 用单个 `Promise.all`
一次性发出全部请求 —— 36 个无碍,600 个会瞬时触发交易所限流甚至封禁 IP。

**未被要求的(不做)**
- 不做历史数据存储或深度曲线
- 不改滑点/深度的计算口径
- 不为 SoDEX 独有品种编造对比数据

### Risks

- **限流封禁**:Binance depth limit=1000 权重为 20,83 个对即 1660 权重/周期,
  接近 2400/分钟预算;瞬时突发比总量更危险
- **内存**:600 本簿 × 1000 档,需按品种分级降档
- **1000X 前缀**:SoDEX 的 1000PEPE 与某些所的 PEPE / kPEPE 价格差 1000 倍。
  滑点(bps)与深度(USD 名义额)对倍数免疫,但**中间价列会显示成不可比的数值**
- **Binance WS 本地簿**:由 4 个变 83 个,每个无界增长,裁剪压力显著上升
- **首屏延迟**:冷启动时 600 次抓取未完成,大量品种无数据

### Plan

用户选定「分级 + 按需叠加」:

- tier-1(10 个主流)5 分钟 / 满档位 1000 / Binance 走 WS 本地簿
- tier-2(73 个长尾)20 分钟 / 降档 100
- 任一品种被打开且数据超过 5 分钟时,立即触发一次单品种刷新(同品种并发合并为一次)
- 每交易所独立并发闸门(OKX 4、其余 6-8),实测值而非估算

## Criteria

品种发现
- [x] ISC-1: 从 SoDEX /m/symbols 拉取合约清单
- [x] ISC-2: 仅保留 futureType 为 PERPETUAL 的合约
- [x] ISC-3: 仅保留 state 为 online 的合约
- [x] ISC-4: 清单按固定周期刷新而非仅启动时拉取
- [x] ISC-5: 清单拉取失败时回退到上一次成功结果
- [x] ISC-6: 清单为空时不清空既有品种表

跨所符号解析
- [x] ISC-7: CcxtAdapter 由 loadMarkets 动态解析基础资产
- [x] ISC-8: 同一基础资产存在多个报价币时按优先级选定
- [x] ISC-9: Aster 由 exchangeInfo 动态解析
- [x] ISC-10: Hyperliquid 由 meta 端点动态解析
- [x] ISC-11: OKX 由 instruments 动态解析
- [x] ISC-12: Bitget 由合约清单动态解析
- [x] ISC-13: EdgeX 由 getMetaData 动态解析(原假设其无清单端点,实测存在)
- [x] ISC-14: 某所不支持该品种时静默跳过不报错
- [x] ISC-15: 1000X 前缀品种的倍数差异被显式处理

采集与限流
- [x] ISC-16: 采集并发受上限约束而非一次性全发
- [x] ISC-17: 单个品种抓取失败不影响其余品种
- [x] ISC-18: 一个完整采集周期在刷新间隔内完成
- [x] ISC-19: 连续运行未出现交易所限流错误
- [x] ISC-20: 非主流品种使用更低档位以控制内存

接口
- [x] ISC-21: /pairs 返回全部品种而非硬编码四个
- [x] ISC-22: /pairs 标注每个品种可对比的交易所数
- [x] ISC-23: compare 接受任意 SoDEX 品种参数
- [x] ISC-24: 无效品种返回 400 且列出有效值来源
- [x] ISC-25: 仅 SoDEX 有的品种正常返回单行结果

界面
- [x] ISC-26: 品种选择器数据来自接口而非静态常量
- [x] ISC-27: 选择器搜索可命中全部品种
- [x] ISC-28: 热门品种行展示精选子集而非全部
- [x] ISC-29: 单一交易所品种不显示最优最差标记
- [x] ISC-30: 尚无数据的品种显示加载态而非空表

回归
- [x] ISC-31: 原有四个主流对的数据新鲜度未劣化

反标准
- [x] ISC-A1: 未新增 npm 依赖
- [x] ISC-A2: 滑点与深度计算口径未改动
- [x] ISC-A3: 未为任何品种编造缺失交易所的数据

## Decisions

## Verification

### 验证证据

| 项 | 证据 |
|----|------|
| ISC-1..6 | `/api/v1/pairs` 返回 83 个,tier-1 十个;仅 PERPETUAL+online;失败保留旧集 |
| ISC-7..15 | 全量 83 品种扫描:80 个多所对比中间价离散全部 <2%,0 异常 |
| ISC-16..20 | tier-1 十个品种 15.0s,tier-2 七十三个 65.0s;日志零限流错误 |
| ISC-21..25 | `/pairs` 带 comparable_exchanges;US500/SKHX/USTECH100 正常返回单行 |
| ISC-26..30 | 下拉 83 项可搜索,"TSL"→TSLA-PERP 5 家,"US500"→仅 SoDEX;热门行为 tier-1 |
| ISC-31 | tier-1 仍为 5 分钟满档,Binance WS 本地簿保留 |
| ISC-A1..A3 | 依赖未变;滑点深度口径未动;单交易所品种如实显示一行 |

### 本次暴露并修复的既有缺陷

1. **EdgeX 把 BNB 当成 SOL**:静态映射 `SOL: '10000004'`,而 10000004 是 `BNB2USD`,
   SOL 实为 10000003。EdgeX 的 SOL 报价一直是 BNB 的 600 美元而非 76 美元。改为按
   `coinList` 动态解析,并处理 EdgeX 的版本号后缀(BNB2 / 1000PEPE2)。
2. **Binance 季度合约覆盖永续**:`/fapi/v1/exchangeInfo` 同时返回 `BTCUSDT_251226`,
   带 1.5% 升水且 `baseAsset` 同为 BTC,按 base 建索引时把永续覆盖掉。已加
   `contractType === 'PERPETUAL'` 过滤。
3. **1000X 倍数未归一**:SoDEX 报每 1000 PEPE、Bitget 报每 PEPE、Hyperliquid 报 kPEPE、
   OKX 报裸 PEPE —— 同列中间价相差 1e6 倍。改为适配器统一归到单位价、采集器再按品种
   倍数缩放回去;名义额不变,滑点与深度不受影响。
