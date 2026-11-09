-- Holds that expire (src/lib/live/postgres-stores.ts). A hold summed into its bucket's row
-- stayed counted until the bucket ended whenever its settle never came: a log write that
-- failed first, a response lost to a timeout after the database had committed, a function
-- stopped at its time limit. Each hold is now a row of its own that stops counting at
-- `expires_at`, well past the longest a route may run; the bucket keeps only what calls
-- spent. Expired holds are deleted by the next reservation, so the table stays a few rows
-- long and needs no index.

CREATE TABLE spend_holds (
  id uuid PRIMARY KEY,
  day_bucket text NOT NULL,
  month_bucket text NOT NULL,
  amount_micro_usd integer NOT NULL CHECK (amount_micro_usd >= 0),
  expires_at timestamptz NOT NULL
);

ALTER TABLE app_spend DROP COLUMN held_micro_usd;
