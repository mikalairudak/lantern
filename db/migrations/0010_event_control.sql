-- One more of the product's events' fields (src/lib/events/event.schema.ts): the control a word
-- of the header was changed at, a closed word held to the pattern the table's other words are,
-- so it can take no address or sentence, whatever reaches the database. Its vocabulary lives in
-- the schema, so a later value needs no migration. NULL on an event whose kind has none, and on
-- a word changed before the control was told.
--
-- The events' store names this column in its one insert, so a database without it refuses
-- every event: production applies it before the release that sends it (docs/harness.md,
-- "Database").

ALTER TABLE product_events
  -- A word such as `headline` or `bar`, on `word-changed`.
  ADD COLUMN control text CHECK (control ~ '^[a-z]+(-[a-z]+)*$' AND length(control) <= 32);
