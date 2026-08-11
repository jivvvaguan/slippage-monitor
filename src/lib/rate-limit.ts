import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { APP_CONFIG } from './config';

const windowMs = 60000; // 1 minute
const maxRequests = APP_CONFIG.rateLimitPerMinute;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const globalForRateLimit = globalThis as unknown as {
  __rateLimitStore?: Map<string, RateLimitEntry>;
  __rateLimitInterval?: ReturnType<typeof setInterval>;
};

if (!globalForRateLimit.__rateLimitStore) {
  globalForRateLimit.__rateLimitStore = new Map();
}
const store = globalForRateLimit.__rateLimitStore;

// Clean up expired entries periodically (single interval via globalThis)
if (!globalForRateLimit.__rateLimitInterval) {
  globalForRateLimit.__rateLimitInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }, 60000);
}

export function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? '127.0.0.1';
}

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number; retryAfter?: number } {
  const now = Date.now();
  let entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(ip, entry);
  }

  entry.count++;

  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, resetAt: entry.resetAt, retryAfter };
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

export function withRateLimit(handler: (request: NextRequest) => Promise<NextResponse> | NextResponse) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const ip = getClientIp(request);
    const result = checkRateLimit(ip);

    const headers = new Headers();
    headers.set('X-RateLimit-Limit', String(maxRequests));
    headers.set('X-RateLimit-Remaining', String(result.remaining));
    headers.set('X-RateLimit-Reset', String(Math.floor(result.resetAt / 1000)));
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: 'rate_limit_exceeded',
          message: `Rate limit of ${maxRequests} requests per minute exceeded`,
          retry_after_seconds: result.retryAfter,
        },
        { status: 429, headers }
      );
    }

    const response = await handler(request);
    headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    return response;
  };
}
