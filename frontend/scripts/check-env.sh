#!/usr/bin/env bash
# check-env.sh — Validate .env/.env.local before dev server starts.
# Source: sessions/route.ts DATABASE_URL incident (2026-04-14)

set -euo pipefail

ERRORS=0

# Load .env.local first (higher priority), then .env
ENV_FILE=""
if [ -f .env.local ]; then
  ENV_FILE=".env.local"
elif [ -f .env ]; then
  ENV_FILE=".env"
else
  echo "WARNING: No .env or .env.local found"
  exit 0
fi

# 1. DATABASE_URL must be postgresql://
DB_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true)
if [ -z "$DB_URL" ]; then
  echo "ERROR: DATABASE_URL not set in $ENV_FILE"
  ERRORS=$((ERRORS + 1))
elif [[ "$DB_URL" == file:* ]]; then
  echo "ERROR: DATABASE_URL is SQLite ($DB_URL) — must be postgresql://"
  echo "  Fix: railway link → railway variables"
  ERRORS=$((ERRORS + 1))
elif [[ "$DB_URL" != postgresql://* && "$DB_URL" != postgres://* ]]; then
  echo "WARNING: DATABASE_URL doesn't start with postgresql:// — got: ${DB_URL:0:20}..."
fi

# 2. BSC_ACP_ADDRESS should match agenticCommerceHooked in contracts.ts (active chain)
if [ -f src/lib/contracts.ts ]; then
  ENV_ACP=$(grep '^BSC_ACP_ADDRESS=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
  if [ -n "$ENV_ACP" ]; then
    # Detect active chain, then grep the correct block
    ACTIVE_CHAIN=$(grep "ACTIVE_CHAIN" src/lib/contracts.ts 2>/dev/null | grep -o "'[^']*'" | tr -d "'" || echo "bscTestnet")
    CODE_ACP=$(sed -n "/${ACTIVE_CHAIN}/,/}/p" src/lib/contracts.ts 2>/dev/null | grep "agenticCommerceHooked" | grep -o '"0x[a-fA-F0-9]*"' | tr -d '"' || true)
    if [ -n "$CODE_ACP" ] && [ "$CODE_ACP" != "0x0000000000000000000000000000000000000000" ] && [ "$ENV_ACP" != "$CODE_ACP" ]; then
      echo "WARNING: BSC_ACP_ADDRESS mismatch (chain: ${ACTIVE_CHAIN})"
      echo "  .env.local: $ENV_ACP"
      echo "  contracts.ts: $CODE_ACP"
      echo "  (env vars override code — make sure this is intentional)"
    fi
  fi
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "Environment check failed: ${ERRORS} error(s). Fix before starting dev server."
  exit 1
fi

echo "Environment check passed."
