/**
 * Structured logger for production.
 * - JSON format when LOG_FORMAT=json (default in production)
 * - Human-readable text format otherwise (dev default)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

function isJsonFormat(): boolean {
  if (process.env.LOG_FORMAT) {
    return process.env.LOG_FORMAT === 'json';
  }
  return process.env.NODE_ENV === 'production';
}

function formatText(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${ts}] ${level.toUpperCase()} ${message}${metaStr}`;
}

function formatJson(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  return JSON.stringify(entry);
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const output = isJsonFormat()
    ? formatJson(level, message, meta)
    : formatText(level, message, meta);

  switch (level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    default:
      console.log(output);
      break;
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
};
