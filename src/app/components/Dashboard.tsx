'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { type Locale, getTranslations } from '@/lib/i18n';

// --- Types ---

interface ExchangeResult {
  exchange: string;
  midPrice: number;
  avgFillPrice: number;
  slippageBps: number;
  feeBps: number;
  totalCostBps: number;
  costPctOfPrincipal: number;
  insufficientLiquidity: boolean;
  orderbookDepthUsed: number;
}

interface CompareResponse {
  pair: string;
  amountUSD: number;
  exchanges: ExchangeResult[];
  best: { exchange: string; totalCostBps: number } | null;
  worst: { exchange: string; totalCostBps: number } | null;
  data_age_seconds: number;
  next_refresh_seconds: number;
}

// --- Constants ---

const PRESET_AMOUNTS = [10_000, 50_000, 100_000, 500_000, 1_000_000];
const HOT_PAIRS = ['BTC', 'ETH', 'SOL', 'GOLD', 'XRP', 'DOGE', 'ARB'];
const DEFAULT_PAIR = 'BTC';
const DEFAULT_AMOUNT = 100_000;
const DEFAULT_LEVERAGE = 10;
const REFRESH_INTERVAL_MS = 10_000;

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1_000) return `${n / 1_000}K`;
  return String(n);
}

function formatNumber(n: number, decimals: number = 2): string {
  return n.toFixed(decimals);
}

function formatPrice(n: number): string {
  if (n === 0) return '-';
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- State ---
  const [pair, setPair] = useState<string>(
    searchParams.get('pair')?.toUpperCase() || DEFAULT_PAIR,
  );
  const [amount, setAmount] = useState<number>(() => {
    const amt = searchParams.get('amount');
    if (amt) {
      const n = Number(amt);
      if (!isNaN(n) && n > 0) return n;
    }
    return DEFAULT_AMOUNT;
  });
  const [leverage, setLeverage] = useState<number>(() => {
    const lev = searchParams.get('leverage');
    if (lev) {
      const n = Number(lev);
      if (!isNaN(n) && n >= 1 && n <= 100) return n;
    }
    return DEFAULT_LEVERAGE;
  });
  const [locale, setLocale] = useState<Locale>('zh');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pairDropdownOpen, setPairDropdownOpen] = useState(false);
  const [pairSearch, setPairSearch] = useState('');
  const [availablePairs, setAvailablePairs] = useState<string[]>([]);
  const [dataAge, setDataAge] = useState<number>(0);
  const [customAmountInput, setCustomAmountInput] = useState('');
  const [isCustomAmount, setIsCustomAmount] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFetchRef = useRef<number>(Date.now());

  const t = useMemo(() => getTranslations(locale), [locale]);

  // --- Theme init ---
  useEffect(() => {
    const saved = localStorage.getItem('slippage-theme');
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('slippage-theme', theme);
  }, [theme]);

  // --- Locale init ---
  useEffect(() => {
    const saved = localStorage.getItem('slippage-locale');
    if (saved === 'zh' || saved === 'en') {
      setLocale(saved as Locale);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('slippage-locale', locale);
  }, [locale]);

  // --- Fetch available pairs ---
  useEffect(() => {
    fetch('/api/v1/pairs')
      .then((res) => res.json())
      .then((d) => {
        if (d.pairs) setAvailablePairs(d.pairs);
      })
      .catch(() => {});
  }, []);

  // --- URL sync ---
  useEffect(() => {
    const params = new URLSearchParams();
    if (pair !== DEFAULT_PAIR) params.set('pair', pair);
    if (amount !== DEFAULT_AMOUNT) params.set('amount', String(amount));
    if (leverage !== DEFAULT_LEVERAGE) params.set('leverage', String(leverage));
    const qs = params.toString();
    const newUrl = qs ? `?${qs}` : '/';
    router.replace(newUrl, { scroll: false });
  }, [pair, amount, leverage, router]);

  // --- Fetch slippage data ---
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/slippage/compare?pair=${pair}&amount=${amount}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Request failed' }));
        setError(err.message || `HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      const json: CompareResponse = await res.json();
      setData(json);
      setDataAge(json.data_age_seconds);
      lastFetchRef.current = Date.now();
      setError(null);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [pair, amount]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // --- Auto refresh ---
  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      fetchData();
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [fetchData]);

  // --- Data age ticker ---
  useEffect(() => {
    ageTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - lastFetchRef.current) / 1000;
      setDataAge((prev) => {
        const base = data?.data_age_seconds ?? 0;
        return Math.round((base + elapsed) * 10) / 10;
      });
    }, 1000);
    return () => {
      if (ageTimerRef.current) clearInterval(ageTimerRef.current);
    };
  }, [data]);

  // --- Click outside dropdown ---
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPairDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // --- Debounced custom amount ---
  useEffect(() => {
    if (!isCustomAmount || !customAmountInput) return;
    const n = Number(customAmountInput);
    if (isNaN(n) || n <= 0) return;

    const timer = setTimeout(() => {
      setAmount(n);
    }, 300);
    return () => clearTimeout(timer);
  }, [customAmountInput, isCustomAmount]);

  // --- Recalculate cost % with leverage ---
  const recalcCostPct = useCallback(
    (totalCostBps: number): number => {
      return Math.round(((totalCostBps / 10000) * leverage * 100) * 1000) / 1000;
    },
    [leverage],
  );

  // --- Sorted results ---
  const sortedExchanges = useMemo(() => {
    if (!data) return [];
    return [...data.exchanges].sort((a, b) => {
      if (a.insufficientLiquidity && !b.insufficientLiquidity) return 1;
      if (!a.insufficientLiquidity && b.insufficientLiquidity) return -1;
      return a.totalCostBps - b.totalCostBps;
    });
  }, [data]);

  // --- Filtered pairs for dropdown ---
  const filteredPairs = useMemo(() => {
    const allPairs = availablePairs.length > 0 ? availablePairs : HOT_PAIRS;
    if (!pairSearch) return allPairs;
    const q = pairSearch.toUpperCase();
    return allPairs.filter((p) => p.includes(q));
  }, [availablePairs, pairSearch]);

  // --- Handlers ---
  function handlePairSelect(p: string) {
    setPair(p);
    setPairDropdownOpen(false);
    setPairSearch('');
  }

  function handlePresetAmount(a: number) {
    setIsCustomAmount(false);
    setCustomAmountInput('');
    setAmount(a);
  }

  function handleCustomAmountFocus() {
    setIsCustomAmount(true);
  }

  // --- Render ---
  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        <div className="header-right">
          <button
            className="toggle-btn"
            onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
            title={t.langToggle}
          >
            {t.langToggle}
          </button>
          <button
            className="toggle-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={t.themeToggle}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Controls */}
      <div className="controls">
        {/* Pair selector */}
        <div className="control-group">
          <label>{t.pairLabel}</label>
          <div className="pair-selector" ref={dropdownRef}>
            <button
              className="pair-selector-trigger"
              onClick={() => setPairDropdownOpen(!pairDropdownOpen)}
            >
              {pair}
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {pairDropdownOpen && (
              <div className="pair-dropdown">
                <input
                  className="pair-dropdown-search"
                  type="text"
                  placeholder={t.pairSearch}
                  value={pairSearch}
                  onChange={(e) => setPairSearch(e.target.value)}
                  autoFocus
                />
                <div className="pair-dropdown-list">
                  {filteredPairs.map((p) => (
                    <div
                      key={p}
                      className={`pair-dropdown-item${p === pair ? ' active' : ''}`}
                      onClick={() => handlePairSelect(p)}
                    >
                      {p}
                    </div>
                  ))}
                  {filteredPairs.length === 0 && (
                    <div className="pair-dropdown-item" style={{ color: 'var(--text-muted)' }}>
                      {t.noData}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Amount buttons */}
        <div className="control-group">
          <label>{t.amountLabel}</label>
          <div className="amount-buttons">
            {PRESET_AMOUNTS.map((a) => (
              <button
                key={a}
                className={`amount-btn${!isCustomAmount && amount === a ? ' active' : ''}`}
                onClick={() => handlePresetAmount(a)}
              >
                {formatAmount(a)}
              </button>
            ))}
            <input
              className="custom-amount-input"
              type="number"
              placeholder={t.customAmount}
              value={customAmountInput}
              onChange={(e) => setCustomAmountInput(e.target.value)}
              onFocus={handleCustomAmountFocus}
              min={1}
              max={10000000}
            />
          </div>
        </div>

        {/* Leverage */}
        <div className="control-group">
          <label>{t.leverageLabel}</label>
          <div className="leverage-control">
            <span className="leverage-value">{leverage}x</span>
            <input
              className="leverage-slider"
              type="range"
              min={1}
              max={100}
              step={1}
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Data freshness */}
      <div className="data-freshness">
        <span className={`freshness-dot${dataAge > 60 ? ' stale' : ''}`} />
        <span>
          {t.dataAge}: {formatNumber(dataAge, 1)}{t.secondsAgo}
        </span>
      </div>

      {/* Table */}
      {loading && !data ? (
        <div className="loading-state">{t.loading}</div>
      ) : error ? (
        <div className="no-data">{t.error}: {error}</div>
      ) : sortedExchanges.length === 0 ? (
        <div className="no-data">{t.noData}</div>
      ) : (
        <div className="table-wrapper">
          <table className="slippage-table">
            <thead>
              <tr>
                <th>{t.exchange}</th>
                <th>{t.midPrice}</th>
                <th>{t.slippageBps}</th>
                <th>{t.feeBps}</th>
                <th>{t.totalCostBps}</th>
                <th>{t.costPctPrincipal}</th>
                <th>{t.depthUsed}</th>
              </tr>
            </thead>
            <tbody>
              {sortedExchanges.map((ex) => {
                const isBest = data?.best?.exchange === ex.exchange && !ex.insufficientLiquidity;
                const isWorst = data?.worst?.exchange === ex.exchange && !ex.insufficientLiquidity;
                let rowClass = '';
                if (ex.insufficientLiquidity) rowClass = 'row-insufficient';
                else if (isBest) rowClass = 'row-best';
                else if (isWorst) rowClass = 'row-worst';

                return (
                  <tr key={ex.exchange} className={rowClass}>
                    <td>
                      {ex.exchange}
                      {isBest && <span className="badge badge-best">{t.best}</span>}
                      {isWorst && <span className="badge badge-worst">{t.worst}</span>}
                      {ex.insufficientLiquidity && (
                        <span className="badge badge-warning">⚠</span>
                      )}
                    </td>
                    <td>{formatPrice(ex.midPrice)}</td>
                    <td>{formatNumber(ex.slippageBps)}</td>
                    <td>{formatNumber(ex.feeBps)}</td>
                    <td style={{ fontWeight: 700 }}>{formatNumber(ex.totalCostBps)}</td>
                    <td>{formatNumber(recalcCostPct(ex.totalCostBps), 3)}%</td>
                    <td>{ex.orderbookDepthUsed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Hot pairs */}
      <div className="hot-pairs">
        <div className="hot-pairs-label">{t.hotPairs}</div>
        <div className="hot-pairs-grid">
          {HOT_PAIRS.map((p) => (
            <button
              key={p}
              className={`hot-pair-btn${p === pair ? ' active' : ''}`}
              onClick={() => handlePairSelect(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
