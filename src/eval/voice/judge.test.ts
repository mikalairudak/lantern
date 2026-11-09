// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fakeClaude, rejectionNamed, type ClaudeAnswer } from "@/lib/fixtures/live/mock-claude";
import {
  inputTokensCeilingFor,
  judgeVoice,
  maxOutputTokensFor,
  VOICE_INSTRUCTIONS,
  VoiceJudgementSchema,
  voicePromptFor,
  type JudgedLine,
} from "./judge";
import type { VoiceLine } from "./lines";

const LINES: VoiceLine[] = [
  {
    id: "day-001/dek",
    group: "day-001",
    time: "",
    place: "",
    kind: "",
    isAlternative: false,
    role: "dek",
    text: "Honen-in before eight and the canal path down to Nanzen-ji.",
  },
  {
    id: "day-001/stop-0:p/summary",
    group: "day-001",
    time: "07:30",
    place: "Honen-in",
    kind: "sacred",
    isAlternative: false,
    role: "summary",
    text: "The grounds open at six, so at half past seven you have the gate to yourself.",
  },
  {
    id: "day-001/stop-0:a1/reason",
    group: "day-001",
    time: "07:30",
    place: "Anraku-ji",
    kind: "sacred",
    isAlternative: true,
    role: "reason",
    text: "The same quiet hillside, with a smaller garden instead of the sand mounds.",
  },
];

const PASS = { why: "", concrete: true, plain: true, earned: true };

function answered(verdicts: JudgedLine[]): ClaudeAnswer {
  return {
    kind: "message",
    text: JSON.stringify({ verdicts }),
    usage: { input: 4_000, output: 300 },
  };
}

function judgeOn(answer: ClaudeAnswer) {
  const claude = fakeClaude(answer);
  const judge = {
    model: claude.provider("claude-sonnet-5-5"),
    modelId: "claude-sonnet-5-5" as const,
    role: "day" as const,
    maxRetries: 0,
  };
  return { judge, requests: claude.requests };
}

describe("the voice judge's prompt", () => {
  it("lists every line by its id under its stop's hour, the line about the day first", () => {
    const prompt = voicePromptFor(LINES);

    expect(prompt).toContain(
      "The day\n    [day-001/dek] line about the day: Honen-in before eight",
    );
    expect(prompt).toContain(
      "Stop at 07:30: Honen-in (sacred)\n    [day-001/stop-0:p/summary] summary:",
    );
    expect(prompt).toContain(
      "  Alternative at 07:30: Anraku-ji (sacred)\n    [day-001/stop-0:a1/reason] swap reason:",
    );
  });

  it("asks the three tests with the owner's rulings, and never says who wrote the day", () => {
    for (const phrase of [
      "CONCRETE",
      "PLAIN",
      "EARNED",
      "a count nothing can check",
      "a relation between two places",
      "hyperbole",
      "literally visible",
      "One tip per stop",
      "The day of the week alone does not earn the hour",
      "Try it against the other hours of daylight",
      "what the alternative shares with the stop",
    ]) {
      expect(VOICE_INSTRUCTIONS).toContain(phrase);
    }
    expect(`${VOICE_INSTRUCTIONS}${voicePromptFor(LINES)}`).not.toMatch(/sonnet|haiku|claude/i);
  });

  it("keeps its schema portable: strict objects, every field required, no limits", () => {
    const json = JSON.stringify(z.toJSONSchema(VoiceJudgementSchema));

    expect(json).not.toMatch(
      /minItems|maxItems|minLength|maxLength|pattern|format|minimum|maximum/,
    );
    expect(json).toContain('"additionalProperties":false');
  });

  it("caps what a batch may read and write by its lines", () => {
    expect(maxOutputTokensFor(LINES)).toBeLessThan(maxOutputTokensFor([...LINES, ...LINES]));
    expect(inputTokensCeilingFor(LINES)).toBeGreaterThan(VOICE_INSTRUCTIONS.length / 2);
  });
});

describe("judgeVoice", () => {
  it("takes each line's verdict by its id, and what the call cost", async () => {
    const { judge, requests } = judgeOn(
      answered([
        { id: "day-001/dek", ...PASS },
        { id: "day-001/stop-0:p/summary", ...PASS },
        {
          id: "day-001/stop-0:a1/reason",
          why: "Trades nothing it names.",
          concrete: true,
          plain: true,
          earned: false,
        },
      ]),
    );

    const judgement = await judgeVoice(judge, LINES);

    expect(judgement.error).toBeNull();
    expect(judgement.unjudged).toEqual([]);
    expect(judgement.verdicts.get("day-001/stop-0:a1/reason")).toEqual({
      why: "Trades nothing it names.",
      concrete: true,
      plain: true,
      earned: false,
    });
    expect(judgement.costUsd).toBeCloseTo((4_000 * 2 + 300 * 10) / 1_000_000);
    expect(requests[0]).toMatchObject({ model: "claude-sonnet-5-5" });
  });

  it("leaves a line the judge skipped without a verdict, and ignores an id it was not sent", async () => {
    const { judge } = judgeOn(
      answered([
        { id: "day-001/dek", ...PASS },
        { id: "day-002/dek", ...PASS },
        {
          id: "day-001/dek",
          why: "A second verdict.",
          concrete: false,
          plain: false,
          earned: false,
        },
      ]),
    );

    const judgement = await judgeVoice(judge, LINES);

    expect([...judgement.verdicts.keys()]).toEqual(["day-001/dek"]);
    expect(judgement.verdicts.get("day-001/dek")).toMatchObject(PASS);
    expect(judgement.unjudged).toEqual(["day-001/stop-0:p/summary", "day-001/stop-0:a1/reason"]);
  });

  it("gives no verdict at all when the call fails, never a guessed one", async () => {
    const { judge } = judgeOn({
      kind: "failure",
      failure: rejectionNamed("the organization's credits run out"),
    });

    const judgement = await judgeVoice(judge, LINES);

    expect(judgement.verdicts.size).toBe(0);
    expect(judgement.unjudged).toHaveLength(LINES.length);
    expect(judgement.error).toContain("credit balance is too low");
  });

  it("gives no verdict when the answer is not a judgement", async () => {
    const { judge } = judgeOn({
      kind: "message",
      text: '{"verdicts": [{"id":',
      usage: { input: 10, output: 5 },
    });

    const judgement = await judgeVoice(judge, LINES);

    expect(judgement.verdicts.size).toBe(0);
    expect(judgement.error).toMatch(/^no judgement in the answer/);
  });
});
