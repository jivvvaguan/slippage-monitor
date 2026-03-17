export type Locale = 'zh' | 'en';

export interface Translations {
  title: string;
  subtitle: string;
  pairLabel: string;
  pairSearch: string;
  amountLabel: string;
  customAmount: string;
  leverageLabel: string;
  exchange: string;
  midPrice: string;
  avgFillPrice: string;
  slippageBps: string;
  feeBps: string;
  totalCostBps: string;
  costPctPrincipal: string;
  depthUsed: string;
  best: string;
  worst: string;
  insufficientLiquidity: string;
  noData: string;
  dataAge: string;
  secondsAgo: string;
  refreshing: string;
  hotPairs: string;
  themeToggle: string;
  langToggle: string;
  loading: string;
  error: string;
  custom: string;
}

const zh: Translations = {
  title: '滑点监控',
  subtitle: '永续合约吃单成本实时比较',
  pairLabel: '交易对',
  pairSearch: '搜索交易对...',
  amountLabel: '名义金额 (USD)',
  customAmount: '自定义金额',
  leverageLabel: '杠杆',
  exchange: '交易所',
  midPrice: '中间价',
  avgFillPrice: '平均成交价',
  slippageBps: '滑点 (bps)',
  feeBps: '手续费 (bps)',
  totalCostBps: '总成本 (bps)',
  costPctPrincipal: '成本占保证金 %',
  depthUsed: '深度层数',
  best: '最优',
  worst: '最差',
  insufficientLiquidity: '流动性不足',
  noData: '暂无数据',
  dataAge: '数据更新',
  secondsAgo: '秒前',
  refreshing: '刷新中...',
  hotPairs: '热门交易对',
  themeToggle: '切换主题',
  langToggle: 'EN',
  loading: '加载中...',
  error: '加载失败',
  custom: '自定义',
};

const en: Translations = {
  title: 'Slippage Monitor',
  subtitle: 'Perps Taker Cost Real-time Comparison',
  pairLabel: 'Pair',
  pairSearch: 'Search pairs...',
  amountLabel: 'Notional (USD)',
  customAmount: 'Custom amount',
  leverageLabel: 'Leverage',
  exchange: 'Exchange',
  midPrice: 'Mid Price',
  avgFillPrice: 'Avg Fill',
  slippageBps: 'Slippage (bps)',
  feeBps: 'Fee (bps)',
  totalCostBps: 'Total Cost (bps)',
  costPctPrincipal: 'Cost % of Margin',
  depthUsed: 'Depth Levels',
  best: 'Best',
  worst: 'Worst',
  insufficientLiquidity: 'Insufficient Liquidity',
  noData: 'No data available',
  dataAge: 'Data age',
  secondsAgo: 's ago',
  refreshing: 'Refreshing...',
  hotPairs: 'Hot Pairs',
  themeToggle: 'Toggle Theme',
  langToggle: '中文',
  loading: 'Loading...',
  error: 'Failed to load',
  custom: 'Custom',
};

const translations: Record<Locale, Translations> = { zh, en };

export function getTranslations(locale: Locale): Translations {
  return translations[locale];
}
