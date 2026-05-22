CREATE TABLE IF NOT EXISTS rules (
    id                    TEXT PRIMARY KEY,
    url_id                BIGINT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    type                  TEXT NOT NULL CHECK (type IN ('threshold', 'velocity', 'first_of', 'per_click')),
    config                JSONB NOT NULL,
    destination_url       TEXT NOT NULL,
    destination_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    verification_attempts INT NOT NULL DEFAULT 0,
    last_verification_error TEXT,
    cooldown_seconds      INT NOT NULL DEFAULT 0,
    enabled               BOOLEAN NOT NULL DEFAULT TRUE,
    signing_secret        TEXT NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_fired_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rules_url ON rules(url_id);
CREATE INDEX IF NOT EXISTS idx_rules_enabled ON rules(url_id, enabled) WHERE enabled = TRUE;
