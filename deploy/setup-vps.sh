#!/usr/bin/env bash
# VPS Setup Script for slippage-monitor
# Tested on: Ubuntu 22.04+ / Debian 12+
# Usage: sudo bash setup-vps.sh <domain>
#
# What this script does:
# 1. Installs Node.js 20 LTS via NodeSource
# 2. Installs PM2 globally
# 3. Installs Nginx
# 4. Installs Certbot for Let's Encrypt
# 5. Configures Nginx with the provided domain
# 6. Obtains SSL certificate

set -euo pipefail

DOMAIN="${1:-}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: sudo bash setup-vps.sh <domain>"
  echo "Example: sudo bash setup-vps.sh slippage.example.com"
  exit 1
fi

if [ "$EUID" -ne 0 ]; then
  echo "Error: This script must be run as root (use sudo)"
  exit 1
fi

APP_DIR="/opt/slippage-monitor"
APP_USER="slippage"

echo "=== Slippage Monitor VPS Setup ==="
echo "Domain: $DOMAIN"
echo ""

# --- System updates ---
echo "[1/8] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# --- Node.js 20 LTS ---
echo "[2/8] Installing Node.js 20 LTS..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
echo "  Node.js $(node --version)"

# --- PM2 ---
echo "[3/8] Installing PM2..."
npm install -g pm2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
echo "  PM2 $(pm2 --version)"

# --- Nginx ---
echo "[4/8] Installing Nginx..."
apt-get install -y -qq nginx
systemctl enable nginx

# --- Certbot ---
echo "[5/8] Installing Certbot..."
apt-get install -y -qq certbot python3-certbot-nginx

# --- Application user and directory ---
echo "[6/8] Creating application user and directory..."
if ! id "$APP_USER" &>/dev/null; then
  useradd --system --shell /bin/bash --home "$APP_DIR" "$APP_USER"
fi
mkdir -p "$APP_DIR/logs"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# --- Nginx configuration ---
echo "[7/8] Configuring Nginx for $DOMAIN..."
NGINX_CONF="/etc/nginx/sites-available/slippage-monitor"

# Copy template and replace domain
if [ -f "$(dirname "$0")/nginx.conf" ]; then
  sed "s/YOUR_DOMAIN/$DOMAIN/g" "$(dirname "$0")/nginx.conf" > "$NGINX_CONF"
else
  echo "Warning: nginx.conf template not found, skipping Nginx config"
fi

# Enable site
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/slippage-monitor

# Remove default site if it exists
rm -f /etc/nginx/sites-enabled/default

# Test nginx config (allow failure before SSL cert exists)
nginx -t 2>/dev/null || echo "  Note: Nginx config test may fail until SSL cert is obtained"

# --- SSL Certificate ---
echo "[8/8] Obtaining SSL certificate for $DOMAIN..."
# Stop nginx temporarily for standalone cert acquisition
systemctl stop nginx || true
certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" || {
  echo "  Warning: Certbot failed. You may need to:"
  echo "  1. Ensure DNS A record points to this server"
  echo "  2. Ensure port 80 is open"
  echo "  3. Run manually: certbot certonly --standalone -d $DOMAIN"
}

# Start nginx
systemctl start nginx

# --- Setup PM2 startup ---
pm2 startup systemd -u "$APP_USER" --hp "$APP_DIR" || true

# --- Certbot auto-renewal ---
systemctl enable certbot.timer 2>/dev/null || true

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Clone the repo:  cd $APP_DIR && git clone <repo-url> ."
echo "  2. Install deps:    npm ci --production"
echo "  3. Build:           npm run build"
echo "  4. Copy standalone: cp -r .next/standalone/* ."
echo "  5. Start PM2:       pm2 start ecosystem.config.cjs"
echo "  6. Save PM2:        pm2 save"
echo ""
echo "App directory: $APP_DIR"
echo "Logs: $APP_DIR/logs/"
echo "Nginx config: $NGINX_CONF"
echo "SSL certs: /etc/letsencrypt/live/$DOMAIN/"
