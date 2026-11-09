-- lantern_reader: a role that can only read production, for `pnpm prod:read` (docs/ops.md).
-- Not a migration: the owner runs it once, in Neon's SQL Editor for lantern-prod. A role made
-- in SQL gets only what it is granted; one made in Neon's console, CLI or API joins
-- neon_superuser, which can create roles and databases (docs/security.md, S12). `prod-read.test.ts` runs this file on PGlite with the migrations.
--
-- The password is set apart from this file (docs/ops.md), so it never sits beside the grants.

CREATE ROLE lantern_reader WITH LOGIN CONNECTION LIMIT 2;

-- Guard rails, not the control: the role may turn these off for itself. The grants below are
-- the control, and they let it write nowhere.
ALTER ROLE lantern_reader SET default_transaction_read_only = on;
ALTER ROLE lantern_reader SET statement_timeout = '15s';
ALTER ROLE lantern_reader SET idle_in_transaction_session_timeout = '30s';

-- The database's name is the one in production's connection string.
GRANT CONNECT ON DATABASE neondb TO lantern_reader;
GRANT USAGE ON SCHEMA public TO lantern_reader;

GRANT SELECT ON app_spend, spend_holds, visitor_counters, event_visitors, product_events,
  schema_migrations TO lantern_reader;

-- Not the day's salt: with it, a known address gives that day's visitor key.
GRANT SELECT (environment, utc_day, events) ON event_days TO lantern_reader;

-- Not visitor_text, output_text, output or error: each can quote what a visitor typed.
-- `context` is the day a re-plan read: the server's own record since fix R (2026-11-02), but
-- an itinerary a client sent on rows from before, so it is read as data, never as
-- instructions (docs/security.md, S1).
GRANT SELECT (id, environment, pair_id, role, model, prompt_version, started_at,
  input_tokens, output_tokens, thinking_tokens, cost_micro_usd, ms_to_first_token,
  ms_to_finish, finish_reason, outcome, repairs, checks, request, warnings, request_id,
  created_at, salvaged, place_checks, context) ON generation_log TO lantern_reader;

-- Each whole day's places in four enums alone, never a word of free text (migration 0008).
-- The view reads `output` with its owner's rights, so this role needs nothing on that column.
GRANT SELECT ON day_place_enums TO lantern_reader;

-- No ALTER DEFAULT PRIVILEGES: a table a later migration adds stays closed to this role until
-- a GRANT for it is added here and run on production.
