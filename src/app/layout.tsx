import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Perps Slippage Monitor — 永续合约滑点对比',
  description: '实时对比各交易所永续合约滑点成本，支持自定义下单金额。免费、公开、面向所有交易者。',
  openGraph: {
    title: 'Perps Slippage Monitor',
    description: '跨交易所永续合约滑点成本实时对比',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch(e) {}
            })();
          `
        }} />
      </head>
      <body className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-screen transition-colors">
        {children}
      </body>
    </html>
  );
}
