'use client';

import { useState, useCallback } from 'react';

// --- Types ---

interface EndpointParam {
  name: string;
  required: boolean;
  type: string;
  description: string;
  defaultValue?: string;
  example?: string;
}

interface EndpointDef {
  id: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  params: EndpointParam[];
  exampleResponse: string;
}

// --- Endpoint definitions ---

const ENDPOINTS: EndpointDef[] = [
  {
    id: 'status',
    method: 'GET',
    path: '/api/v1/status',
    summary: 'System status',
    description:
      'Returns overall system health, uptime, and per-exchange status. Use this to check if the monitor is running and which exchanges are responding.',
    params: [],
    exampleResponse: JSON.stringify(
      {
        status: 'healthy',
        uptimeSeconds: 3600,
        lastRefreshAt: '2026-03-17T12:00:00.000Z',
        exchanges: [
          { name: 'binance', status: 'up', dataAgeSeconds: 5 },
          { name: 'bybit', status: 'up', dataAgeSeconds: 5 },
          { name: 'hyperliquid', status: 'up', dataAgeSeconds: 8 },
          { name: 'lighter', status: 'up', dataAgeSeconds: 6 },
        ],
        data_age_seconds: 5,
        next_refresh_seconds: 5,
      },
      null,
      2,
    ),
  },
  {
    id: 'exchanges',
    method: 'GET',
    path: '/api/v1/exchanges',
    summary: 'List exchanges',
    description:
      'Returns all monitored exchanges with their taker fee rate and current operational status.',
    params: [],
    exampleResponse: JSON.stringify(
      {
        exchanges: [
          { name: 'binance', takerFeeBps: 4.5, status: 'up', lastFetchedAt: 1710676800000, dataAgeSeconds: 5 },
          { name: 'bybit', takerFeeBps: 5.5, status: 'up', lastFetchedAt: 1710676800000, dataAgeSeconds: 5 },
        ],
        data_age_seconds: 5,
        next_refresh_seconds: 5,
      },
      null,
      2,
    ),
  },
  {
    id: 'pairs',
    method: 'GET',
    path: '/api/v1/pairs',
    summary: 'List supported pairs',
    description: 'Returns all configured trading pairs that the monitor tracks.',
    params: [],
    exampleResponse: JSON.stringify(
      {
        pairs: ['BTC', 'ETH', 'SOL', 'XAUT'],
        total: 4,
        data_age_seconds: 5,
        next_refresh_seconds: 5,
      },
      null,
      2,
    ),
  },
  {
    id: 'slippage-all',
    method: 'GET',
    path: '/api/v1/slippage/all',
    summary: 'All slippage data',
    description:
      'Returns slippage data for all pairs across all exchanges at preset notional sizes (10K, 50K, 100K, 500K USD). Pass a custom amount to compute on-demand for a specific size.',
    params: [
      {
        name: 'amount',
        required: false,
        type: 'number',
        description: 'Custom notional amount in USD (1 to 10,000,000). If omitted, returns preset amounts.',
        example: '100000',
      },
    ],
    exampleResponse: JSON.stringify(
      {
        pairs: ['BTC', 'ETH', 'SOL', 'XAUT'],
        exchanges: ['binance', 'bybit', 'hyperliquid', 'lighter'],
        amounts: [10000, 50000, 100000, 500000],
        results: [
          {
            pair: 'BTC',
            exchange: 'binance',
            amountUSD: 100000,
            midPrice: 67500.5,
            avgFillPrice: 67502.3,
            slippageBps: 0.27,
            feeBps: 4.5,
            totalCostBps: 4.77,
            costPctOfPrincipal: 0.477,
            insufficientLiquidity: false,
            orderbookDepthUsed: 3,
          },
        ],
        total: 64,
        data_age_seconds: 5,
        next_refresh_seconds: 5,
      },
      null,
      2,
    ),
  },
  {
    id: 'slippage-compare',
    method: 'GET',
    path: '/api/v1/slippage/compare',
    summary: 'Compare slippage across exchanges',
    description:
      'Compare slippage for a specific pair across all exchanges at a given notional size. Returns best and worst exchange for execution cost.',
    params: [
      {
        name: 'pair',
        required: true,
        type: 'string',
        description: 'Trading pair symbol (e.g., BTC, ETH, SOL)',
        example: 'BTC',
      },
      {
        name: 'amount',
        required: false,
        type: 'number',
        description: 'Notional amount in USD (1 to 10,000,000). Defaults to 100,000.',
        defaultValue: '100000',
        example: '100000',
      },
    ],
    exampleResponse: JSON.stringify(
      {
        pair: 'BTC',
        amountUSD: 100000,
        exchanges: [
          {
            exchange: 'binance',
            midPrice: 67500.5,
            avgFillPrice: 67502.3,
            slippageBps: 0.27,
            feeBps: 4.5,
            totalCostBps: 4.77,
            costPctOfPrincipal: 0.477,
            insufficientLiquidity: false,
            orderbookDepthUsed: 3,
          },
          {
            exchange: 'bybit',
            midPrice: 67498.0,
            avgFillPrice: 67503.1,
            slippageBps: 0.76,
            feeBps: 5.5,
            totalCostBps: 6.26,
            costPctOfPrincipal: 0.626,
            insufficientLiquidity: false,
            orderbookDepthUsed: 5,
          },
        ],
        best: { exchange: 'binance', totalCostBps: 4.77 },
        worst: { exchange: 'bybit', totalCostBps: 6.26 },
        data_age_seconds: 5,
        next_refresh_seconds: 5,
      },
      null,
      2,
    ),
  },
];

// --- Code example generators ---

function curlExample(endpoint: EndpointDef, baseUrl: string): string {
  let url = `${baseUrl}${endpoint.path}`;
  const requiredParams = endpoint.params.filter((p) => p.required);
  const optionalParams = endpoint.params.filter((p) => !p.required);

  if (requiredParams.length > 0 || optionalParams.length > 0) {
    const parts: string[] = [];
    for (const p of requiredParams) {
      parts.push(`${p.name}=${p.example ?? 'VALUE'}`);
    }
    for (const p of optionalParams) {
      if (p.example) parts.push(`${p.name}=${p.example}`);
    }
    if (parts.length > 0) url += `?${parts.join('&')}`;
  }

  return `curl "${url}"`;
}

function pythonExample(endpoint: EndpointDef, baseUrl: string): string {
  let url = `${baseUrl}${endpoint.path}`;
  const hasParams = endpoint.params.length > 0;

  if (!hasParams) {
    return `import requests

response = requests.get("${url}")
data = response.json()
print(data)`;
  }

  const paramLines = endpoint.params.map((p) => {
    const val = p.example ?? (p.type === 'number' ? '100000' : '"VALUE"');
    const pyVal = p.type === 'number' ? val : `"${val}"`;
    return `    "${p.name}": ${pyVal},`;
  });

  return `import requests

params = {
${paramLines.join('\n')}
}

response = requests.get("${url}", params=params)
data = response.json()
print(data)`;
}

function jsExample(endpoint: EndpointDef, baseUrl: string): string {
  let url = `${baseUrl}${endpoint.path}`;
  const hasParams = endpoint.params.length > 0;

  if (!hasParams) {
    return `const response = await fetch("${url}");
const data = await response.json();
console.log(data);`;
  }

  const paramEntries = endpoint.params.map((p) => {
    const val = p.example ?? (p.type === 'number' ? '100000' : 'VALUE');
    return `  ${p.name}: "${val}",`;
  });

  return `const params = new URLSearchParams({
${paramEntries.join('\n')}
});

const response = await fetch(\`${url}?\${params}\`);
const data = await response.json();
console.log(data);`;
}

// --- Components ---

type Lang = 'curl' | 'python' | 'javascript';

function CodeExamples({ endpoint, baseUrl }: { endpoint: EndpointDef; baseUrl: string }) {
  const [lang, setLang] = useState<Lang>('curl');

  const code =
    lang === 'curl'
      ? curlExample(endpoint, baseUrl)
      : lang === 'python'
        ? pythonExample(endpoint, baseUrl)
        : jsExample(endpoint, baseUrl);

  return (
    <div className="code-examples">
      <div className="params-label">Code Examples</div>
      <div className="code-lang-tabs">
        {(['curl', 'python', 'javascript'] as Lang[]).map((l) => (
          <button
            key={l}
            className={`code-lang-tab${lang === l ? ' active' : ''}`}
            onClick={() => setLang(l)}
          >
            {l === 'javascript' ? 'JavaScript' : l === 'python' ? 'Python' : 'curl'}
          </button>
        ))}
      </div>
      <div className="code-block">
        <pre>{code}</pre>
      </div>
    </div>
  );
}

interface TryItResponse {
  status: number;
  statusText: string;
  body: string;
  timeMs: number;
}

function TryItPanel({ endpoint }: { endpoint: EndpointDef }) {
  const [paramValues, setParamValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const p of endpoint.params) {
      initial[p.name] = p.example ?? p.defaultValue ?? '';
    }
    return initial;
  });
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<TryItResponse | null>(null);

  const buildUrl = useCallback(() => {
    let url = endpoint.path;
    const parts: string[] = [];
    for (const p of endpoint.params) {
      const val = paramValues[p.name];
      if (val) parts.push(`${encodeURIComponent(p.name)}=${encodeURIComponent(val)}`);
    }
    if (parts.length > 0) url += `?${parts.join('&')}`;
    return url;
  }, [endpoint, paramValues]);

  const execute = useCallback(async () => {
    setLoading(true);
    setResponse(null);
    const url = buildUrl();
    const start = performance.now();
    try {
      const res = await fetch(url);
      const timeMs = Math.round(performance.now() - start);
      const text = await res.text();
      let formatted: string;
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        formatted = text;
      }
      setResponse({ status: res.status, statusText: res.statusText, body: formatted, timeMs });
    } catch (err) {
      const timeMs = Math.round(performance.now() - start);
      setResponse({
        status: 0,
        statusText: 'Network Error',
        body: err instanceof Error ? err.message : 'Request failed',
        timeMs,
      });
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  if (!isOpen) {
    return (
      <div className="try-it-section">
        <button className="try-it-btn" onClick={() => setIsOpen(true)}>
          Try It
        </button>
      </div>
    );
  }

  return (
    <div className="try-it-section">
      <button className="try-it-btn" onClick={() => setIsOpen(false)}>
        Close
      </button>
      <div className="try-it-panel">
        {endpoint.params.length > 0 && (
          <div className="try-it-inputs">
            {endpoint.params.map((p) => (
              <div key={p.name} className="try-it-input-group">
                <label>
                  {p.name} {p.required && <span className="param-required">required</span>}
                </label>
                <input
                  type="text"
                  value={paramValues[p.name] ?? ''}
                  placeholder={p.example ?? p.name}
                  onChange={(e) =>
                    setParamValues((prev) => ({ ...prev, [p.name]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        )}
        <div className="try-it-actions">
          <button className="try-it-btn" onClick={execute} disabled={loading}>
            {loading ? 'Sending...' : 'Send Request'}
          </button>
          <span className="try-it-url">{buildUrl()}</span>
        </div>
        {loading && <div className="try-it-loading">Sending request...</div>}
        {response && (
          <div className="try-it-response">
            <div className="try-it-response-header">
              <span className={`try-it-status ${response.status >= 200 && response.status < 300 ? 'success' : 'error'}`}>
                {response.status} {response.statusText}
              </span>
              <span className="try-it-time">{response.timeMs}ms</span>
            </div>
            <pre>{response.body}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function EndpointCard({ endpoint, baseUrl }: { endpoint: EndpointDef; baseUrl: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="endpoint-card" id={`endpoint-${endpoint.id}`}>
      <div className="endpoint-header" onClick={() => setExpanded(!expanded)}>
        <span className="endpoint-method">{endpoint.method}</span>
        <span className="endpoint-path">{endpoint.path}</span>
        <span className="endpoint-summary">{endpoint.summary}</span>
        <span className={`endpoint-toggle${expanded ? ' open' : ''}`}>&#9660;</span>
      </div>
      {expanded && (
        <div className="endpoint-body">
          <p className="endpoint-description">{endpoint.description}</p>

          {endpoint.params.length > 0 && (
            <div className="params-table-wrap">
              <div className="params-label">Parameters</div>
              <table className="params-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Required</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoint.params.map((p) => (
                    <tr key={p.name}>
                      <td>{p.name}</td>
                      <td>{p.type}</td>
                      <td>
                        {p.required ? (
                          <span className="param-required">Yes</span>
                        ) : (
                          <span className="param-optional">No</span>
                        )}
                      </td>
                      <td>{p.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <CodeExamples endpoint={endpoint} baseUrl={baseUrl} />

          <div className="example-response">
            <div className="example-response-label">Example Response</div>
            <pre>{endpoint.exampleResponse}</pre>
          </div>

          <TryItPanel endpoint={endpoint} />
        </div>
      )}
    </div>
  );
}

// --- Main Component ---

export default function DocsContent() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="docs-container">
      <a href="/" className="docs-back-link">
        &#8592; Back to Dashboard
      </a>

      <div className="docs-header">
        <h1>Slippage Monitor API</h1>
        <p className="docs-version">
          Version <code>v1</code> &middot; Base URL: <code>/api/v1</code> &middot; Read-only, no authentication required
        </p>
      </div>

      {/* Navigation */}
      <nav className="docs-nav">
        <div className="docs-nav-title">Quick Navigation</div>
        <ul className="docs-nav-list">
          <li><a href="#endpoints">Endpoints</a></li>
          <li><a href="#rate-limits">Rate Limits</a></li>
          <li><a href="#error-codes">Error Codes</a></li>
          <li><a href="#methodology">Methodology</a></li>
          <li><a href="#openapi-spec">OpenAPI Spec</a></li>
        </ul>
      </nav>

      {/* Endpoints Section */}
      <section className="docs-section" id="endpoints">
        <h2>Endpoints</h2>
        <p>All endpoints use HTTP GET. No authentication is required. Responses are JSON with CORS headers.</p>
        {ENDPOINTS.map((ep) => (
          <EndpointCard key={ep.id} endpoint={ep} baseUrl={baseUrl} />
        ))}
      </section>

      {/* Rate Limits Section */}
      <section className="docs-section" id="rate-limits">
        <h2>Rate Limits</h2>
        <div className="reference-card">
          <h4>Request Limits</h4>
          <p>
            The API enforces a rate limit of <strong>60 requests per minute</strong> per IP address.
            The window resets every 60 seconds. Exceeding this limit returns a <code>429</code> response.
          </p>

          <h4>Rate Limit Headers</h4>
          <p>Every response includes these headers:</p>
          <ul>
            <li>
              <code>X-RateLimit-Limit</code> — Maximum requests allowed per window (60)
            </li>
            <li>
              <code>X-RateLimit-Remaining</code> — Requests remaining in current window
            </li>
            <li>
              <code>X-RateLimit-Reset</code> — Unix timestamp when the window resets
            </li>
          </ul>
        </div>
      </section>

      {/* Error Codes Section */}
      <section className="docs-section" id="error-codes">
        <h2>Error Codes</h2>
        <div className="reference-card">
          <h4>Error Response Format</h4>
          <p>All errors return a JSON object with <code>error</code> (machine-readable code) and <code>message</code> (human-readable description):</p>
          <div className="example-response">
            <pre>{JSON.stringify({ error: 'INVALID_AMOUNT', message: 'Amount must be a positive number between 1 and 10,000,000 USD.' }, null, 2)}</pre>
          </div>

          <h4>HTTP Status Codes</h4>
          <table className="error-code-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Error Code</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>400</td>
                <td><code>MISSING_PARAM</code></td>
                <td>Required query parameter is missing</td>
              </tr>
              <tr>
                <td>400</td>
                <td><code>INVALID_PAIR</code></td>
                <td>Pair is not in the configured list</td>
              </tr>
              <tr>
                <td>400</td>
                <td><code>INVALID_AMOUNT</code></td>
                <td>Amount is out of valid range (1 to 10,000,000)</td>
              </tr>
              <tr>
                <td>429</td>
                <td><code>RATE_LIMIT_EXCEEDED</code></td>
                <td>More than 60 requests per minute from this IP</td>
              </tr>
              <tr>
                <td>500</td>
                <td><code>INTERNAL_ERROR</code></td>
                <td>Unexpected server error</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Data Sources & Methodology */}
      <section className="docs-section" id="methodology">
        <h2>Data Sources &amp; Methodology</h2>
        <div className="reference-card">
          <h4>Data Sources</h4>
          <p>
            All data is sourced from <strong>public orderbook endpoints</strong> on each exchange. No API keys are used
            — only publicly available market data. The monitor fetches live orderbook depth (up to 500 levels) for
            perpetual futures contracts every 10 seconds.
          </p>
          <p>
            Supported exchanges: Binance, Bybit, Hyperliquid, Lighter, and more via CCXT adapters. Each exchange
            adapter normalizes the orderbook into a standard format with bids (descending) and asks (ascending) sorted
            by price.
          </p>

          <h4>Slippage Calculation</h4>
          <p>
            Slippage is computed by <strong>simulating a market buy order</strong> against the live orderbook asks.
            The algorithm walks the orderbook level by level, consuming liquidity until the target notional amount
            (in USD) is filled.
          </p>
          <div className="formula-block">
            mid_price = (best_bid + best_ask) / 2<br />
            avg_fill_price = total_cost / total_quantity<br />
            slippage_bps = ((avg_fill_price - mid_price) / mid_price) * 10,000<br />
            <br />
            total_cost_bps = slippage_bps + fee_bps<br />
            cost_pct_of_principal = (total_cost_bps / 10,000) * leverage * 100
          </div>
          <p>
            <strong>slippage_bps</strong> measures how much worse the average fill price is compared to the mid price,
            in basis points (1 bps = 0.01%).
          </p>
          <p>
            <strong>fee_bps</strong> is the exchange&apos;s taker fee rate, applied to the full notional amount.
          </p>
          <p>
            <strong>total_cost_bps</strong> is the all-in execution cost: slippage plus fees.
          </p>
          <p>
            <strong>cost_pct_of_principal</strong> shows what percentage of your principal (margin) the execution
            cost represents, accounting for leverage. At 10x leverage, 5 bps of total cost = 0.5% of principal.
          </p>

          <h4>Insufficient Liquidity</h4>
          <p>
            If the orderbook does not contain enough depth to fill the requested notional amount, the result is flagged
            with <code>insufficientLiquidity: true</code>. The slippage figure in this case represents a partial fill
            and may understate the true cost of execution.
          </p>

          <h4>Data Freshness</h4>
          <p>
            Every API response includes <code>data_age_seconds</code> indicating how many seconds ago the orderbook
            data was last refreshed, and <code>next_refresh_seconds</code> indicating when the next refresh will occur.
            The default refresh interval is 10 seconds.
          </p>
        </div>
      </section>

      {/* OpenAPI Spec Download */}
      <section className="docs-section" id="openapi-spec">
        <h2>OpenAPI Specification</h2>
        <div className="download-section">
          <a href="/openapi.yaml" download className="download-link">
            &#11015; Download OpenAPI YAML
          </a>
          <span className="download-desc">
            OpenAPI 3.0.3 specification — import into Postman, Swagger UI, or any API tool.
          </span>
        </div>
      </section>
    </div>
  );
}
