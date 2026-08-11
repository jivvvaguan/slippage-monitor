---
task: 新增现货监控并与永续分页签管理
slug: 20260811-150733_sodex-spot-and-market-tabs
effort: advanced
phase: observe
progress: 0/30
mode: interactive
started: 2026-08-11T07:07:33Z
updated: 2026-08-11T07:20:00Z
---

## Context

当前只监控永续。用户要求接入 SoDEX 现货、与其他交易所现货对比,并把现货与永续拆成两个页签。

**SoDEX 现货 API(靠无头浏览器抓前端真实请求定位,官方文档与路径猜测均未命中)**

```
GET /api/v1/spot/markets/tickers                       33 个市场
GET /api/v1/spot/markets/{vBASE_vQUOTE}/orderbook      订单簿
符号格式  vBTC_vUSDC · vXAUt_vUSDC · WSOSO_vUSDC
响应      { blockTime, blockHeight, updateID, bids, asks }  bids/asks 为 [price, size] 字符串对
```

**可对比密度(实测五家现货清单)**

| 其他所覆盖 | 品种数 |
|---|---|
| 5 家 | 17 |
| 4 家 | 3 |
| 2 家 | 1 |
| 0 家 | 12 |

仅 SoDEX 有:AAPL MSFT GOOGL AMZN META NVDA TSLA TON 及四个指数代币
MAG7SSI DEFISSI MEMESSI USSI。

**与永续的关键差异 —— 不能照搬**

1. **美股在永续上普遍有,在现货上没有**。币安 746 个永续含 NVDA/TSLA/MSFT,但其现货不上
   代币化股票。因此现货页签的"仅 SoDEX"比例(12/33)远高于永续(3/83)。
2. **手续费率完全不同**:现货 taker 实测 Binance 10.0 / Bybit 10.0 / OKX 15.0 /
   Bitget 10.0 / MEXC 0.0 bps,而永续是 5-6 bps。必须按市场类型取费率,且现货应直接读
   ccxt 的 `market.taker` 而非写死。
3. **计价币不同**:SoDEX 现货全部 vUSDC,而各所现货主流对多为 USDT。需优先匹配 USDC 对,
   否则引入 USDT/USDC 基差。
4. **深度浅得多**:SoDEX 现货 BTC 仅 33/32 档,永续是上千档。

**未被要求的(不做)**
- 不做现货与永续之间的价差/基差分析
- 不改滑点与深度的计算口径
- 不接入 Hyperliquid 现货(其品种域为 HIP-1 代币,与本清单几乎无交集)

### Risks

- 市场类型若不进缓存键,现货与永续的同名品种(BTC)会互相覆盖
- Aster / EdgeX 为永续专有 DEX,无现货;适配器集合需按市场类型区分,否则空转报错
- 页签状态若不进 URL,刷新即丢失,分享链接指向错误市场
- 现货 12 个独有品种会让"最优/最差"标记失去意义,需与永续一致地抑制
- SoDEX 现货订单簿极浅,大额下单会普遍触发流动性不足,需确保该状态如实呈现而非报错

## Criteria

市场类型贯通
- [ ] ISC-1: 定义 perp 与 spot 两种市场类型
- [ ] ISC-2: 缓存按市场类型隔离,同名品种互不覆盖
- [ ] ISC-3: 品种注册表分别维护两套清单
- [ ] ISC-4: 采集器分别扫描两个市场
- [ ] ISC-5: 永续侧行为与改造前完全一致

SoDEX 现货适配器
- [ ] ISC-6: 由 markets/tickers 动态获取现货品种
- [ ] ISC-7: 符号 vBASE_vQUOTE 正确还原为基础资产
- [ ] ISC-8: WSOSO 前缀特例被正确解析
- [ ] ISC-9: 订单簿字符串价量正确转为数值
- [ ] ISC-10: 请求失败时返回空而不抛出

其他交易所现货
- [ ] ISC-11: CcxtAdapter 支持现货市场类型
- [ ] ISC-12: 现货优先匹配 USDC 计价对
- [ ] ISC-13: 现货费率取自交易所实际 taker 而非写死
- [ ] ISC-14: 永续专有交易所不参与现货采集
- [ ] ISC-15: 某所无该现货品种时静默跳过

接口
- [ ] ISC-16: pairs 接口按市场类型返回对应清单
- [ ] ISC-17: compare 接口接受市场类型参数
- [ ] ISC-18: all 接口接受市场类型参数
- [ ] ISC-19: 缺省市场类型时维持永续以兼容旧链接
- [ ] ISC-20: 非法市场类型返回 400

界面
- [ ] ISC-21: 页面顶部呈现现货与永续两个页签
- [ ] ISC-22: 切换页签后品种列表随之更换
- [ ] ISC-23: 切换页签后对比表数据随之更换
- [ ] ISC-24: 当前页签写入 URL 参数
- [ ] ISC-25: 带页签参数的链接刷新后仍停在该页签
- [ ] ISC-26: 切换页签时若品种不存在则回落到该市场首个品种
- [ ] ISC-27: 单一交易所品种不显示最优最差标记
- [ ] ISC-28: 页签标签具备中英文案

回归
- [ ] ISC-29: 现有永续 83 品种数量与数据未受影响
- [ ] ISC-30: tsc 与生产构建通过

反标准
- [ ] ISC-A1: 未新增 npm 依赖
- [ ] ISC-A2: 未用永续费率计算现货成本
- [ ] ISC-A3: 未为缺失交易所的现货品种编造数据

## Decisions

## Verification
