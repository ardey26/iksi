-- Performance index cleanup.
--
-- 1. Drop the LongURL.originalURL index. That column stores AES-GCM
--    ciphertext; no query filters on it. It just costs writes and space.
-- 2. Drop the single-column Click indexes for country/referrer/device/surface.
--    All admin-dashboard queries that use these columns are aggregate
--    GROUP BYs over the full table, which the planner satisfies with a
--    sequential scan regardless of these indexes. Every click insert
--    updates all four for zero read benefit.
-- 3. Add a partial composite index for the /@handle profile page's hot
--    query pattern (rows for a profile that are enabled and not
--    quarantined, ordered by position). Not representable in Prisma's
--    schema DSL, so it lives only in raw SQL.
--
-- Note on locking: these statements use the default (non-CONCURRENT)
-- form and briefly lock the table. If tables have grown large, run the
-- following manually in the Supabase SQL editor first (outside a
-- transaction) and then apply this migration:
--   DROP INDEX CONCURRENTLY IF EXISTS "LongURL_originalURL_idx";
--   DROP INDEX CONCURRENTLY IF EXISTS "Click_country_idx";
--   DROP INDEX CONCURRENTLY IF EXISTS "Click_referrer_idx";
--   DROP INDEX CONCURRENTLY IF EXISTS "Click_device_idx";
--   DROP INDEX CONCURRENTLY IF EXISTS "Click_surface_idx";
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS
--     "ProfileRow_profileId_position_active_idx"
--     ON "ProfileRow" ("profileId", "position")
--     WHERE "enabled" = true AND "quarantined" = false;
-- Then the DROP/CREATE IF (NOT) EXISTS statements below become no-ops.

DROP INDEX IF EXISTS "LongURL_originalURL_idx";

DROP INDEX IF EXISTS "Click_country_idx";
DROP INDEX IF EXISTS "Click_referrer_idx";
DROP INDEX IF EXISTS "Click_device_idx";
DROP INDEX IF EXISTS "Click_surface_idx";

CREATE INDEX IF NOT EXISTS "ProfileRow_profileId_position_active_idx"
  ON "ProfileRow" ("profileId", "position")
  WHERE "enabled" = true AND "quarantined" = false;
