#!/usr/bin/env bash
# Zero-downtime deployment script for slippage-monitor
# Usage: bash deploy.sh [branch]
# Default branch: main

set -euo pipefail

BRANCH="${1:-main}"
APP_DIR="/opt/slippage-monitor"

echo "=== Deploying slippage-monitor (branch: $BRANCH) ==="

cd "$APP_DIR"

# --- Pull latest code ---
echo "[1/5] Pulling latest code..."
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

# --- Install dependencies ---
echo "[2/5] Installing dependencies..."
npm ci --production

# --- Build ---
echo "[3/5] Building Next.js (standalone)..."
npm run build

# --- Copy standalone output ---
echo "[4/5] Preparing standalone server..."
cp -r .next/standalone/* .
cp -r .next/static .next/standalone/.next/static 2>/dev/null || true
cp -r public .next/standalone/public 2>/dev/null || true

# --- Reload PM2 (zero-downtime) ---
echo "[5/5] Reloading PM2 (zero-downtime)..."
pm2 reload ecosystem.config.cjs

echo ""
echo "=== Deployment complete ==="
pm2 status
