# src/eval

The paid eval, run by `scripts/live-eval.ts` (`pnpm eval:live`, each round calling nothing until `EVAL_CONFIRM_USD` covers its worst case) and `scripts/eval-table.mts` (`pnpm eval:table`). The method and the results are in `docs/harness.md`.

- **What lives here:** anything that calls a model, spends money, or reads and writes round files: `round.ts` plans a round and holds the cost gate, then `intake-round.ts`, `day-round.ts`, `place-round.ts`, `replan-round.ts`, `voice/` and `schema-probe.ts`.
- **The rule:** no non-test module in `src` imports `src/eval`, which lint holds (`EVAL_IMPORTS` in `eslint.config.mjs`). The checks a live day runs stay in `src/lib/quality`, and this folder imports them. A test in `src` may import from here for a fixture's sake.
- **Why beside `src/lib`, not inside it:** `replan-round.ts` replays the page's own frame rule (`src/features/abacus/replan-frame`), so it imports from `features` as well as `lib`.
- **Plain Node:** `readme-table.ts` and `tally.ts` import each other and the app's types with relative `.ts` paths, because `scripts/eval-table.mts` runs them without a bundler.
