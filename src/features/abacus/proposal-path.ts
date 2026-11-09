/**
 * Where a proposal's dashed curve runs beside the day's (`docs/decisions.md`, "A changed word
 * proposes its part beside the day, and the visitor takes it"): the proposal's path is every
 * stop on screen but the day's own the proposal would replace, and it is drawn only where it
 * leaves the day's, from the stop both share before a part, through the proposal's stops, to the
 * stop both share after it. A part at the day's start or end runs from or to its first or last
 * proposed stop.
 */

/**
 * The runs of the proposal's path that differ from the day's, each as the indexes of its stops
 * in order: every step of it touches a proposed stop. `skipped` stops, such as a row still
 * entering, are on neither path yet.
 */
export function proposalRunsOf(
  ids: readonly string[],
  proposed: ReadonlySet<string>,
  replaced: ReadonlySet<string>,
  skipped: ReadonlySet<string> = new Set(),
): number[][] {
  const path = ids.flatMap((id, index) =>
    replaced.has(id) || skipped.has(id) ? [] : [{ id, index }],
  );
  const runs: number[][] = [];
  path.forEach(({ id, index }, at) => {
    const before = path[at - 1];
    if (before === undefined || (!proposed.has(before.id) && !proposed.has(id))) return;
    const run = runs.at(-1);
    if (run !== undefined && run.at(-1) === before.index) run.push(index);
    else runs.push([before.index, index]);
  });
  return runs;
}
