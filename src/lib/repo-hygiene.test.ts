// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { describeFileFault, findFileFaults, HYGIENE_RULES } from "./repo-hygiene";

/**
 * Everything committed is public, so every tracked text file is held to the rules a pattern
 * can see (`CLAUDE.md`, "Everything committed is public").
 */

const ROOT = join(__dirname, "..", "..");
/**
 * The rules and this test spell out what they forbid, to find it and to plant it, so the scan
 * leaves them out.
 */
const SPELLS_OUT_THE_RULES = new Set(["src/lib/repo-hygiene.ts", "src/lib/repo-hygiene.test.ts"]);
/** Images, fonts and other files that hold no text to read. */
const BINARY_FILE = /\.(?:png|gif|ico|jpe?g|webp|avif|ttf|otf|woff2?|pdf|mp4|webm)$/i;
const NUL = 0;

/** Tracked files, by their names as written: `-z`, or git quotes a name such as `café.png`. */
function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
    .split("\0")
    .filter((file) => file !== "" && existsSync(join(ROOT, file)));
}

function textOf(file: string): string | null {
  if (BINARY_FILE.test(file)) return null;
  const bytes = readFileSync(join(ROOT, file));
  return bytes.includes(NUL) ? null : bytes.toString("utf8");
}

const tracked = trackedFiles();
const scanned = tracked
  .filter((file) => !SPELLS_OUT_THE_RULES.has(file))
  .flatMap((file) => {
    const text = textOf(file);
    return text === null ? [] : [{ file, text }];
  });

function ruleNamed(name: string) {
  const rule = HYGIENE_RULES.find((candidate) => candidate.name === name);
  if (rule === undefined) throw new Error(`No rule named ${name}`);
  return rule;
}

function rulesFoundIn(path: string, text: string): string[] {
  return findFileFaults(path, text).map(({ rule }) => rule);
}

/** Built from parts, so no scanner of this public file takes a planted key for a real one. */
const FAKE_KEYS = [
  `sk-ant-api03-${"x".repeat(24)}`,
  `ghp_${"A".repeat(36)}`,
  `github_pat_${"B".repeat(30)}`,
  `AKIA${"Z".repeat(16)}`,
];

interface RuleCase {
  readonly rule: string;
  /** Where the text stands, which a rule's allowances read. */
  readonly path: string;
  readonly caught: readonly string[];
  readonly passes: readonly string[];
}

const RULE_CASES: readonly RuleCase[] = [
  {
    rule: "Cyrillic letters",
    path: "src/lib/example.ts",
    caught: ['const city = "\u041b\u0438\u0441\u0441\u0430\u0431\u043e\u043d";'],
    passes: ["Café in Kraków, Hōnen-in and Łódź: Latin with any accent."],
  },
  {
    rule: "Link to a chat or session",
    path: "docs/example.md",
    caught: ["As discussed in https://claude.ai/chat/0b1c2d3e."],
    passes: ["Generated with [Claude Code](https://claude.com/claude-code); Claude.ai is a site."],
  },
  {
    rule: "Session trailer",
    path: "docs/example.md",
    caught: ["Claude-Session: 0b1c2d3e"],
    passes: ["A trailer such as Claude-Session: is left out."],
  },
  {
    rule: "Local path",
    path: "src/lib/example.ts",
    caught: [
      "Run /Users/someone/Projects/lantern/scripts/x.mts",
      'cwd: "/home/someone/lantern"',
      "C:\\Users\\someone\\lantern",
      "Logged to /private/tmp/out.log",
      "See /tmp/claude-501/scratchpad",
      "Socket at /tmp/cc-socks/main.sock",
    ],
    passes: [
      "Settings live in ~/.claude/settings.json.",
      "https://api.github.com/users/someone/repos and https://example.com/home/page/",
      "The server logs to /tmp/e2e.log.",
    ],
  },
  {
    rule: "Agent machinery",
    path: "docs/example.md",
    caught: ["Merged worktree-agent-a1b2c3d4.", "Reached at uds:main.sock."],
    passes: [
      "Answer with SendMessage; the engineering session runs in a worktree.",
      "Each of the builds: three.",
    ],
  },
  {
    rule: "Record of approval",
    path: "docs/example.md",
    caught: [
      "The owner said yes to the fork.",
      "Once the owner says yes, it ships.",
      "Merged with the owner's yes.",
      "The owner signed off the answers.",
      "As the owner asked, the row folds.",
      "A change asked by the owner.",
      "Added at the owner's request.",
      "Kept the fork (the owner, 2026-11-08).",
    ],
    passes: [
      "A release, on the owner's word, fast-forwards main.",
      "The intake signed the city, and the owner chose the fork for three reasons.",
      "It says yesterday's date.",
    ],
  },
  {
    rule: "Email address",
    path: "src/lib/example.ts",
    caught: [
      "Write to someone@gmail.com.",
      'const url = "postgresql://lantern:s3cret@ep-real-1234.eu-central-1.aws.neon.tech/neondb";',
    ],
    passes: [
      "Write to support@lanternday.com.",
      "Author: 1234+someone@users.noreply.github.com",
      "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>",
      "someone@db.test, someone@mail.example, someone@example.com, someone@host.invalid",
      '"next@16.4.2", "@types/node" and "postgresql://lantern@localhost/lantern"',
    ],
  },
  {
    rule: "API key",
    path: "src/lib/example.ts",
    caught: FAKE_KEYS,
    passes: ["Anthropic's keys start sk-ant-api03-, GitHub's ghp_ or github_pat_, AWS's AKIA."],
  },
  {
    rule: "Commit hash",
    path: "docs/example.md",
    caught: ["Fixed in 2276e6bf.", "The bug came with `1c1c734f`."],
    passes: [
      "A kept day's id, 550e8400-e29b-41d4-a716-446655440000.",
      "The ground is #1a2b3c4d.",
      `A file's SHA-256, ${"ab12".repeat(16)}.`,
      "max-age=63072000, a feedback card, a decade.",
    ],
  },
];

describe("the rules for what is committed", () => {
  it.each(RULE_CASES)("$rule: catches what it forbids and passes a near miss", (ruleCase) => {
    for (const text of ruleCase.caught) {
      expect(rulesFoundIn(ruleCase.path, text), text).toContain(ruleCase.rule);
    }
    for (const text of ruleCase.passes) {
      expect(rulesFoundIn(ruleCase.path, text), text).toEqual([]);
    }
  });

  it("covers every rule with a case", () => {
    expect(RULE_CASES.map(({ rule }) => rule)).toEqual(HYGIENE_RULES.map(({ name }) => name));
  });

  it("names the file, the line, the rule and what it found", () => {
    const path = "docs/example.md";
    const text = ["# Notes", "", "Merged with the owner's yes, in 2276e6bf."].join("\n");

    expect(findFileFaults(path, text).map((fault) => describeFileFault(path, fault))).toEqual([
      `${path}:3 Record of approval: "owner's yes". ${ruleNamed("Record of approval").reason}`,
      `${path}:3 Commit hash: "2276e6bf". ${ruleNamed("Commit hash").reason}`,
    ]);
  });

  it("lets a listed file hold what the rule is listed for, and only that rule", () => {
    const cyrillic = "\u041a\u0430\u0444\u0435";

    expect(rulesFoundIn("src/lib/quality/checks.test.ts", cyrillic)).toEqual([]);
    expect(
      rulesFoundIn("src/lib/quality/checks.test.ts", `${cyrillic} at /Users/someone/`),
    ).toEqual(["Local path"]);
  });

  it("passes a fake connection string in a test file and finds it in any other", () => {
    const line = 'const url = "postgresql://lantern:s3cret@ep-test-1234.neon.tech/neondb";';

    expect(rulesFoundIn("src/lib/db/sql.test.ts", line)).toEqual([]);
    expect(rulesFoundIn("e2e/privacy.spec.ts", line)).toEqual([]);
    expect(rulesFoundIn("src/lib/db/sql.ts", line)).toEqual(["Email address"]);
    expect(rulesFoundIn("src/lib/db/sql.test.ts", "Write to someone@gmail.com.")).toEqual([
      "Email address",
    ]);
  });

  it("reads hashes in Markdown's prose alone, not in its fenced code or in other files", () => {
    const markdown = ["Before.", "```", "git show 2276e6bf", "```", "After 1c1c734f."].join("\n");

    expect(findFileFaults("docs/example.md", markdown)).toEqual([
      expect.objectContaining({ line: 5, found: "1c1c734f" }),
    ]);
    expect(rulesFoundIn("src/lib/example.ts", "// see 2276e6bf")).toEqual([]);
  });
});

describe("the tracked files", () => {
  it("reads the tree, so the check is not reading nothing", () => {
    expect(scanned.length).toBeGreaterThan(500);
  });

  it("keeps each listed file, and each still holds what it is listed for", () => {
    const stale = HYGIENE_RULES.flatMap((rule) =>
      Object.keys(rule.allowedFiles ?? {})
        .filter((file) => {
          const text = tracked.includes(file) ? textOf(file) : null;
          return text === null || [...text.matchAll(rule.pattern)].length === 0;
        })
        .map((file) => `${rule.name}: ${file}`),
    );

    expect(stale).toEqual([]);
  });

  it("hold nothing the rules forbid", () => {
    const faults = scanned.flatMap(({ file, text }) =>
      findFileFaults(file, text).map((fault) => describeFileFault(file, fault)),
    );

    expect(faults).toEqual([]);
  });
});
