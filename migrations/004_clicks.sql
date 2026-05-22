CREATE TABLE IF NOT EXISTS clicks (
    id          BIGSERIAL PRIMARY KEY,
    url_id      BIGINT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    country     CHAR(2),
    lat         DOUBLE PRECISION,
    lon         DOUBLE PRECISION,
    user_agent  TEXT,
    device      TEXT,
    referrer    TEXT,
    ip_hash     TEXT
);

CREATE INDEX IF NOT EXISTS idx_clicks_url_ts ON clicks(url_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_country ON clicks(country);
