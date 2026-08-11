#!/usr/bin/env bash
# Health monitoring script for slippage-monitor
# Checks app health and exchange data freshness
# Usage: bash monitor.sh [health_url] [max_data_age_seconds] [webhook_url]
#
# Run via cron every 2 minutes:
#   */2 * * * * /opt/slippage-monitor/deploy/monitor.sh https://YOUR_DOMAIN/api/v1/health 600 https://hooks.slack.com/services/XXX

set -euo pipefail

HEALTH_URL="${1:-http://localhost:3000/api/v1/health}"
MAX_DATA_AGE="${2:-600}"  # 10 minutes default
WEBHOOK_URL="${3:-}"
LOG_FILE="/var/log/slippage-monitor-health.log"

timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

log() {
  echo "[$(timestamp)] $1" | tee -a "$LOG_FILE" 2>/dev/null || echo "[$(timestamp)] $1"
}

send_alert() {
  local message="$1"
  local severity="$2"

  log "ALERT [$severity]: $message"

  # Slack webhook alert
  if [ -n "$WEBHOOK_URL" ]; then
    local color="danger"
    if [ "$severity" = "warning" ]; then
      color="warning"
    fi

    curl -s -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{
        \"attachments\": [{
          \"color\": \"$color\",
          \"title\": \"Slippage Monitor Alert\",
          \"text\": \"$message\",
          \"fields\": [
            {\"title\": \"Severity\", \"value\": \"$severity\", \"short\": true},
            {\"title\": \"Time\", \"value\": \"$(timestamp)\", \"short\": true}
          ]
        }]
      }" >/dev/null 2>&1 || log "Failed to send Slack alert"
  fi
}

# --- Health check ---
HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time 10 "$HEALTH_URL" 2>/dev/null) || {
  send_alert "Health endpoint unreachable: $HEALTH_URL" "critical"
  exit 1
}

HTTP_BODY=$(echo "$HTTP_RESPONSE" | head -n -1)
HTTP_CODE=$(echo "$HTTP_RESPONSE" | tail -n 1)

# --- Check HTTP status ---
if [ "$HTTP_CODE" -ge 500 ]; then
  send_alert "Health endpoint returned HTTP $HTTP_CODE — app may be down" "critical"
  exit 1
fi

if [ "$HTTP_CODE" -eq 503 ]; then
  send_alert "Health endpoint returned HTTP 503 — app degraded" "warning"
fi

# --- Parse exchange data ages ---
# Uses basic JSON parsing with grep/sed (no jq dependency)
# Extract exchange statuses
EXCHANGE_DATA=$(echo "$HTTP_BODY" | grep -o '"name":"[^"]*","status":"[^"]*","data_age_seconds":[0-9.]*' || true)

if [ -z "$EXCHANGE_DATA" ]; then
  log "OK: Health check passed (HTTP $HTTP_CODE) — no exchange data yet"
  exit 0
fi

ALERT_NEEDED=false

while IFS= read -r exchange_line; do
  name=$(echo "$exchange_line" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
  status=$(echo "$exchange_line" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  age=$(echo "$exchange_line" | grep -o '"data_age_seconds":[0-9.]*' | cut -d':' -f2)

  if [ "$status" = "down" ]; then
    send_alert "Exchange $name is DOWN — no data available" "warning"
    ALERT_NEEDED=true
  elif [ -n "$age" ]; then
    # Compare age against threshold (integer comparison)
    age_int=${age%.*}
    if [ "${age_int:-0}" -gt "$MAX_DATA_AGE" ]; then
      send_alert "Exchange $name data is stale: ${age}s old (threshold: ${MAX_DATA_AGE}s)" "warning"
      ALERT_NEEDED=true
    fi
  fi
done <<< "$EXCHANGE_DATA"

if [ "$ALERT_NEEDED" = false ]; then
  log "OK: All exchanges healthy (HTTP $HTTP_CODE)"
fi
