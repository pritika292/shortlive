CREATE TABLE IF NOT EXISTS firings (
    id                  TEXT PRIMARY KEY,
    rule_id             TEXT NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    ts                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    click_id            BIGINT REFERENCES clicks(id) ON DELETE SET NULL,
    matched             JSONB,
    status              TEXT NOT NULL CHECK (status IN ('pending', 'delivered', 'failed')),
    attempts            INT NOT NULL DEFAULT 0,
    last_attempt        TIMESTAMPTZ,
    last_response_code  INT,
    last_error          TEXT
);

CREATE INDEX IF NOT EXISTS idx_firings_rule_ts ON firings(rule_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_firings_status ON firings(status, ts DESC);
