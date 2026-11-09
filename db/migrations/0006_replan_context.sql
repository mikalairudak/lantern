-- What a targeted re-plan read beyond its request (src/lib/live/generation-log.ts,
-- `ReplanContext`): the changed word, the page's count of re-plans, the windows and the day it
-- merged into, so a re-plan can be scored and run again offline (docs/targeted-replan.md,
-- section 5). Model output and the visitor's choices, never their text or address. NULL for
-- every other call, whose records never name the column.

ALTER TABLE generation_log ADD COLUMN context jsonb;
