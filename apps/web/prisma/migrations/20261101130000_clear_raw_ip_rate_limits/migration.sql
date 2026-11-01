-- Rate-limit counters used to be keyed by the visitor's raw IP. New keys hold
-- an HMAC of the IP instead (lib/server/ip-hash). Delete every existing
-- counter so no raw IP stays stored. These rows are transient counters with
-- windows of at most a day: deleting them only resets limits early, and no
-- schema changes.
DELETE FROM "RateLimit";
DELETE FROM "HandleClaimRateLimit";
