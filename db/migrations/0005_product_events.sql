-- The product's events (src/lib/events/): what real visitors did, counted for the owner's
-- questions of 2026-10-30 (docs/decisions.md). One row per event, written by
-- `POST /api/events`. Nothing here holds an address, a user agent, a time of day or any text
-- the visitor typed: every column is a day, a hash, a closed word or a city as its address
-- writes it.

-- Each UTC day's random salt, which that day's visitors are hashed with, and how many events
-- the app has taken that day. A day's row is deleted by the first event of a later one, its
-- salt with it, so a day's hashes cannot be recomputed from any address once it is over.
CREATE TABLE event_days (
  environment text NOT NULL,
  utc_day date NOT NULL,
  salt text NOT NULL CHECK (salt ~ '^[0-9a-f]{64}$'),
  events integer NOT NULL DEFAULT 0 CHECK (events >= 0),
  PRIMARY KEY (environment, utc_day)
);

-- How many events each visitor has sent in a UTC day, under that day's hash. Deleted with
-- the day, so the table holds only today's visitors.
CREATE TABLE event_visitors (
  environment text NOT NULL,
  utc_day date NOT NULL,
  visitor_key text NOT NULL CHECK (visitor_key ~ '^[0-9a-f]{64}$'),
  events integer NOT NULL CHECK (events >= 0),
  PRIMARY KEY (environment, utc_day, visitor_key)
);

CREATE INDEX event_visitors_utc_day ON event_visitors (utc_day);

-- The vocabularies themselves are defined once, in src/lib/events/event.schema.ts. The
-- checks here hold each of them to a word of lower-case letters and hyphens, so a column can
-- never take an address or a sentence, whatever reaches the database.
CREATE TABLE product_events (
  -- Random, so the order of rows says nothing about when they came.
  id uuid PRIMARY KEY,
  -- `VERCEL_ENV`, or `development` on a laptop: the laptop and preview share a database.
  environment text NOT NULL,
  -- The UTC day the event arrived. No time of day is kept.
  utc_day date NOT NULL,
  -- The visitor's hash under that day's salt: the same visitor on another day is another key,
  -- and none of them equals the limits' key in visitor_counters.
  visitor_key text NOT NULL CHECK (visitor_key ~ '^[0-9a-f]{64}$'),
  kind text NOT NULL CHECK (kind ~ '^[a-z]+(-[a-z]+)*$' AND length(kind) <= 32),
  -- The city of the day on screen, as its address writes it: `kyoto`, `sao-paulo`.
  city text CHECK (city ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(city) <= 100),
  via text CHECK (via ~ '^[a-z]+(-[a-z]+)*$' AND length(via) <= 32),
  -- Whether the day on screen is one Lantern wrote, streamed from its file, or the model's.
  written boolean,
  outcome text CHECK (outcome ~ '^[a-z]+(-[a-z]+)*$' AND length(outcome) <= 32),
  stage text CHECK (stage ~ '^[a-z]+(-[a-z]+)*$' AND length(stage) <= 32),
  word text CHECK (word ~ '^[a-z]+(-[a-z]+)*$' AND length(word) <= 32)
);

-- Every reading filters on the environment and the kind over a span of days.
CREATE INDEX product_events_reading ON product_events (environment, kind, utc_day);
