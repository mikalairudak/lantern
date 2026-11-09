-- Cost protection (src/lib/live/limits.ts): what each visitor has asked of a model today,
-- and what the whole app has held and spent. Days and months are calendar ones in UTC.
-- The product's events come in a migration of their own, once they are designed.

CREATE TABLE visitor_counters (
  -- The salted SHA-256 of the visitor's address (src/lib/live/visitor.ts). The check keeps
  -- an address, or anything else that is not such a hash, from ever being stored.
  visitor_key text NOT NULL CHECK (visitor_key ~ '^[0-9a-f]{64}$'),
  utc_day date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('day', 'intake')),
  count integer NOT NULL CHECK (count >= 0),
  PRIMARY KEY (visitor_key, utc_day, kind)
);

CREATE TABLE app_spend (
  bucket text PRIMARY KEY CHECK (bucket ~ '^(day:\d{4}-\d{2}-\d{2}|month:\d{4}-\d{2})$'),
  -- Micro-dollars, never floats: the worst case of calls under way, and what settled calls
  -- cost. A settle that would take either below zero is a bug, and fails here.
  held_micro_usd integer NOT NULL DEFAULT 0 CHECK (held_micro_usd >= 0),
  spent_micro_usd integer NOT NULL DEFAULT 0 CHECK (spent_micro_usd >= 0)
);
