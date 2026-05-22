-- The org convention is: every project's tables referencing auth.users use
-- ON DELETE CASCADE so that deleting an expired temp user (or a regular user
-- that we want gone) wipes their owned rows across every project in a single
-- statement.
--
-- urls.owner_id was originally created with ON DELETE SET NULL (003), which
-- worked when we only had permanent users. Now that quickstart spins up temp
-- users with a 30-minute TTL we need their data to vanish with them.
--
-- Postgres doesn't have ALTER ... ALTER CONSTRAINT for changing FK behaviour,
-- so we drop and re-add. The constraint name follows Postgres' default
-- (<table>_<column>_fkey).

ALTER TABLE urls DROP CONSTRAINT IF EXISTS urls_owner_id_fkey;

ALTER TABLE urls
  ADD CONSTRAINT urls_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
