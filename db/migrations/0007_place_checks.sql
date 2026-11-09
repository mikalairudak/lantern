-- A live day's places, each by its id with its last check as the visitor's stream carried it
-- (src/lib/live/generation-log.ts, `placeChecks`): confirmed by name with the provider's point,
-- confirmed by area, unconfirmed or unchecked. What `GET /api/day/<id>` needs to show a day
-- again as it was, its places at the provider's points and marked (docs/decisions.md, "A day
-- is written to its end"). NULL for a call that checked no place: an intake, a shadow, a day
-- without the verifier, and the rows written before this column.
--
-- Every record names the column, so production takes this migration before the push of the
-- code that writes it.

ALTER TABLE generation_log ADD COLUMN place_checks jsonb;
