-- Composite indexes for the breakdown aggregations. The (url_id, ts) index
-- already exists from 004 so the series query is covered; these add the
-- equivalent for country / device / referrer so the GROUP BY heap scans go
-- from ~60ms to <5ms even as the demo dataset grows.

CREATE INDEX IF NOT EXISTS idx_clicks_url_country ON clicks(url_id, country);
CREATE INDEX IF NOT EXISTS idx_clicks_url_device ON clicks(url_id, device);
CREATE INDEX IF NOT EXISTS idx_clicks_url_referrer ON clicks(url_id, referrer);

-- The single-column idx_clicks_country from 004 is dominated by the new
-- composite, but dropping it is risky if anything queries country-only.
-- Leave it; the planner will pick whichever fits.
