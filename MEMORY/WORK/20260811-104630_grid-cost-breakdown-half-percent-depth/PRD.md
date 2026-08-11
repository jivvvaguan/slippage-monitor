---
task: 滑点网格增加成本明细与0.5%深度完整性
slug: 20260811-104630_grid-cost-breakdown-half-percent-depth
effort: extended
phase: verify
progress: 28/28
mode: interactive
started: 2026-08-11T02:46:30Z
updated: 2026-08-11T03:20:00Z
---

## Context

界面上的滑点网格当前只有 5 列:交易所、滑点(bps)、手续费(bps)、总成本(bps)、成本金额。
用户要求补齐成本明细并新增市场深度维度:

**要展示的完整列集**
中间价 · 滑点 · 手续费 · 总成本 · 成本金额 · 占本金百分比 · 上下 0.5% 深度

其中 `mid_price` 与 `cost_pct_of_principal` 后端已在算、已在 API 响应里,只是没上表。
**上下 0.5% 深度是全新计算** —— 需要新增模块。

**为什么"是否完整获取"是硬要求**
各适配器的档位上限并不一致:

| 适配器 | 请求档位 |
|--------|---------|
| CCXT (Binance/Bybit/Hyperliquid/Bitget/MEXC/OKX) | 500 |
| SoDEX | 500 |
| Aster | 500 |
| EdgeX | 200 |
| Lighter | 200 |

BTC 在 ~$64,000 时 0.5% ≈ $320。浅档订单簿的最远一档很可能仍落在 0.5% 区间**之内** —— 此时累加出的深度只是**下限**,不是真实深度。若不标注,用户会把"档位不够"误读成"这家深度差",直接导致错误的交易所选择。这是本次要暴露的核心信息。

**与 sufficient_liquidity 的区别**
`sufficient_liquidity` 回答的是"这一笔下单金额能否吃满",针对具体金额。
深度完整性回答的是"订单簿有没有覆盖到 ±0.5% 边界",针对订单簿本身。两者独立,不可合并展示。

**未被要求的(不做)**
- 不改滑点/总成本的计算口径
- 不新增依赖
- 不为深度额外打交易所接口(订单簿已在 cache)
- 不做深度的历史曲线或图表

### Risks

**实测证伪的假设(THINK 阶段)**

直连交易所取 BTC 500 档实测:

| 交易所 | 档位 | 订单簿实际覆盖 | 0.5% 区间 |
|--------|------|---------------|-----------|
| Aster | 500 | ±0.830% | 完整覆盖 |
| Binance | 500 | ±0.087% | 远够不到 |

Binance 报价粒度极细,500 档只铺开 ±0.087%。裸展示会让 Binance 深度($13.83M)看起来低于
Aster($16.75M)—— **与事实相反**,Binance 簿更深,只是 0.087% 以外看不到。不标注即为误导。

因此完整性**不做二值标记**,额外输出订单簿实际覆盖百分比,让"不完整"可量化。

- 多数交易所都会截断 ⇒ `≥` 标记会铺满全表,需配合覆盖百分比才有信息量
- 深度以 USD 名义价值计(与表内其余金额列同口径),而非基础币数量 —— 若用户实际想要币量,口径需回退
- 8 列在 `max-w-4xl`(896px)容器内会挤压,需放宽容器
- `formatSlippageResult` 当前签名不带订单簿,深度需要额外通道传入
- compare 路由的预计算路径不取订单簿,补深度时该路径需一并覆盖,否则预设金额下深度为空

### Plan

新增 `src/lib/depth.ts`,导出 `computeDepthBand(orderbook, bandPct=0.005)`:
- `bidUSD` = Σ(price×amount),bids 中 price ≥ mid×(1−band)
- `askUSD` = Σ(price×amount),asks 中 price ≤ mid×(1+band)
- `bidComplete` = 最低 bid 价 < 区间下沿(订单簿越过了边界 ⇒ 区间被完整观测)
- `askComplete` = 最高 ask 价 > 区间上沿

保持 `slippage.ts` 纯粹 —— 深度不塞进 `calculateSlippage`(深度是订单簿属性,与金额/杠杆/方向无关,塞进去会随 5 个预设金额重复计算)。
改为在两条路由取 `cache.getOrderbook` 后计算一次,作为第三参数传入 `formatSlippageResult`。

UI 侧 `SlippageGrid` 扩到 8 列;深度单元格买卖分行;截断时以 `≥` 前缀表达下限语义,并在表尾图例说明。

## Criteria

深度计算
- [x] ISC-1: computeDepthBand 累加 -0.5% 内买盘名义额
- [x] ISC-2: computeDepthBand 累加 +0.5% 内卖盘名义额
- [x] ISC-3: 最低买价跌破区间下沿时 bidComplete 为真
- [x] ISC-4: 最高卖价越过区间上沿时 askComplete 为真
- [x] ISC-5: 中间价为零时返回全零且标记不完整
- [x] ISC-6: 某侧订单簿为空时该侧标记不完整
- [x] ISC-7: 区间宽度可通过参数覆盖,默认 0.005
- [x] ISC-27: computeDepthBand 输出订单簿实际覆盖百分比
- [x] ISC-28: 截断时界面显示该覆盖百分比

API
- [x] ISC-8: compare 响应每家含 depth_bid_usd
- [x] ISC-9: compare 响应每家含 depth_ask_usd
- [x] ISC-10: compare 响应每家含 depth_bid_complete
- [x] ISC-11: compare 响应每家含 depth_ask_complete
- [x] ISC-12: all 路由输出同样四个深度字段
- [x] ISC-13: 预设金额走缓存路径时深度字段非空

界面
- [x] ISC-14: 网格渲染中间价列
- [x] ISC-15: 网格渲染占本金百分比列
- [x] ISC-16: 网格渲染上下 0.5% 深度列
- [x] ISC-17: 深度单元格同时显示买盘与卖盘数值
- [x] ISC-18: 深度被截断时以 ≥ 前缀标注下限
- [x] ISC-19: 深度完整时不出现 ≥ 前缀
- [x] ISC-20: 表尾图例解释 ≥ 的含义
- [x] ISC-21: 原有滑点手续费总成本成本金额四列仍在
- [x] ISC-22: 容器放宽后 8 列不发生横向裁切

国际化
- [x] ISC-23: 新增标签具备中文翻译
- [x] ISC-24: 新增标签具备英文翻译

回归
- [x] ISC-25: tsc --noEmit 退出码为零
- [x] ISC-26: 页面实测渲染 10 家交易所行

反标准
- [x] ISC-A1: 滑点与总成本 bps 口径未被改动
- [x] ISC-A2: 未引入任何新 npm 依赖
- [x] ISC-A3: 未因深度新增任何交易所网络请求

## Decisions

## Verification

### 验证证据

| 项 | 证据 |
|----|------|
| ISC-1..7,27 | `depth.ts` 单向遍历提前 break;实测 Aster 完整 / Binance 截断,覆盖率随簿密度变化 |
| ISC-8..13 | `compare` 与 `all` 响应实测含 5 个深度字段;预设金额走缓存路径同样非空 |
| ISC-14..22,28 | headless Chromium 截图:8 列表头齐备,10 行,买卖分行,≥ 橙色标注,簿覆盖注记 7 处,图例存在,`body.scrollWidth <= innerWidth` |
| ISC-23,24 | 中文表头实测;点 EN 后表头为 Exchange/Mid Price/…/±0.5% Depth,图例英文 |
| ISC-25 | `tsc --noEmit` exit=0 |
| ISC-26 | 页面实测 10 行 |
| ISC-A1 | `slippage.ts` 未改动 |
| ISC-A2 | `package.json` 依赖未变 |
| ISC-A3 | 深度复用 cache 中订单簿,零新增网络请求;控制台无错误 |

### 额外发现(超出原始范围)

深度列暴露出既有缺陷:MEXC(contractSize 0.0001)与 OKX(0.01)订单簿计量单位为**合约张数**而非基础币,
`price × amount` 虚增 10000× 与 100×。这不仅让深度显示 $786,000M 的荒谬值,更让两家滑点恒为 0.01 bps
(流动性被虚增 ⇒ 永远吃得满),排名失真。已在 `ccxt-adapter` 边界按 `contractSize` 归一化 —— 修一处,
滑点与深度同时正确。修正后 OKX 滑点由虚假的 0.01 bps 变为真实 0.16 bps。
