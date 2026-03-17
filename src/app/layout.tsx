import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '滑点监控 | Slippage Monitor - 永续合约吃单成本实时比较',
  description:
    '实时比较各大交易所永续合约的滑点和吃单成本。支持 Binance、Bybit、Hyperliquid、Lighter 等交易所，覆盖 BTC、ETH、SOL 等主流交易对。',
  keywords: ['slippage', 'monitor', 'perpetual futures', 'taker cost', 'orderbook depth', 'exchange comparison'],
  openGraph: {
    title: '滑点监控 | Slippage Monitor',
    description: '永续合约吃单成本实时比较 - Real-time perps taker cost comparison across exchanges',
    type: 'website',
    locale: 'zh_CN',
    alternateLocale: 'en_US',
    siteName: 'Slippage Monitor',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Slippage Monitor - Perps Taker Cost Comparison',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '滑点监控 | Slippage Monitor',
    description: '永续合约吃单成本实时比较',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Slippage Monitor',
    description: 'Real-time perpetual futures slippage and taker cost comparison across exchanges',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
