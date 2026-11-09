-- Whether a day's stream was cut and the visitor still got the day the salvage rule kept
-- (src/lib/stream/read-day-stream.ts): true, and `repairs` and `checks` are that day's; false
-- for every other day, a cut that kept nothing included. NULL for an intake, and for the rows
-- written before this column, which cannot tell the two cuts apart.

ALTER TABLE generation_log ADD COLUMN salvaged boolean;
