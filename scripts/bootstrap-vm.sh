#!/usr/bin/env bash
# Run on the VM (via az vm run-command) before the docker compose deploy.
# Idempotent — safe to run on every deploy. Existing secrets are preserved;
# missing keys are filled in.

set -euo pipefail

INFRA_ENV="/opt/pritika/_infra/.env"
PROJECT_ENV="/opt/pritika/_infra/shortlive.env"

log() { printf "[bootstrap-vm] %s\n" "$*"; }

if [ ! -f "$INFRA_ENV" ]; then
  echo "ERROR: $INFRA_ENV not found — run setup-vm.sh first." >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
. "$INFRA_ENV"
set +a

if [ -z "${POSTGRES_PASSWORD:-}" ] || [ -z "${REDIS_PASSWORD:-}" ]; then
  echo "ERROR: POSTGRES_PASSWORD or REDIS_PASSWORD missing from $INFRA_ENV" >&2
  exit 1
fi

log "Ensuring shortlive database exists"
if docker exec pritika-postgres psql -U postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='shortlive'" | grep -q 1; then
  log "Database 'shortlive' already present"
else
  docker exec pritika-postgres psql -U postgres -c "CREATE DATABASE shortlive"
  log "Created database 'shortlive'"
fi

# Preserve any existing secrets so sessions and IP hashes remain stable across
# deploys. Generate only what's missing.
read_existing() {
  local key="$1"
  if [ -f "$PROJECT_ENV" ]; then
    grep "^${key}=" "$PROJECT_ENV" | head -1 | cut -d= -f2- || true
  fi
}

SESSION_SECRET="$(read_existing SESSION_SECRET)"
if [ -z "$SESSION_SECRET" ]; then
  SESSION_SECRET="$(openssl rand -base64 48 | tr -d '\n' | head -c 64)"
  log "Generated new SESSION_SECRET"
fi

IP_HASH_PEPPER="$(read_existing IP_HASH_PEPPER)"
if [ -z "$IP_HASH_PEPPER" ]; then
  IP_HASH_PEPPER="$(openssl rand -base64 24 | tr -d '\n' | head -c 32)"
  log "Generated new IP_HASH_PEPPER"
fi

umask 077
cat > "$PROJECT_ENV" <<EOF
NODE_ENV=production
PORT=3010
DATABASE_URL=postgres://postgres:${POSTGRES_PASSWORD}@pritika-postgres:5432/shortlive
REDIS_URL=redis://:${REDIS_PASSWORD}@pritika-redis:6379/1
SESSION_SECRET=${SESSION_SECRET}
IP_HASH_PEPPER=${IP_HASH_PEPPER}
EOF
log "Wrote $PROJECT_ENV (mode 600)"

log "Bootstrap complete"
