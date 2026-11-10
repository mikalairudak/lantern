-- Three more of the product's events' fields (src/lib/events/event.schema.ts), each a closed
-- word held to the pattern the table's other words are, so none can take an address or a
-- sentence, whatever reaches the database. Each is NULL on an event whose kind has none.

ALTER TABLE product_events
  -- The view the day on screen is read in, `read` or `chart`, on the events about what the
  -- visitor does with it and on how it ended.
  ADD COLUMN view text CHECK (view ~ '^[a-z]+(-[a-z]+)*$' AND length(view) <= 32),
  -- The tile a day was opened from on the start screen, by its id, which may hold digits.
  -- No event carries one while the start screen has no tiles.
  ADD COLUMN tile text CHECK (tile ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(tile) <= 32),
  -- The visitor's answer to the day at its end, a word such as `yes`. No event carries one
  -- while the day's end asks nothing.
  ADD COLUMN answer text CHECK (answer ~ '^[a-z]+(-[a-z]+)*$' AND length(answer) <= 32);
