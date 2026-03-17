import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// --- Rate Limiter ---

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const rateLimitMap = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 300_000);

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  }

  entry.count++;

  return {
    allowed: entry.count <= RATE_LIMIT_MAX,
    limit: RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - entry.count),
    resetAt: entry.resetAt,
  };
}

// --- CORS Headers ---

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

// --- Error Response Builder ---

interface ApiError {
  error: string;
  message: string;
}

function errorResponse(
  status: number,
  error: string,
  message: string,
  extraHeaders?: Record<string, string>,
): NextResponse<ApiError> {
  return NextResponse.json(
    { error, message },
    {
      status,
      headers: {
        ...corsHeaders(),
        ...extraHeaders,
      },
    },
  );
}

// --- Public API ---

export function handleOptions(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export function applyRateLimit(request: NextRequest): NextResponse | null {
  const ip = getClientIp(request);
  const result = checkRateLimit(ip);

  const rateLimitHeaders: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };

  if (!result.allowed) {
    return errorResponse(
      429,
      'RATE_LIMIT_EXCEEDED',
      `Rate limit of ${RATE_LIMIT_MAX} requests per minute exceeded. Retry after ${Math.ceil((result.resetAt - Date.now()) / 1000)} seconds.`,
      rateLimitHeaders,
    );
  }

  // Return null to indicate allowed — caller will add headers to success response
  return null;
}

export function getRateLimitHeaders(request: NextRequest): Record<string, string> {
  const ip = getClientIp(request);
  const entry = rateLimitMap.get(ip);
  if (!entry) {
    return {
      'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
      'X-RateLimit-Remaining': String(RATE_LIMIT_MAX),
      'X-RateLimit-Reset': String(Math.ceil((Date.now() + RATE_LIMIT_WINDOW_MS) / 1000)),
    };
  }
  return {
    'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
    'X-RateLimit-Remaining': String(Math.max(0, RATE_LIMIT_MAX - entry.count)),
    'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
  };
}

export function jsonResponse<T>(
  data: T,
  request: NextRequest,
  status: number = 200,
): NextResponse<T> {
  return NextResponse.json(data, {
    status,
    headers: {
      ...corsHeaders(),
      ...getRateLimitHeaders(request),
    },
  });
}

export function apiError(
  request: NextRequest,
  status: number,
  error: string,
  message: string,
): NextResponse<ApiError> {
  return NextResponse.json(
    { error, message },
    {
      status,
      headers: {
        ...corsHeaders(),
        ...getRateLimitHeaders(request),
      },
    },
  );
}
