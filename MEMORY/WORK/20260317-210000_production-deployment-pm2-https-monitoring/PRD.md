---
task: Production deployment config PM2 HTTPS monitoring logging
slug: 20260317-210000_production-deployment-pm2-https-monitoring
effort: extended
phase: verify
progress: 18/18
mode: interactive
started: 2026-03-17T21:00:00+08:00
updated: 2026-03-17T21:00:00+08:00
---

## Context

Production deployment infrastructure for the slippage-monitor Next.js app. The app is a read-only monitoring tool that fetches live orderbook data from multiple exchanges, computes slippage/taker costs, and serves results via REST API + web dashboard.

We need: PM2 process management for zero-downtime reloads, Nginx reverse proxy with HTTPS (Let's Encrypt), structured JSON logging for production, health monitoring with alerting for both app uptime and exchange data freshness, and a VPS setup guide/script.

### Risks
- Cannot actually provision VPS or configure DNS — deliverables are scripts + guides
- PM2 cluster mode may conflict with Next.js server — need standalone output mode
- Structured logging must not break existing console output in dev mode

## Criteria

- [x] ISC-1: ecosystem.config.cjs exists with app name and script path
- [x] ISC-2: PM2 config uses cluster mode with configurable instances
- [x] ISC-3: PM2 config sets NODE_ENV=production environment variable
- [x] ISC-4: PM2 config enables log rotation via date-based file paths
- [x] ISC-5: Nginx config proxies port 3000 to domain with WebSocket support
- [x] ISC-6: Nginx config includes SSL directives for Let's Encrypt certs
- [x] ISC-7: VPS setup script installs Node.js, PM2, Nginx, Certbot
- [x] ISC-8: VPS setup script runs certbot for HTTPS certificate
- [x] ISC-9: Structured logger module exports JSON-formatted log function
- [x] ISC-10: Logger includes timestamp, level, message, and metadata fields
- [x] ISC-11: Logger respects LOG_FORMAT env var (json for prod, text for dev)
- [x] ISC-12: Health check endpoint returns exchange connectivity status
- [x] ISC-13: Health check endpoint returns data age per exchange
- [x] ISC-14: Monitoring script checks health endpoint and alerts on failure
- [x] ISC-15: Monitoring script alerts when exchange data age exceeds threshold
- [x] ISC-16: Next.js config set to standalone output for production
- [x] ISC-17: Deploy script automates git pull, build, PM2 reload sequence
- [x] ISC-18: All config files pass syntax validation (no parse errors)

## Decisions

## Verification
