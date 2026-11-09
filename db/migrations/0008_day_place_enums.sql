-- Each place of each whole day the model wrote, a re-plan's new stops not among them, in four
-- of the schema's enums alone: its kind and its sound, energy and crowd
-- (src/lib/schema/itinerary.schema.ts). For reading production
-- as `lantern_reader`, which is granted this view and never the columns it reads from
-- (db/roles/lantern-reader.sql; docs/security.md, S12): a session can count the days' places
-- without a line of free text, the model's or a visitor's, reaching it.
--
-- The view runs with its owner's rights, Postgres's default, so the reader needs no grant on
-- `generation_log.output`. It reads `output`, the JSON the log keeps only for an answer that
-- parsed whole, and never parses `output_text`, so a day cut short gives no rows rather than an
-- error. A value outside its enum, which a model under the schema should never write, comes
-- out NULL, so no text of any length passes. A day's stops come with `option_index` NULL; each
-- swap option with its stop's index and its own place in the stop's options, from 0.
--
-- Not a table: production applies it before the push of anything that reads it, and the owner
-- then runs its GRANT from db/roles/lantern-reader.sql.

CREATE VIEW day_place_enums AS
WITH days AS (
  SELECT id, environment, prompt_version, created_at, output
  FROM generation_log
  -- A re-plan is written as a day's call too, with its context; its stops are a window's alone.
  WHERE role = 'day' AND outcome = 'complete' AND context IS NULL
    AND jsonb_typeof(output) = 'object'
),
places AS (
  SELECT d.id, d.environment, d.prompt_version, d.created_at,
    (stop.ordinality - 1)::integer AS stop_index,
    NULL::integer AS option_index,
    stop.value -> 'place' AS place
  FROM days d
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(d.output -> 'stops') = 'array' THEN d.output -> 'stops' ELSE '[]' END
  ) WITH ORDINALITY AS stop(value, ordinality)
  UNION ALL
  SELECT d.id, d.environment, d.prompt_version, d.created_at,
    CASE
      WHEN jsonb_typeof(alternative.value -> 'stopIndex') = 'number'
        AND (alternative.value ->> 'stopIndex') ~ '^[0-9]{1,4}$'
      THEN (alternative.value ->> 'stopIndex')::integer
    END AS stop_index,
    (option.ordinality - 1)::integer AS option_index,
    option.value AS place
  FROM days d
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(d.output -> 'alternatives') = 'array' THEN d.output -> 'alternatives'
      ELSE '[]'
    END
  ) AS alternative(value)
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(alternative.value -> 'options') = 'array'
      THEN alternative.value -> 'options'
      ELSE '[]'
    END
  ) WITH ORDINALITY AS option(value, ordinality)
)
SELECT
  id AS record_id,
  environment,
  prompt_version,
  created_at,
  stop_index,
  option_index,
  CASE
    WHEN place ->> 'kind' IN ('coffee', 'food', 'bar', 'gallery', 'museum', 'architecture',
      'sacred', 'garden', 'viewpoint', 'market', 'shop', 'walk')
    THEN place ->> 'kind'
  END AS kind,
  CASE
    WHEN place -> 'sensory' ->> 'energy' IN ('reflective', 'calm', 'balanced', 'lively', 'social')
    THEN place -> 'sensory' ->> 'energy'
  END AS energy,
  CASE
    WHEN place -> 'sensory' ->> 'acoustic' IN ('silent', 'hushed', 'murmur', 'chatter', 'loud')
    THEN place -> 'sensory' ->> 'acoustic'
  END AS acoustic,
  CASE
    WHEN place -> 'sensory' ->> 'crowd' IN ('empty', 'sparse', 'steady', 'busy', 'packed')
    THEN place -> 'sensory' ->> 'crowd'
  END AS crowd
FROM places;
