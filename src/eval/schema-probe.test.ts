// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FIXTURE_REQUEST_ID, fakeClaude, type ClaudeAnswer } from "@/lib/fixtures/live/mock-claude";
import {
  MODEL_IDS,
  PRICES_PER_MILLION,
  REPLAN_INPUT_TOKENS_CEILING,
  worstCaseUsd,
} from "@/lib/live/models";
import { REPLAN_PROMPT_VERSION } from "@/lib/live/replan-prompt";
import { GeneratedDaySchema } from "@/lib/schema/itinerary.schema";
import { planReport, planRound, PROBE_MAX_OUTPUT_TOKENS, worstUsdOf } from "./round";
import {
  ANTHROPIC_VERSION,
  COUNT_TOKENS_URL,
  countRequestOf,
  countTokensOn,
  isGrammarRefusal,
  probeReport,
  probeSchema,
  RefusedControlSchema,
  REPLAN_PROBE,
  requestOf,
  type ApiAnswer,
  type CapturedRequest,
  type ProbeServices,
} from "./schema-probe";

/** The provider's answer to the `day-v3` round's 24 calls. */
const GRAMMAR_MESSAGE =
  "The compiled grammar is too large, which would cause performance issues. Simplify your tool schemas or reduce the number of strict tools.";
const REFUSED: ApiAnswer = {
  status: 400,
  body: { type: "error", error: { type: "invalid_request_error", message: GRAMMAR_MESSAGE } },
};
const COUNTED: ApiAnswer = { status: 200, body: { input_tokens: 6_957 } };

function unionCount(node: unknown): number {
  if (typeof node !== "object" || node === null) return 0;
  const schema = node as { anyOf?: unknown; type?: unknown; properties?: object; items?: unknown };
  const own = schema.anyOf !== undefined || Array.isArray(schema.type) ? 1 : 0;
  const inner = Object.values(schema.properties ?? {}).reduce<number>(
    (sum, value) => sum + unionCount(value),
    0,
  );
  return own + inner + unionCount(schema.items);
}

/** Whether a captured request is the control's: the day's schema has fewer union types. */
function isControl({ body }: CapturedRequest): boolean {
  const format = (body.output_config as { format?: { schema?: unknown } } | undefined)?.format;
  return unionCount(format?.schema) > unionCount(z.toJSONSchema(GeneratedDaySchema));
}

/** A model that must not be asked: the token count settled the probe. */
function noModel(): never {
  throw new Error("The probe called a model it did not need");
}

function services(
  count: (request: CapturedRequest) => ApiAnswer,
  answer?: ClaudeAnswer,
): ProbeServices & { counted: CapturedRequest[] } {
  const counted: CapturedRequest[] = [];
  const provider = answer === undefined ? null : fakeClaude(answer).provider;
  return {
    counted,
    countTokens: (request) => {
      counted.push(request);
      return Promise.resolve(count(request));
    },
    modelOf: (role) => (provider === null ? noModel() : provider(MODEL_IDS[role])),
  };
}

describe("the request the probe counts", () => {
  it("is the day's own call, its schema as the provider gets it, held to a few tokens", async () => {
    const { body, beta } = await requestOf("day", GeneratedDaySchema);

    expect(body).toMatchObject({
      model: MODEL_IDS.day,
      max_tokens: PROBE_MAX_OUTPUT_TOKENS,
      stream: true,
      output_config: { format: { type: "json_schema" } },
    });
    expect(beta).toBeNull();
    expect(countRequestOf({ body, beta }).body).not.toHaveProperty("stream");
    expect(countRequestOf({ body, beta }).body).not.toHaveProperty("max_tokens");
    expect(countRequestOf({ body, beta }).body).toHaveProperty("output_config");
  });

  // The control must be the refused schema's structure: eleven union types where the day has seven.
  it("has a control with day-v3's eleven union types, where the day has five", () => {
    expect(unionCount(z.toJSONSchema(RefusedControlSchema))).toBe(11);
    expect(unionCount(z.toJSONSchema(GeneratedDaySchema))).toBe(5);
  });
});

describe("isGrammarRefusal", () => {
  it("knows the provider refusing a schema's grammar, and nothing else", () => {
    expect(isGrammarRefusal(REFUSED)).toBe(true);
    expect(
      isGrammarRefusal({
        status: 400,
        body: { error: { message: "Schema is too complex for compilation." } },
      }),
    ).toBe(true);
    expect(isGrammarRefusal({ status: 400, body: { error: { message: "max_tokens: 0" } } })).toBe(
      false,
    );
    expect(isGrammarRefusal(COUNTED)).toBe(false);
    expect(isGrammarRefusal({ status: 400, body: "not json" })).toBe(false);
  });
});

describe("countTokensOn", () => {
  it("posts the request to the token count with the key in a header, and reads the answer", async () => {
    const sent: { url: string; init: RequestInit | undefined }[] = [];
    const count = countTokensOn("sk-probe", (url, init) => {
      sent.push({ url: String(url), init });
      return Promise.resolve(new Response(JSON.stringify({ input_tokens: 42 }), { status: 200 }));
    });

    const answer = await count({ body: { model: "m" }, beta: "some-beta" });

    expect(answer).toEqual({ status: 200, body: { input_tokens: 42 } });
    expect(sent[0]?.url).toBe(COUNT_TOKENS_URL);
    expect(sent[0]?.init?.headers).toMatchObject({
      "x-api-key": "sk-probe",
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-beta": "some-beta",
    });
    expect(JSON.parse(String(sent[0]?.init?.body))).toEqual({ model: "m" });
  });

  it("keeps a body that is not JSON as its text", async () => {
    const count = countTokensOn("k", () => Promise.resolve(new Response("down", { status: 503 })));

    await expect(count({ body: {}, beta: null })).resolves.toEqual({ status: 503, body: "down" });
  });
});

describe("probeSchema", () => {
  it("takes the token count's word for free when the count refuses the control", async () => {
    const probing = services((request) => (isControl(request) ? REFUSED : COUNTED));

    const probe = await probeSchema(probing);

    expect(probe.isCountConclusive).toBe(true);
    expect(
      probe.roles.map(({ role, verdict, by, costUsd }) => [role, verdict, by, costUsd]),
    ).toEqual([
      ["day", "taken", "count", 0],
      ["shadow", "taken", "count", 0],
    ]);
    expect(probing.counted).toHaveLength(3);
  });

  it("stops at the token count's refusal of the day's schema, which needs no call", async () => {
    const probe = await probeSchema(services(() => REFUSED));

    expect(probe.roles.map(({ verdict, by, detail }) => [verdict, by, detail])).toEqual([
      ["refused", "count", GRAMMAR_MESSAGE],
      ["refused", "count", GRAMMAR_MESSAGE],
    ]);
  });

  it("calls each model, held to a few tokens, when the count cannot tell", async () => {
    const usage = { input: 6_957, output: PROBE_MAX_OUTPUT_TOKENS };
    const probe = await probeSchema(
      services(() => COUNTED, {
        kind: "message",
        text: '{"assumptions":{"tra',
        stopReason: "max_tokens",
        usage,
      }),
    );

    expect(probe.isCountConclusive).toBe(false);
    expect(probe.roles.map(({ verdict, by }) => [verdict, by])).toEqual([
      ["taken", "call"],
      ["taken", "call"],
    ]);
    const price = PRICES_PER_MILLION[MODEL_IDS.day];
    const expected = (usage.input * price.input + usage.output * price.output) / 1_000_000;
    expect(probe.roles[0]?.costUsd).toBeCloseTo(expected, 8);
    expect(probe.roles[0]?.detail).toBe("wrote until length");
  });

  it("reads the call's refusal of the grammar, with its request id", async () => {
    const probe = await probeSchema(
      services(() => COUNTED, {
        kind: "failure",
        failure: {
          name: "grammar",
          status: 400,
          type: "invalid_request_error",
          message: GRAMMAR_MESSAGE,
        },
      }),
    );

    expect(probe.roles[0]).toMatchObject({
      verdict: "refused",
      by: "call",
      costUsd: 0,
      requestId: FIXTURE_REQUEST_ID,
    });
    expect(probe.roles[0]?.detail).toContain("compiled grammar is too large");
  });

  it("stops on any other failure of the call, which says nothing of the schema", async () => {
    const probing = services(() => COUNTED, {
      kind: "failure",
      failure: { name: "key", status: 401, type: "authentication_error", message: "invalid" },
    });

    await expect(probeSchema(probing)).rejects.toThrow("The probe's call failed otherwise");
  });
});

describe("the probe's plan and report", () => {
  it("prices the two calls it may make, and nothing else", () => {
    const plan = planRound([], [], { probe: "day" });
    const report = planReport(plan);

    expect(plan).toMatchObject({ isSchemaProbe: true, intakeCalls: 0, liveDays: 0 });
    expect(worstUsdOf(plan)).toBeGreaterThan(0.02);
    expect(worstUsdOf(plan)).toBeLessThan(0.022);
    expect(report[1]).toContain("one call each to claude-sonnet-5-5 and claude-haiku-5-5");
    expect(report[2]).toMatch(
      /^ {2}Expected \$0 if the count tells, else about \$0\.01\d{2}; at most \$0\.0212\.$/,
    );
  });

  it("ends on whether a day round may follow", () => {
    const taken = probeReport({
      isCountConclusive: true,
      roles: [
        {
          role: "day",
          model: MODEL_IDS.day,
          verdict: "taken",
          by: "count",
          costUsd: 0,
          detail: "counted",
          requestId: null,
        },
      ],
    });
    const refused = probeReport({
      isCountConclusive: false,
      roles: [
        {
          role: "day",
          model: MODEL_IDS.day,
          verdict: "refused",
          by: "call",
          costUsd: 0,
          detail: GRAMMAR_MESSAGE,
          requestId: "req_1",
        },
      ],
    });

    expect(taken.at(-1)).toBe("The provider takes the schema: a day round may follow.");
    expect(taken[1]).toContain("its answers stand");
    expect(refused[2]).toContain("refused by the call, $0.0000");
    expect(refused[2]).toContain("(req_1)");
    expect(refused.at(-1)).toBe(
      "The provider refuses the schema: no day round until it is simpler.",
    );
  });
});

// A targeted re-plan's schema is probed before its first round (`docs/targeted-replan.md`).
describe("the probe of a re-plan's schema", () => {
  const countedTaken = (request: CapturedRequest): ApiAnswer =>
    isControl(request) ? REFUSED : COUNTED;

  it("asks the day's model alone, with the re-plan's own instructions and a schema with no assumptions", async () => {
    const probing = services(countedTaken);

    const probe = await probeSchema(probing, REPLAN_PROBE);

    expect(probe.roles).toEqual([
      expect.objectContaining({ role: "day", verdict: "taken", by: "count", costUsd: 0 }),
    ]);
    const asked = probing.counted.find((request) => !isControl(request));
    const sent = JSON.stringify(asked?.body);
    expect(sent).toContain("You re-plan part of one day");
    expect(sent).toContain("<kept>");
    const format = (asked?.body.output_config as { format?: { schema?: { properties?: object } } })
      ?.format;
    expect(Object.keys(format?.schema?.properties ?? {})).toEqual(["stops", "alternatives", "dek"]);
  });

  it("says which schema it asked about and that a re-plan round may follow", async () => {
    const probe = await probeSchema(services(countedTaken), REPLAN_PROBE);

    const report = probeReport(probe, REPLAN_PROBE);

    expect(report[0]).toBe(`Schema probe: ${REPLAN_PROMPT_VERSION}'s schema, spent $0.0000.`);
    expect(report.at(-1)).toBe("The provider takes the schema: a re-plan round may follow.");
  });

  it("plans one call to the day's model when the count cannot tell", () => {
    const report = planReport(planRound([], [], { runsPerCase: 1, probe: "replan" })).join("\n");

    expect(report).toContain(`${REPLAN_PROMPT_VERSION}'s schema`);
    expect(report).toContain(`one call to ${MODEL_IDS.day} held to`);
    expect(report).not.toContain(MODEL_IDS.shadow);
  });

  it("holds the re-plan's call to the re-plan's input ceiling, which its first probe passed the day's by", () => {
    const plan = planRound([], [], { runsPerCase: 1, probe: "replan" });

    // The first probe read about 8,670 tokens and cost $0.0175; the day's ceiling quoted $0.0162.
    expect(plan.probeWorstUsd).toBeCloseTo(
      worstCaseUsd(MODEL_IDS.day, REPLAN_INPUT_TOKENS_CEILING, PROBE_MAX_OUTPUT_TOKENS),
      10,
    );
    expect(plan.probeWorstUsd).toBeGreaterThan(0.0175);
  });
});
