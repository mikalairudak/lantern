-- One row per model call (src/lib/live/generation-log.ts, `GenerationRecord`): the eval's
-- second source, read in pairs. No column holds the visitor's address or its hash.

CREATE TABLE generation_log (
  id uuid PRIMARY KEY,
  -- `VERCEL_ENV`, or `development` on a laptop: the laptop and preview deploys share one
  -- database, so every record says where it ran.
  environment text NOT NULL,
  -- Shared by the visitor's day and the shadow written beside it.
  pair_id uuid,
  role text NOT NULL CHECK (role IN ('day', 'shadow', 'intake')),
  model text NOT NULL,
  prompt_version text NOT NULL,
  started_at timestamptz NOT NULL,
  input_tokens integer,
  output_tokens integer,
  thinking_tokens integer,
  cost_micro_usd integer,
  ms_to_first_token integer,
  ms_to_finish integer NOT NULL,
  finish_reason text,
  outcome text NOT NULL,
  repairs integer,
  checks jsonb,
  visitor_text text,
  request jsonb,
  -- Exactly as the model wrote it, and parsed when it is whole JSON.
  output_text text NOT NULL,
  output jsonb,
  warnings jsonb NOT NULL,
  request_id text,
  error jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX generation_log_created_at ON generation_log (created_at);
CREATE INDEX generation_log_pair_id ON generation_log (pair_id);
