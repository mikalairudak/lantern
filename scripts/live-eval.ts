/**
 * `pnpm eval:live`: the live eval round (`docs/harness.md`, "B. The intake eval"). The
 * intake's golden set, three runs a case, through the intake route's code on Haiku and
 * Geoapify, scored with the live intake's gate; and day requests through the day route's
 * code, each a day on Sonnet and a shadow on Haiku, compared with a baseline's checks, and
 * every place in them checked on Geoapify as the route would and each meal by its name too,
 * each answer kept. It prints the plan and calls nothing unless `EVAL_CONFIRM_USD` names at
 * least the round's worst case, and each round then runs under its own cap at that worst case.
 * The schema probe asks Claude's token count first, which is free, and calls each model, held
 * to a few tokens, only when the count cannot tell (`src/eval/schema-probe.ts`).
 *
 *   EVAL_ROUND          intake, day, both (if unset), gate: the intake's two gate texts alone,
 *                       or suggest: its city suggestions and the cases that must not suggest,
 *                       or schema: whether Claude takes the day's schema, before any day round,
 *                       or replan-schema: a targeted re-plan's schema, on the day's model alone,
 *                       or replan: the re-plan's golden set (src/lib/fixtures/replan/golden-
 *                       replans.jsonl) through the re-plan route, on the day's model, no shadow
 *                       or voice: the voice rubric's judge (src/eval/voice/judge.ts) on its
 *                       labelled lines (src/lib/fixtures/voice/golden-lines.jsonl), or on the
 *                       days of the rounds EVAL_VOICE_DAYS names
 *   EVAL_RUNS           runs of each intake case (three, or ten for the gate), or of each day a
 *                       voice round judges (three)
 *   EVAL_JUDGE          who judges a voice round: sonnet (if unset) or haiku
 *   EVAL_VOICE_DAYS     saved day rounds' folders, separated by commas, whose days a voice round
 *                       judges; unset, it judges the labelled lines and measures the judge
 *   EVAL_VOICE_REPORT   a voice round's folder, reported again from the runs it saved: no call,
 *                       no key and no confirmation; its days are those its writers.json names,
 *                       read from where they were judged, and the report goes beside the runs;
 *                       EVAL_RUNS, if the round set it, is set again to the same
 *   EVAL_DAY_BODIES     the day requests, one JSON `DayRequest` a line
 *   EVAL_DAY_BASELINE   records to compare the days with: a JSON array, or a round's day-runs.jsonl
 *   EVAL_PLACES         whose places the day round checks: days (if unset), both, its days and
 *                       their shadows, for a round that compares the models, shadows alone, or none
 *   EVAL_SHADOW_EFFORT  an effort for the shadow's call alone, low, medium or high; unset, none is
 *                       sent and Haiku runs at its default (src/eval/shadow-experiment.ts)
 *   EVAL_SHADOW_RULE    versions: the day's rules for versions said again, last, on the shadow's
 *                       call alone; the visitor's day and its prompt stay as production sends them
 *   EVAL_OUT            where the runs and the report go (a new folder under eval-runs/ if unset,
 *                       which git ignores: the system's temp folder lost the rounds kept there)
 *   EVAL_REPLAN_SET     the re-plan set a replan round sends: golden (if unset), the golden
 *                       set; windows, company's windows on the written days
 *                       (src/lib/fixtures/replan/golden-windows.jsonl); or company, its cases
 *                       there and a start and a dinner of the golden set
 *                       (src/lib/fixtures/replan/golden-company.jsonl); or start-company,
 *                       the golden set's slow start made early three times, Bologna's
 *                       family twice and Nafplio's friends once
 *                       (src/lib/fixtures/replan/golden-start-company.jsonl); each case as
 *                       many times as its runs
 *   EVAL_CONFIRM_USD    at least the worst case the plan prints
 *
 * Keys come from the shell or `.env.local` (`ANTHROPIC_API_KEY`, `VISITOR_HASH_SALT`,
 * `GEOAPIFY_API_KEY`), and only their names are ever printed. It runs under Vitest, which
 * resolves the app's `@/` imports, with its own config (`vitest.live-eval.config.mts`), so
 * `pnpm test` never collects it. Nothing is written to a database: the runs and the places'
 * lookups are saved as JSON lines beside the report, for rescoring at no cost, and every place
 * is listed in places.txt for a reader to mark.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { anthropic } from "@ai-sdk/anthropic";
import { test } from "vitest";
import { goldenReplansOf } from "@/lib/fixtures/replan/golden-replans";
import { liveConfigOf } from "@/lib/live/flag";
import { MODEL_IDS } from "@/lib/live/models";
import { logToConsole } from "@/lib/live/provider-error";
import { geoapify, searchCities } from "@/lib/places/server";
import { baselineOf, dayBodiesOf, dayReport, dayRunLine, runDayRound } from "@/eval/day-round";
import { intakeCasesFor, intakeReport, intakeRunLine, runIntakeRound } from "@/eval/intake-round";
import { daysToCheck, placeReport, placeTable, runPlaceChecks } from "@/eval/place-round";
import { callsOf, replanReport, replanRunLine, runReplanRound } from "@/eval/replan-round";
import {
  countTokensOn,
  DAY_PROBE,
  probeReport,
  probeSchema,
  REPLAN_PROBE,
} from "@/eval/schema-probe";
import {
  confirmationFor,
  confirmationOf,
  liveEvalSettingsOf,
  missingFor,
  planReport,
  planRound,
  PROBE_ROUNDS,
  type LiveEvalSettings,
} from "@/eval/round";
import { experimentLabel, shadowModelFor } from "@/eval/shadow-experiment";
import { goldenLinesOf } from "@/eval/voice/lines";
import {
  labelledBatches,
  planVoiceRound,
  roundBatches,
  runVoiceRound,
  savedVoiceReport,
  voicePlanReport,
  voiceRoundReport,
} from "@/eval/voice/round";

/** The re-plan sets a replan round can send, by the name `EVAL_REPLAN_SET` gives. */
const REPLAN_SETS: Readonly<Record<string, URL>> = {
  golden: new URL("../src/lib/fixtures/replan/golden-replans.jsonl", import.meta.url),
  windows: new URL("../src/lib/fixtures/replan/golden-windows.jsonl", import.meta.url),
  company: new URL("../src/lib/fixtures/replan/golden-company.jsonl", import.meta.url),
  "start-company": new URL(
    "../src/lib/fixtures/replan/golden-start-company.jsonl",
    import.meta.url,
  ),
};

/** The set a replan round sends, by its name; a name no set has stops the round before any call. */
function replanSetOf(env: NodeJS.ProcessEnv): URL {
  const name = env.EVAL_REPLAN_SET?.trim() || "golden";
  const set = REPLAN_SETS[name];
  if (set === undefined) {
    throw new Error(`No re-plan set ${name}: ${Object.keys(REPLAN_SETS).join(" or ")}.`);
  }
  return set;
}
const GOLDEN_VOICE_LINES = new URL("../src/lib/fixtures/voice/golden-lines.jsonl", import.meta.url);

/** Longer than the worst intake or day round: 81 intakes and ten days of up to 150 s, one at a time. */
const ROUND_TIMEOUT_MS = 60 * 60 * 1000;

/**
 * A voice round has no clock (Vitest reads 0 as none): its length grows with the days it judges,
 * and round A's 72, 216 calls of about 17 s, ran out the hour on the last. Each of its calls has
 * a deadline (`VOICE_CALL_TIMEOUT_MS`) and the round a cap, which bound it instead.
 */
const VOICE_ROUND_TIMEOUT_MS = 0;

function say(lines: readonly string[]): void {
  process.stdout.write(`${lines.join("\n")}\n`);
}

/**
 * The round's folder: under the checkout's `eval-runs/` unless one is named. Rounds kept in the
 * system's temp folder lost their files there within days (2026-11-05: eight of ten day rounds
 * and the day's golden requests), and every rescoring at no cost reads them.
 */
function outDirOf(configured: string | null): string {
  const dir =
    configured ?? join("eval-runs", `live-eval-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function saver(path: string): (run: unknown) => void {
  return (run) => appendFileSync(path, `${JSON.stringify(run)}\n`);
}

/**
 * The voice round: the labelled lines, to measure the judge, or the days of saved rounds, to
 * score their writers; each day judged `EVAL_RUNS` times, three if unset, on the judge's model.
 */
async function runVoice(settings: LiveEvalSettings): Promise<void> {
  if (settings.voiceReport !== null) {
    reportVoiceAgain(settings.voiceReport, settings.runsPerCase);
    return;
  }
  const golden =
    settings.voiceDays.length === 0 ? goldenLinesOf(readFileSync(GOLDEN_VOICE_LINES, "utf8")) : [];
  const written = roundBatches(
    settings.voiceDays.map((dir) => ({
      name: dir,
      text: readFileSync(join(dir, "day-runs.jsonl"), "utf8"),
    })),
  );
  const batches = golden.length > 0 ? labelledBatches(golden) : written.batches;
  const role = settings.judge === "haiku" ? "shadow" : "day";
  const modelId = MODEL_IDS[role];
  const plan = planVoiceRound(batches, modelId, settings.runsPerCase);
  say([...voicePlanReport(plan), ...written.skipped.map((day) => `  Not judged: ${day}.`)]);
  const confirmation = confirmationFor(settings.confirmation, plan.worstUsd);
  if (confirmation.kind === "refused") {
    say([confirmation.reason]);
    return;
  }
  const missing = missingFor("voice", process.env);
  if (missing.length > 0) throw new Error(`No call made: ${missing.join(", ")} not set.`);

  const outDir = outDirOf(settings.outDir);
  say([`Writing the runs to ${outDir}`]);
  const save = saver(join(outDir, "voice-runs.jsonl"));
  if (golden.length === 0)
    writeFileSync(join(outDir, "writers.json"), JSON.stringify(written.writers));
  const round = await runVoiceRound({ model: anthropic(modelId), modelId, role }, batches, {
    runs: settings.runsPerCase,
    capUsd: plan.worstUsd,
    onRun: (run) => {
      save(run);
      const error = run.error === null ? "" : `, ${run.error}`;
      say([`${run.group} #${run.run}: ${Object.keys(run.verdicts).length} verdicts${error}`]);
    },
  });
  const report = voiceRoundReport({
    runs: round.runs,
    spentUsd: round.spentUsd,
    batches,
    runsPerDay: settings.runsPerCase,
    written: golden.length > 0 ? null : written,
    golden,
  });
  writeFileSync(join(outDir, "report.txt"), `${report.join("\n")}\n`);
  say(["", ...report, "", `Report: ${join(outDir, "report.txt")}`]);
}

/**
 * A voice round's report written again from its folder, calling nothing: its saved runs, and
 * for a round on saved days the day rounds its `writers.json` names, read from where they were
 * judged. The report goes beside the runs, `EVAL_OUT` aside.
 */
function reportVoiceAgain(dir: string, runsPerDay: number): void {
  const writersPath = join(dir, "writers.json");
  const report = [
    `Reported again from the runs saved in ${dir}; no call made.`,
    "",
    ...savedVoiceReport({
      runsText: readFileSync(join(dir, "voice-runs.jsonl"), "utf8"),
      writersText: existsSync(writersPath) ? readFileSync(writersPath, "utf8") : null,
      dayRunsOf: (round) => readFileSync(join(round, "day-runs.jsonl"), "utf8"),
      golden: goldenLinesOf(readFileSync(GOLDEN_VOICE_LINES, "utf8")),
      runsPerDay,
    }),
  ];
  writeFileSync(join(dir, "report.txt"), `${report.join("\n")}\n`);
  say([...report, "", `Report: ${join(dir, "report.txt")}`]);
}

const TEST_TIMEOUT_MS =
  process.env.EVAL_ROUND?.trim() === "voice" ? VOICE_ROUND_TIMEOUT_MS : ROUND_TIMEOUT_MS;

test("the live eval round", { timeout: TEST_TIMEOUT_MS }, async () => {
  const settings = liveEvalSettingsOf(process.env);
  if ("problem" in settings) throw new Error(settings.problem);
  if (settings.round === "voice") {
    await runVoice(settings);
    return;
  }
  const bodies =
    settings.dayBodiesPath === null
      ? []
      : dayBodiesOf(readFileSync(settings.dayBodiesPath, "utf8"));
  const baseline =
    settings.baselinePath === null ? [] : baselineOf(readFileSync(settings.baselinePath, "utf8"));
  const cases = intakeCasesFor(settings.round);
  const { runsPerCase } = settings;
  const probeKind = PROBE_ROUNDS[settings.round];
  const isSchemaProbe = probeKind !== undefined;
  const replans =
    settings.round === "replan"
      ? goldenReplansOf(readFileSync(replanSetOf(process.env), "utf8"))
      : [];
  const plan = planRound(cases, bodies, {
    runsPerCase,
    probe: probeKind ?? null,
    replanCases: callsOf(replans),
    places: settings.places,
  });
  const experiment = experimentLabel(settings.shadow);
  const experimentLine =
    experiment === null ? [] : [`  Shadow changed for this round: ${experiment}.`];
  say([...planReport(plan), ...experimentLine]);
  const confirmation = confirmationOf(settings.confirmation, plan);
  if (confirmation.kind === "refused") {
    say([confirmation.reason]);
    return;
  }
  const missing = missingFor(settings.round, process.env);
  if (missing.length > 0) throw new Error(`No call made: ${missing.join(", ")} not set.`);

  const outDir = outDirOf(settings.outDir);
  if (isSchemaProbe) {
    const target = probeKind === "replan" ? REPLAN_PROBE : DAY_PROBE;
    const probe = await probeSchema(
      {
        countTokens: countTokensOn(process.env.ANTHROPIC_API_KEY?.trim() ?? ""),
        modelOf: (role) => anthropic(MODEL_IDS[role]),
      },
      target,
    );
    const lines = probeReport(probe, target);
    writeFileSync(join(outDir, "report.txt"), `${lines.join("\n")}\n`);
    say(["", ...lines, "", `Report: ${join(outDir, "report.txt")}`]);
    return;
  }
  say([`Writing the runs to ${outDir}`]);
  const config = liveConfigOf(process.env);
  const newId = () => crypto.randomUUID();
  if (replans.length > 0) {
    // Each run keeps its record, the model's text with it, for scoring again at no cost.
    const save = saver(join(outDir, "replan-runs.jsonl"));
    const round = await runReplanRound(
      { config, model: anthropic(MODEL_IDS.day), log: logToConsole, newId, now: () => new Date() },
      replans,
      {
        onRun: (run) => {
          save(run);
          say([replanRunLine(run)]);
        },
      },
    );
    const lines = replanReport(round);
    writeFileSync(join(outDir, "report.txt"), `${lines.join("\n")}\n`);
    say(["", ...lines, "", `Report: ${join(outDir, "report.txt")}`]);
    return;
  }
  const report: string[] = [];
  if (cases.length > 0) {
    const save = saver(join(outDir, "intake-runs.jsonl"));
    const round = await runIntakeRound(
      {
        config,
        model: anthropic(MODEL_IDS.intake),
        search: searchCities,
        log: logToConsole,
        newId,
      },
      {
        cases,
        runsPerCase,
        onRun: (run) => {
          save(run);
          say([intakeRunLine(run)]);
        },
      },
    );
    report.push(...intakeReport(round), "");
  }
  if (bodies.length > 0) {
    const save = saver(join(outDir, "day-runs.jsonl"));
    const models = {
      day: anthropic(MODEL_IDS.day),
      shadow: shadowModelFor(anthropic(MODEL_IDS.shadow), settings.shadow),
    };
    const round = await runDayRound(
      { config, models, log: logToConsole, newId, now: () => new Date() },
      bodies,
      {
        onRun: (run) => {
          save(run);
          say([dayRunLine(run)]);
        },
      },
    );
    report.push(...experimentLine, ...dayReport(round, baseline), "");
    const toCheck = daysToCheck(round.runs, settings.places);
    if (toCheck.length > 0) {
      say(["", "Checking the places on Geoapify…"]);
      const places = await runPlaceChecks(geoapify, toCheck, {
        maxLookups: plan.placeLookupsCap,
        onCheck: saver(join(outDir, "place-checks.jsonl")),
      });
      report.push(...placeReport(places));
      writeFileSync(join(outDir, "places.txt"), `${placeTable(places).join("\n")}\n`);
    }
  }
  writeFileSync(join(outDir, "report.txt"), `${report.join("\n")}\n`);
  say(["", ...report, "", `Report: ${join(outDir, "report.txt")}`]);
});
