import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import type { ExchangeAdapter, Orderbook, SlippageResult } from './exchanges/types';
import { calculateSlippage } from './slippage';
import { loadConfig } from './config';
import { createAdapters } from './exchange-factory';

// --- Interfaces ---

interface OrderbookCacheEntry {
  orderbook: Orderbook;
  fetchedAt: number;
}

interface CacheEntryWithAge {
  orderbook: Orderbook;
  fetchedAt: number;
  dataAgeSeconds: number;
  degraded: boolean;
}

interface SlippageCacheEntry {
  result: SlippageResult;
  fetchedAt: number;
}

export interface ExchangeInfo {
  name: string;
  takerFeeBps: number;
  status: 'up' | 'degraded' | 'down';
  lastFetchedAt: number | null;
  dataAgeSeconds: number | null;
}

export interface DataAgeInfo {
  dataAgeSeconds: number;
  nextRefreshSeconds: number;
}

// --- Constants ---

const PRESET_AMOUNTS = [10_000, 50_000, 100_000, 500_000, 1_000_000] as const;
const DEGRADED_THRESHOLD_SECONDS = 600; // 10 minutes
const CRON_EXPRESSION = '*/5 * * * *'; // every 5 minutes
const REFRESH_INTERVAL_MS = 300_000; // 5 minutes in ms

// --- Cache ---

function cacheKey(exchange: string, pair: string): string {
  return `${exchange}:${pair}`;
}

function slippageCacheKey(exchange: string, pair: string, amount: number): string {
  return `${exchange}:${pair}:${amount}`;
}

// --- DataCollector ---

export class DataCollector {
  private orderbookCache = new Map<string, OrderbookCacheEntry>();
  private slippageCache = new Map<string, SlippageCacheEntry>();
  private adapters: ExchangeAdapter[] = [];
  private pairs: string[] = [];
  private depthLimit: number;
  private leverage: number;
  private cronTask: ScheduledTask | null = null;
  private running = false;
  private lastRefreshAt: number | null = null;
  private startedAt: number = Date.now();

  constructor() {
    const config = loadConfig();
    this.pairs = config.pairs;
    this.depthLimit = config.orderbookDepthLimit;
    this.leverage = config.leverage;
    this.adapters = createAdapters(config.exchanges);
  }

  /**
   * Start the cron scheduler. Fetches immediately, then every 5 minutes.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Fetch immediately on start
    this.refresh().catch((err) => {
      console.error(`[DataCollector] Initial refresh error: ${(err as Error).message}`);
    });

    // Schedule recurring fetch
    this.cronTask = cron.schedule(CRON_EXPRESSION, () => {
      this.refresh().catch((err) => {
        console.error(`[DataCollector] Scheduled refresh error: ${(err as Error).message}`);
      });
    });

    console.log('[DataCollector] Started — fetching every 5 minutes');
  }

  /**
   * Stop the cron scheduler and close all adapters.
   */
  async stop(): Promise<void> {
    this.running = false;
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }
    await Promise.all(this.adapters.map((a) => a.close()));
    console.log('[DataCollector] Stopped');
  }

  /**
   * Run one full refresh cycle: fetch orderbooks, then pre-compute slippage.
   */
  async refresh(): Promise<void> {
    await this.fetchAllOrderbooks();
    this.preComputeSlippage();
    this.lastRefreshAt = Date.now();
  }

  // --- Orderbook Fetching ---

  private async fetchAllOrderbooks(): Promise<void> {
    const fetchPromises: Array<Promise<void>> = [];

    for (const adapter of this.adapters) {
      for (const pair of this.pairs) {
        fetchPromises.push(this.fetchSingleOrderbook(adapter, pair));
      }
    }

    // Each fetch is independent — use allSettled so one failure doesn't block others
    const results = await Promise.allSettled(fetchPromises);

    for (const result of results) {
      if (result.status === 'rejected') {
        console.warn(`[DataCollector] Unexpected fetch rejection: ${result.reason}`);
      }
    }
  }

  private async fetchSingleOrderbook(adapter: ExchangeAdapter, pair: string): Promise<void> {
    try {
      const orderbook = await adapter.fetchOrderbook(pair, this.depthLimit);
      if (orderbook) {
        const key = cacheKey(adapter.name, pair);
        this.orderbookCache.set(key, {
          orderbook,
          fetchedAt: Date.now(),
        });
      }
      // null return means unsupported pair or fetch failure — adapter already logged
    } catch (err) {
      console.warn(
        `[DataCollector] ${adapter.name}/${pair} fetch failed: ${(err as Error).message}`,
      );
      // Do not throw — single failure must not block others
    }
  }

  // --- Slippage Pre-computation ---

  private preComputeSlippage(): void {
    for (const [key, entry] of this.orderbookCache) {
      const [exchange, pair] = key.split(':');

      // Find the adapter to get fee
      const adapter = this.adapters.find((a) => a.name === exchange);
      if (!adapter) continue;

      const feeBps = adapter.getTakerFeeBps();

      for (const amount of PRESET_AMOUNTS) {
        const result = calculateSlippage(
          entry.orderbook,
          amount,
          this.leverage,
          feeBps,
          'buy',
        );
        result.pair = pair;

        const sKey = slippageCacheKey(exchange, pair, amount);
        this.slippageCache.set(sKey, {
          result,
          fetchedAt: entry.fetchedAt,
        });
      }
    }
  }

  // --- Public Getters ---

  /**
   * Get a cached orderbook with age and degraded status.
   */
  getOrderbook(exchange: string, pair: string): CacheEntryWithAge | null {
    const entry = this.orderbookCache.get(cacheKey(exchange, pair));
    if (!entry) return null;

    const dataAgeSeconds = (Date.now() - entry.fetchedAt) / 1000;
    return {
      orderbook: entry.orderbook,
      fetchedAt: entry.fetchedAt,
      dataAgeSeconds: Math.round(dataAgeSeconds * 10) / 10,
      degraded: dataAgeSeconds > DEGRADED_THRESHOLD_SECONDS,
    };
  }

  /**
   * Get pre-computed slippage for a specific exchange, pair, and amount.
   */
  getSlippage(exchange: string, pair: string, amount: number): SlippageResult | null {
    const entry = this.slippageCache.get(slippageCacheKey(exchange, pair, amount));
    return entry?.result ?? null;
  }

  /**
   * Get all pre-computed slippage results.
   */
  getAllSlippage(): SlippageResult[] {
    return Array.from(this.slippageCache.values()).map((e) => e.result);
  }

  /**
   * Get list of exchange:pair keys that have degraded (stale >10 min) data.
   */
  getDegradedExchanges(): string[] {
    const degraded: string[] = [];
    const now = Date.now();

    for (const [key, entry] of this.orderbookCache) {
      const ageSeconds = (now - entry.fetchedAt) / 1000;
      if (ageSeconds > DEGRADED_THRESHOLD_SECONDS) {
        degraded.push(key);
      }
    }

    return degraded;
  }

  /**
   * Get the preset amounts used for pre-computation.
   */
  getPresetAmounts(): readonly number[] {
    return PRESET_AMOUNTS;
  }

  /**
   * Compute slippage on-demand from cached orderbook for a custom amount.
   */
  computeSlippageOnDemand(
    exchange: string,
    pair: string,
    amountUSD: number,
  ): SlippageResult | null {
    const cached = this.getOrderbook(exchange, pair);
    if (!cached) return null;

    const adapter = this.adapters.find((a) => a.name === exchange);
    if (!adapter) return null;

    const result = calculateSlippage(
      cached.orderbook,
      amountUSD,
      this.leverage,
      adapter.getTakerFeeBps(),
      'buy',
    );
    result.pair = pair;
    return result;
  }

  /**
   * Get info about all configured exchanges.
   */
  getExchangeInfo(): ExchangeInfo[] {
    const now = Date.now();
    return this.adapters.map((adapter) => {
      // Check if any pair has data for this exchange
      let latestFetch: number | null = null;
      let hasAnyData = false;

      for (const pair of this.pairs) {
        const entry = this.orderbookCache.get(cacheKey(adapter.name, pair));
        if (entry) {
          hasAnyData = true;
          if (latestFetch === null || entry.fetchedAt > latestFetch) {
            latestFetch = entry.fetchedAt;
          }
        }
      }

      let status: 'up' | 'degraded' | 'down' = 'down';
      let dataAgeSeconds: number | null = null;

      if (hasAnyData && latestFetch !== null) {
        dataAgeSeconds = Math.round((now - latestFetch) / 100) / 10;
        status = dataAgeSeconds > DEGRADED_THRESHOLD_SECONDS ? 'degraded' : 'up';
      }

      return {
        name: adapter.name,
        takerFeeBps: adapter.getTakerFeeBps(),
        status,
        lastFetchedAt: latestFetch,
        dataAgeSeconds,
      };
    });
  }

  /**
   * Get configured trading pairs.
   */
  getConfiguredPairs(): string[] {
    return [...this.pairs];
  }

  /**
   * Get configured exchange names.
   */
  getExchangeNames(): string[] {
    return this.adapters.map((a) => a.name);
  }

  /**
   * Get data age and next refresh timing info.
   */
  getDataAgeInfo(): DataAgeInfo {
    const now = Date.now();
    const lastRefresh = this.lastRefreshAt ?? this.startedAt;
    const dataAgeSeconds = Math.round((now - lastRefresh) / 100) / 10;
    const nextRefreshMs = Math.max(0, lastRefresh + REFRESH_INTERVAL_MS - now);
    const nextRefreshSeconds = Math.round(nextRefreshMs / 100) / 10;

    return { dataAgeSeconds, nextRefreshSeconds };
  }

  /**
   * Get system uptime in seconds.
   */
  getUptimeSeconds(): number {
    return Math.round((Date.now() - this.startedAt) / 1000);
  }

  /**
   * Get last refresh timestamp.
   */
  getLastRefreshAt(): number | null {
    return this.lastRefreshAt;
  }

  /**
   * Check if the collector is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }
}

// --- Singleton ---

let instance: DataCollector | null = null;

export function getDataCollector(): DataCollector {
  if (!instance) {
    instance = new DataCollector();
  }
  return instance;
}
