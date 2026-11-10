// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  describeFileFault,
  findFileFaults,
  findMessageFaults,
  findPullRequestFaults,
  HYGIENE_RULES,
  type PullRequestText,
  runCommitMessageCheck,
  runPullRequestTextCheck,
} from "./repo-hygiene";

/**
 * Everything committed is public, so every tracked text file is held to the rules a pattern
 * can see (`CLAUDE.md`, "Everything committed is public"), and the same module holds each commit's
 * message and each pull request's text to them.
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

function rulesFoundInMessage(message: string): string[] {
  return findMessageFaults(message).map(({ rule }) => rule);
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

  it("closes a fence only on a marker of the same character, as long or longer", () => {
    const markdown = [
      "````",
      "~~~",
      "git show 2276e6bf",
      "```",
      "still code: 1c1c734f",
      "`````",
      "After 3d4e5f6a.",
    ].join("\n");

    expect(findFileFaults("docs/example.md", markdown)).toEqual([
      expect.objectContaining({ line: 7, found: "3d4e5f6a" }),
    ]);
  });
});

describe("the commit message check", () => {
  const CLEAN = [
    "fix: keep the fork's line under the headline",
    "",
    "A phone shows the fork below the screen, so the line says where it is.",
    "",
    "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>",
  ].join("\n");

  it("passes a clean message and prints nothing", () => {
    const printed: string[] = [];

    expect(runCommitMessageCheck(CLEAN, (line) => printed.push(line))).toBe(0);
    expect(printed).toEqual([]);
  });

  it("fails a message that breaks a rule, naming each line and rule", () => {
    const message = [
      "fix: fold the row",
      "",
      "The owner said yes; see https://claude.ai/chat/0b1c.",
      "\u0413\u043e\u0442\u043e\u0432\u043e.",
    ].join("\n");
    const printed: string[] = [];

    expect(runCommitMessageCheck(message, (line) => printed.push(line))).toBe(1);
    expect(printed.join("\n")).toContain('line 3, Record of approval: "owner said"');
    expect(printed.join("\n")).toContain("line 3, Link to a chat or session");
    expect(printed.join("\n")).toContain("line 4, Cyrillic letters");
  });

  it("skips git's comment lines and counts them in the line numbers", () => {
    const message = [
      "# Please enter the commit message for your changes.",
      "# On branch worktree-agent-a1b2, from /Users/someone/lantern",
      "fix: fold the row, as the owner asked",
    ].join("\n");

    expect(findMessageFaults(message)).toEqual([
      expect.objectContaining({ line: 3, rule: "Record of approval" }),
    ]);
  });

  it("reads nothing below the scissors line", () => {
    const message = [
      CLEAN,
      "# ------------------------ >8 ------------------------",
      "# Do not modify or remove the line above.",
      "+// The owner said yes at /Users/someone/lantern, \u0434\u0430.",
    ].join("\n");

    expect(rulesFoundInMessage(message)).toEqual([]);
  });

  it("holds a message to every rule but the hash's, which git's own messages cite", () => {
    expect(rulesFoundInMessage("Revert 2276e6bf: it broke the fold.")).toEqual([]);
    expect(rulesFoundInMessage(`Rotate ${FAKE_KEYS[0]}.`)).toEqual(["API key"]);
    expect(rulesFoundInMessage("Claude-Session: 0b1c2d3e")).toEqual(["Session trailer"]);
  });

  describe("as the hook runs it", () => {
    const directory = mkdtempSync(join(tmpdir(), "commit-msg-"));
    afterAll(() => rmSync(directory, { recursive: true, force: true }));

    /** Runs `.githooks/commit-msg` on a message, as git would: from the root, with the file. */
    function hookOn(message: string): { status: number; stderr: string } {
      const file = join(directory, "COMMIT_EDITMSG");
      writeFileSync(file, message);
      try {
        execFileSync(join(ROOT, ".githooks", "commit-msg"), [file], {
          cwd: ROOT,
          encoding: "utf8",
          stdio: "pipe",
        });
        return { status: 0, stderr: "" };
      } catch (error) {
        const { status, stderr } = error as { status: number; stderr: string };
        return { status, stderr };
      }
    }

    it("lets a clean message through", () => {
      expect(hookOn(`${CLEAN}\n# On branch develop\n`)).toEqual({ status: 0, stderr: "" });
    });

    it("keeps a bad message back and says why", () => {
      const { status, stderr } = hookOn("fix: fold the row\n\nThe owner said yes.\n");

      expect(status).toBe(1);
      expect(stderr).toContain('line 3, Record of approval: "owner said"');
    });
  });
});

describe("the pull request check", () => {
  const BODY = [
    "## What changes",
    "",
    "<!-- One to three sentences. -->",
    "The fork's line sits under the headline on a phone.",
    "",
    "## Why",
    "",
    "A phone shows the fork below the screen.",
    "",
    "## Look at",
    "",
    "### Phone",
    "",
    "The preview's Kanazawa day, at 390 px in both themes.",
    "",
    "## Checked",
    "",
    "- pnpm check",
    "- pnpm e2e",
    "",
    "## Risk",
    "",
    "None.",
  ].join("\n");
  const CLEAN: PullRequestText = {
    branch: "fix/fork-line",
    title: "fix: keep the fork's line under the headline",
    body: BODY,
  };

  /** Each fault as `part: rule "found"`, so a test reads what a reader of the output would. */
  function faultsIn(text: Partial<PullRequestText>): string[] {
    return findPullRequestFaults({ ...CLEAN, ...text }).map(
      ({ part, rule, found }) => `${part}: ${rule} "${found}"`,
    );
  }

  function withSection(heading: string, content: string): string {
    return BODY.replace(/(## Risk\n\n)None\./, `$1None.\n\n${heading}\n\n${content}`);
  }

  it("passes a clean pull request and prints nothing", () => {
    const printed: string[] = [];

    expect(runPullRequestTextCheck(CLEAN, (line) => printed.push(line))).toBe(0);
    expect(printed).toEqual([]);
  });

  it("passes a body written in GitHub's form, with Windows line ends", () => {
    expect(faultsIn({ body: BODY.replaceAll("\n", "\r\n") })).toEqual([]);
  });

  it("fails Cyrillic in the title", () => {
    expect(faultsIn({ title: "fix: \u0441\u0442\u0440\u043e\u043a\u0430" })).toEqual([
      'title: Cyrillic letters "\u0441\u0442\u0440\u043e\u043a\u0430"',
    ]);
  });

  it("fails a local path in the body, naming its line", () => {
    const body = BODY.replace("None.", "None; the log is in /Users/someone/lantern.");
    const printed: string[] = [];

    expect(runPullRequestTextCheck({ ...CLEAN, body }, (line) => printed.push(line))).toBe(1);
    expect(printed.join("\n")).toContain('body line 23, Local path: "/Users/someone/"');
  });

  it("reads the template's comments, which stay in the body's source", () => {
    expect(
      faultsIn({ body: BODY.replace("One to three sentences.", "As the owner asked.") }),
    ).toEqual(['body: Record of approval "owner asked"']);
  });

  it("passes a commit hash in the body, as in a message", () => {
    expect(faultsIn({ body: BODY.replace("None.", "Revert 2276e6bf to roll back.") })).toEqual([]);
  });

  it("does not read text inside a code fence", () => {
    const fenced = ["```", "/Users/someone/lantern", "## Why", "```"].join("\n");

    expect(faultsIn({ body: BODY.replace("- pnpm e2e", `- pnpm e2e\n\n${fenced}`) })).toEqual([]);
  });

  it("fails a fence left open, which would hide the sections below it", () => {
    const body = BODY.replace("- pnpm e2e", "- pnpm e2e\n\n```\n/Users/someone/lantern\n~~~");

    expect(faultsIn({ body })).toEqual([
      'body: Unclosed code fence "```"',
      'body: Section missing "## Risk"',
    ]);
  });

  it.each([
    "feature/fork-line",
    "fix/Fork-line",
    "fix/fork_line",
    "fix/-fork",
    "fix/",
    "fork-line",
    "fix/fork/line",
  ])("fails the branch name %s", (branch) => {
    expect(faultsIn({ branch })).toEqual([`branch: Branch name "${branch}"`]);
  });

  it("holds the branch name to the message rules too", () => {
    expect(faultsIn({ branch: "chore/worktree-agent-a1b2" })).toEqual([
      'branch: Agent machinery "worktree-agent-a1b2"',
    ]);
  });

  it.each(["What changes", "Why", "Look at", "Checked", "Risk"])(
    "names the section %s when it is missing",
    (title) => {
      const body = BODY.replace(`## ${title}\n`, "");

      expect(faultsIn({ body })).toContain(`body: Section missing "## ${title}"`);
    },
  );

  it("names an empty section, and one holding only the template's comment", () => {
    const body = BODY.replace("A phone shows the fork below the screen.", "").replace(
      "None.",
      "<!--\n  What could break.\n-->",
    );

    expect(faultsIn({ body })).toEqual([
      'body: Section empty "## Why"',
      'body: Section empty "## Risk"',
    ]);
  });

  it("counts a section's content up to the next heading, and its own subheadings in it", () => {
    expect(faultsIn({ body: withSection("# Notes", "More.").replace("None.", "") })).toEqual([
      'body: Section empty "## Risk"',
    ]);
    expect(faultsIn({ body: BODY.replace("None.", "### Rollback") })).toEqual([]);
  });

  it("takes no heading inside an HTML comment for a section", () => {
    const hidden = BODY.replace("## Why", "<!--\n## Why").replace(
      "A phone shows the fork below the screen.",
      "A phone shows the fork below the screen. -->",
    );
    const onHeadingLine = BODY.replace("## Risk", "## Risk <!-- hint").replace("None.", "-->");

    expect(faultsIn({ body: hidden })).toEqual(['body: Section missing "## Why"']);
    expect(faultsIn({ body: onHeadingLine })).toEqual(['body: Section empty "## Risk"']);
  });

  it("takes only a second-level heading for a section", () => {
    expect(faultsIn({ body: BODY.replace("## Why", "# Why") })).toContain(
      'body: Section missing "## Why"',
    );
  });

  it("names a section out of order", () => {
    const body = BODY.replace("## Why", "## Checked\n\nFirst.\n\n## Why").replace(
      /## Checked\n\n- pnpm check\n- pnpm e2e\n\n/,
      "",
    );

    expect(faultsIn({ body })).toEqual(['body: Section out of order "## Checked"']);
  });

  it("finds every section missing in an empty body", () => {
    expect(faultsIn({ body: "" })).toHaveLength(5);
  });

  it("finds every section of the template empty until it is written", () => {
    const template = readFileSync(join(ROOT, ".github", "pull_request_template.md"), "utf8");

    expect(faultsIn({ body: template })).toEqual(
      ["What changes", "Why", "Look at", "Checked", "Risk"].map(
        (title) => `body: Section empty "## ${title}"`,
      ),
    );
  });

  describe("as the workflow runs it", () => {
    const directory = mkdtempSync(join(tmpdir(), "pr-text-"));
    afterAll(() => rmSync(directory, { recursive: true, force: true }));

    /** Runs `scripts/check-pr-text.mts` on plain Node, as `.github/workflows/pr-text.yml` does. */
    function scriptOn(args: readonly string[]): { status: number; stderr: string } {
      try {
        execFileSync(
          process.execPath,
          ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/check-pr-text.mts", ...args],
          { cwd: ROOT, encoding: "utf8", stdio: "pipe" },
        );
        return { status: 0, stderr: "" };
      } catch (error) {
        const { status, stderr } = error as { status: number; stderr: string };
        return { status, stderr };
      }
    }

    function bodyFile(body: string): string {
      const file = join(directory, "body.md");
      writeFileSync(file, body);
      return file;
    }

    it("lets a clean pull request through, a title starting with a dash among them", () => {
      expect(
        scriptOn([
          `--branch=${CLEAN.branch}`,
          "--title=-fix: keep the line",
          `--body-file=${bodyFile(BODY)}`,
        ]),
      ).toEqual({ status: 0, stderr: "" });
    });

    it("fails a bad pull request and says why", () => {
      const { status, stderr } = scriptOn([
        "--branch=feature/x",
        `--title=${CLEAN.title}`,
        `--body-file=${bodyFile("")}`,
      ]);

      expect(status).toBe(1);
      expect(stderr).toContain('branch, Branch name: "feature/x"');
      expect(stderr).toContain('body, Section missing: "## What changes"');
    });

    it("prints its usage when a part is missing", () => {
      const { status, stderr } = scriptOn([`--branch=${CLEAN.branch}`]);

      expect(status).toBe(1);
      expect(stderr).toContain("Usage: node scripts/check-pr-text.mts");
    });
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
