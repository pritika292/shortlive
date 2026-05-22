CREATE TABLE IF NOT EXISTS urls (
    id                BIGSERIAL PRIMARY KEY,
    short             VARCHAR(32) UNIQUE NOT NULL,
    target            TEXT NOT NULL,
    owner_id          BIGINT REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at        TIMESTAMPTZ,
    password_hash     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_ip_hash   TEXT
);

CREATE INDEX IF NOT EXISTS idx_urls_short ON urls(short);
CREATE INDEX IF NOT EXISTS idx_urls_owner ON urls(owner_id);
