'use client';

import { useState } from 'react';
import Link from 'next/link';

type Lang = 'python' | 'javascript' | 'curl';

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/v1/slippage/compare',
    title: '跨交易所滑点对比',
    titleEn: 'Cross-exchange Slippage Comparison',
    description: '对比指定交易对在所有交易所的滑点成本',
    params: [
      { name: 'pair', type: 'string', required: true, desc: '交易对: BTC, ETH, SOL, GOLD' },
      { name: 'amount', type: 'number', required: true, desc: '下单名义金额 (USD)' },
      { name: 'leverage', type: 'number', required: false, desc: '杠杆倍率，默认 10' },
      { name: 'side', type: 'string', required: false, desc: 'buy 或 sell，默认 buy' },
    ],
    defaultParams: { pair: 'BTC', amount: '100000' } as Record<string, string>,
  },
  {
    method: 'GET',
    path: '/api/v1/slippage/all',
    title: '全部币对批量查询',
    titleEn: 'All Pairs Bulk Query',
    description: '一次返回所有交易对 × 所有交易所的滑点对比',
    params: [
      { name: 'amount', type: 'number', required: false, desc: '下单金额，默认 100000' },
      { name: 'leverage', type: 'number', required: false, desc: '杠杆倍率，默认 10' },
      { name: 'side', type: 'string', required: false, desc: 'buy 或 sell，默认 buy' },
    ],
    defaultParams: { amount: '100000' } as Record<string, string>,
  },
  {
    method: 'GET',
    path: '/api/v1/exchanges',
    title: '交易所列表',
    titleEn: 'Exchange List',
    description: '返回支持的交易所列表及费率信息',
    params: [],
    defaultParams: {},
  },
  {
    method: 'GET',
    path: '/api/v1/pairs',
    title: '交易对列表',
    titleEn: 'Pair List',
    description: '返回支持的交易对列表',
    params: [],
    defaultParams: {},
  },
  {
    method: 'GET',
    path: '/api/v1/status',
    title: '系统状态',
    titleEn: 'System Status',
    description: '返回系统状态及各交易所健康度',
    params: [],
    defaultParams: {},
  },
];

function getCodeExample(endpoint: typeof ENDPOINTS[0], lang: Lang): string {
  const url = `${BASE_URL || 'https://slippage.example.com'}${endpoint.path}`;
  const params = Object.entries(endpoint.defaultParams).map(([k, v]) => `${k}=${v}`).join('&');
  const fullUrl = params ? `${url}?${params}` : url;

  switch (lang) {
    case 'python':
      if (params) {
        return `import requests\n\nresponse = requests.get(\n    "${url}",\n    params={${Object.entries(endpoint.defaultParams).map(([k, v]) => `"${k}": ${isNaN(Number(v)) ? `"${v}"` : v}`).join(', ')}}\n)\ndata = response.json()\nprint(data["best_exchange"] if "best_exchange" in data else data)`;
      }
      return `import requests\n\nresponse = requests.get("${url}")\ndata = response.json()\nprint(data)`;
    case 'javascript':
      return `const res = await fetch("${fullUrl}");\nconst data = await res.json();\nconsole.log(data);`;
    case 'curl':
      return `curl "${fullUrl}"`;
  }
}

function TryItButton({ endpoint }: { endpoint: typeof ENDPOINTS[0] }) {
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paramValues, setParamValues] = useState<Record<string, string>>(endpoint.defaultParams);

  const handleTryIt = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(paramValues)) {
        if (v) params.set(k, v);
      }
      const url = `${endpoint.path}${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      setResponse(`Error: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      {endpoint.params.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {endpoint.params.map(p => (
            <div key={p.name} className="flex items-center gap-1">
              <label className="text-xs text-gray-400">{p.name}{p.required && '*'}:</label>
              <input
                type="text"
                value={paramValues[p.name] || ''}
                onChange={e => setParamValues(prev => ({ ...prev, [p.name]: e.target.value }))}
                placeholder={p.desc}
                className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 w-28"
              />
            </div>
          ))}
        </div>
      )}
      <button
        onClick={handleTryIt}
        disabled={loading}
        className="px-3 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Loading...' : 'Try it ▶'}
      </button>
      {response && (
        <pre className="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
          {response}
        </pre>
      )}
    </div>
  );
}

export default function DocsPage() {
  const [codeLang, setCodeLang] = useState<Lang>('curl');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Slippage Monitor API</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">v1 — Public REST API for perpetual futures slippage data</p>
        </div>
        <Link href="/" className="text-sm text-blue-500 hover:text-blue-400 transition-colors">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Quick Start */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">Quick Start</h2>
        <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg text-sm overflow-x-auto">
          <code>curl {`"${BASE_URL || 'https://slippage.example.com'}/api/v1/slippage/compare?pair=BTC&amount=100000"`}</code>
        </pre>
      </section>

      {/* Endpoints */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Endpoints</h2>
        <div className="space-y-6">
          {ENDPOINTS.map((ep, i) => (
            <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 text-xs font-mono rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                    {ep.method}
                  </span>
                  <code className="text-sm font-mono">{ep.path}</code>
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm font-medium">{ep.title}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{ep.description}</p>
                {ep.params.length > 0 && (
                  <div className="mt-3">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="text-left text-gray-400">
                          <th className="py-1 pr-4">Parameter</th>
                          <th className="py-1 pr-4">Type</th>
                          <th className="py-1 pr-4">Required</th>
                          <th className="py-1">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ep.params.map(p => (
                          <tr key={p.name} className="border-t border-gray-100 dark:border-gray-800">
                            <td className="py-1.5 pr-4 font-mono">{p.name}</td>
                            <td className="py-1.5 pr-4 text-gray-500">{p.type}</td>
                            <td className="py-1.5 pr-4">{p.required ? '✓' : '—'}</td>
                            <td className="py-1.5 text-gray-500">{p.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <TryItButton endpoint={ep} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Code Examples */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">Code Examples</h2>
        <div className="flex gap-2 mb-3">
          {(['python', 'javascript', 'curl'] as Lang[]).map(lang => (
            <button
              key={lang}
              onClick={() => setCodeLang(lang)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                codeLang === lang
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {lang === 'python' ? 'Python' : lang === 'javascript' ? 'JavaScript' : 'curl'}
            </button>
          ))}
        </div>
        <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg text-sm overflow-x-auto">
          <code>{getCodeExample(ENDPOINTS[0], codeLang)}</code>
        </pre>
      </section>

      {/* Rate Limiting */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">Rate Limiting</h2>
        <div className="prose dark:prose-invert text-sm max-w-none">
          <p>60 requests per minute per IP address.</p>
          <table className="text-xs">
            <thead>
              <tr><th>Header</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td className="font-mono">X-RateLimit-Limit</td><td>Maximum requests per window (60)</td></tr>
              <tr><td className="font-mono">X-RateLimit-Remaining</td><td>Remaining requests in window</td></tr>
              <tr><td className="font-mono">X-RateLimit-Reset</td><td>Unix timestamp when window resets</td></tr>
            </tbody>
          </table>
          <p className="mt-2">Exceeding the limit returns HTTP 429:</p>
          <pre className="p-3 bg-gray-900 text-red-400 rounded text-xs">{`{
  "error": "rate_limit_exceeded",
  "message": "Rate limit of 60 requests per minute exceeded",
  "retry_after_seconds": 23
}`}</pre>
        </div>
      </section>

      {/* Error Codes */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">Error Codes</h2>
        <table className="text-sm w-full">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 pr-4">HTTP Code</th>
              <th className="py-2 pr-4">Error</th>
              <th className="py-2">Description</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2 pr-4">400</td>
              <td className="py-2 pr-4 font-mono text-xs">invalid_pair</td>
              <td className="py-2">Invalid or unsupported trading pair</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2 pr-4">400</td>
              <td className="py-2 pr-4 font-mono text-xs">invalid_amount</td>
              <td className="py-2">Amount must be a positive number</td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2 pr-4">429</td>
              <td className="py-2 pr-4 font-mono text-xs">rate_limit_exceeded</td>
              <td className="py-2">Too many requests, retry after cooldown</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Data Notes */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">Data Notes</h2>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc list-inside">
          <li>Data refreshes every 5 minutes; responses include <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">data_age_seconds</code></li>
          <li>Slippage is calculated by simulating a market order against the live orderbook</li>
          <li>Fees reflect each exchange&apos;s base Taker fee (no VIP/token discounts)</li>
          <li>When <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">sufficient_liquidity=false</code>, the orderbook couldn&apos;t fill the full order</li>
        </ul>
      </section>

      {/* Footer */}
      <div className="text-center text-xs text-gray-400 mt-12 pb-8">
        Slippage Monitor v2 — Public API
      </div>
    </div>
  );
}
