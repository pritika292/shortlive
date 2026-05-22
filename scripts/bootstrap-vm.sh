#!/usr/bin/env bash
# Run on the VM (via az vm run-command) before the docker compose deploy.
# Idempotent — safe to run on every deploy.
#
# What it does:
#   1. Ensures the `shortlive` database exists in the shared pritika-postgres container.
#   2. Ensures /opt/pritika/_infra/shortlive.env exists with strong random
#      SESSION_SECRET + IP_HASH_PEPPER values. Never regenerated once set.

set -euo pipefail

INFRA_ENV="/opt/pritika/_infra/.env"
PROJECT_ENV="/opt/pritika/_infra/shortlive.env"

log() { printf "[bootstrap-vm] %s\n" "$*"; }

if [ ! -f "$INFRA_ENV" ]; then
  echo "ERROR: $INFRA_ENV not found — run setup-vm.sh first." >&2
  exit 1
fi

# Source POSTGRES_PASSWORD so we can connect to the shared instance.
set -a
# shellcheck source=/dev/null
. "$INFRA_ENV"
set +a

log "Ensuring shortlive database exists"
if docker exec pritika-postgres psql -U postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='shortlive'" | grep -q 1; then
  log "Database 'shortlive' already present"
else
  docker exec pritika-postgres psql -U postgres -c "CREATE DATABASE shortlive"
  log "Created database 'shortlive'"
fi

if [ ! -f "$PROJECT_ENV" ]; then
  log "Generating per-project secrets in $PROJECT_ENV"
  SESSION_SECRET="$(openssl rand -base64 48 | tr -d '\n' | head -c 64)"
  IP_HASH_PEPPER="$(openssl rand -base64 24 | tr -d '\n' | head -c 32)"
  umask 077
  cat > "$PROJECT_ENV" <<EOF
SESSION_SECRET=$SESSION_SECRET
IP_HASH_PEPPER=$IP_HASH_PEPPER
EOF
  log "Wrote $PROJECT_ENV (mode 600)"
else
  log "$PROJECT_ENV already exists — leaving it alone"
fi

log "Bootstrap complete"
