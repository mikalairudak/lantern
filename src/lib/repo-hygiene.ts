/**
 * The rules for what may be committed that a pattern can see (`CLAUDE.md`, "Everything
 * committed is public", and `docs/decisions.md`, "Everything committed is written for a reader
 * of the code"). `repo-hygiene.test.ts` holds every tracked text file to them,
 * `.githooks/commit-msg` holds each commit's message, through `scripts/check-commit-message.mts`,
 * and `.github/workflows/pr-text.yml` holds each pull request's branch name, title and body,
 * through `scripts/check-pr-text.mts`. The module imports nothing, so those scripts run it on
 * plain Node.
 */

export interface HygieneRule {
  /** What a failure calls it. */
  readonly name: string;
  /** What it finds, read one line at a time; global, so a line can hold several. */
  readonly pattern: RegExp;
  /** Why it stays out of the repository. */
  readonly reason: string;
  /** Whether a commit's message and a pull request's text are held to it as well as the files. */
  readonly inMessages: boolean;
  /** Whether it reads Markdown alone, and only outside fenced code. */
  readonly markdownProseOnly?: boolean;
  /** A match that passes wherever it stands. */
  readonly allowedMatch?: RegExp;
  /** A match that passes in a test file, whose data is made up. */
  readonly allowedMatchInTests?: RegExp;
  /** The tracked files where it is meant, each with the reason. */
  readonly allowedFiles?: Readonly<Record<string, string>>;
}

export interface HygieneFault {
  /** The line it stands on, counted from 1. */
  readonly line: number;
  /** The rule it breaks. */
  readonly rule: string;
  /** What the rule found. */
  readonly found: string;
  /** Why the rule holds. */
  readonly reason: string;
}

/** Tests, end-to-end specs and fixtures: what they hold is made up to exercise the code. */
const TEST_FILE = /\.(?:test|spec)\.tsx?$|^e2e\/|^src\/lib\/fixtures\//;
const MARKDOWN_FILE = /\.md$/;
/** A line that opens a fenced code block: three or more backticks or tildes, and its marker. */
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
/** A line that can close one: a marker alone, as long as the opening one or longer. */
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})\s*$/;
/** Git's comment lines in a message it hands the hook. */
const COMMENT_MARK = "#";
/** Git's scissors line: everything below it, such as `git commit -v`'s diff, is not the message. */
const SCISSORS = "# ------------------------ >8 ------------------------";

/**
 * Lantern's own addresses, GitHub's no-reply ones, the co-author trailer's, and the names
 * reserved for tests and examples (RFC 2606 and RFC 6761).
 */
const ALLOWED_ADDRESS =
  /@lanternday\.com$|@users\.noreply\.github\.com$|^noreply@anthropic\.com$|\.(?:test|example|invalid|localhost)$|@example\.(?:com|net|org)$/i;

export const HYGIENE_RULES: readonly HygieneRule[] = [
  {
    name: "Cyrillic letters",
    pattern: /\p{Script=Cyrillic}+/gu,
    reason: "Everything committed is in English; test data in Cyrillic is listed here, with why.",
    inMessages: true,
    allowedFiles: {
      "src/app/lab/type/candidates/page.tsx":
        "A type candidate's probe: the Cyrillic letters a fallback face gives away first.",
      "src/lib/fixtures/intake/golden.ts":
        "Intake cases written in Russian, which the intake reads like any other language.",
      "src/lib/quality/checks.test.ts": "A Russian place name, which the script check passes.",
    },
  },
  {
    name: "Link to a chat or session",
    pattern: /\bclaude\.ai\/\S*/gi,
    reason: "A chat or session page is private, so a reader of the code cannot open it.",
    inMessages: true,
  },
  {
    name: "Session trailer",
    pattern: /^\s*Claude-Session:.*/gi,
    reason: "A commit records what changed, not the session that wrote it.",
    inMessages: true,
  },
  {
    name: "Local path",
    pattern:
      /(?<![\w.-])\/(?:Users|home)\/[^/\s]+\/|\b[A-Za-z]:\\Users\\|\/private\/tmp\/|\/tmp\/(?:claude|cc-socks)/g,
    reason: "A path on one machine names its account and leads nowhere on another.",
    inMessages: true,
  },
  {
    name: "Agent machinery",
    pattern: /\bworktree-agent-[\w-]*|\.claude\/worktrees\/agent-[\w-]*|\buds:\S*/g,
    reason: "An auto-made branch or a socket address is how the work ran, not what the code is.",
    inMessages: true,
  },
  {
    name: "Record of approval",
    pattern:
      /\b(?:said|says) yes\b|\bowner['’]s yes\b|\bsigned off\b|\bowner (?:said|asked)\b|\basked by the owner\b|\bat the owner['’]s request\b|\((?:the )?owner, \d{4}-/gi,
    reason: "State a call with its reason: how it was agreed, and who asked, is not what is true.",
    inMessages: true,
  },
  {
    name: "Email address",
    // A connection string's `scheme://user:password@` is taken whole, so a test's fake one
    // can pass as a connection string and a real one anywhere else is still found.
    pattern:
      /(?:\b[a-z][a-z\d+.-]*:\/\/[^\s/@:]*:)?(?<![\w.%+-])[\w.%+-]+@[a-z\d-]+(?:\.[a-z\d-]+)*\.[a-z]{2,}\b/gi,
    reason:
      "An address names a person or an account; Lantern's own, GitHub's no-reply ones and reserved test domains are written.",
    inMessages: true,
    allowedMatch: ALLOWED_ADDRESS,
    allowedMatchInTests: /^[a-z][a-z\d+.-]*:\/\//i,
  },
  {
    name: "API key",
    pattern: /\bsk-ant-[\w-]{8,}|\bghp_[A-Za-z\d]{36}\b|\bgithub_pat_\w{22,}|\bAKIA[A-Z\d]{16}\b/g,
    reason: "A key in a public repository is a leaked key; keys live in .env.local and Vercel.",
    inMessages: true,
  },
  {
    name: "Commit hash",
    // Seven to forty hex digits holding both a figure and a letter, with no `#`, `-` or word
    // character beside them: a hex colour, a UUID's part and a SHA-256 sum are not one.
    pattern: /(?<![\w#-])(?=[\da-f]*\d)(?=[\da-f]*[a-f])[\da-f]{7,40}(?![\w-])/g,
    reason: "History can be rewritten, so a hash leads nowhere; name a date or a state.",
    inMessages: false,
    markdownProseOnly: true,
  },
];

interface Line {
  readonly number: number;
  readonly text: string;
}

function linesOf(text: string): Line[] {
  return text.split("\n").map((line, index) => ({ number: index + 1, text: line.trimEnd() }));
}

interface Fences {
  /** Whether each line is fenced code, its opening and closing lines included. */
  readonly isCode: readonly boolean[];
  /** The line of a fence the text leaves open, which hides every line below it. */
  readonly unclosed: Line | null;
}

/**
 * Where fenced code stands, as CommonMark reads it: a fence closes only on a marker of the same
 * character, at least as long as the one that opened it.
 */
function fencesOf(lines: readonly Line[]): Fences {
  let opening: Line | null = null;
  let openMarker = "";
  const isCode: boolean[] = [];
  for (const line of lines) {
    if (opening === null) {
      const marker = FENCE_OPEN.exec(line.text)?.[1];
      if (marker !== undefined) {
        opening = line;
        openMarker = marker;
      }
      isCode.push(marker !== undefined);
      continue;
    }
    const marker = FENCE_CLOSE.exec(line.text)?.[1] ?? "";
    // A marker is one character throughout, so one that starts with the opening marker is of
    // the same character and at least as long.
    if (marker.startsWith(openMarker)) opening = null;
    isCode.push(true);
  }
  return { isCode, unclosed: opening };
}

/** The lines outside fenced code blocks. */
function proseLinesOf(lines: readonly Line[]): Line[] {
  const { isCode } = fencesOf(lines);
  return lines.filter((_, index) => !isCode[index]);
}

function faultsOf(rule: HygieneRule, lines: readonly Line[], isTestFile: boolean): HygieneFault[] {
  return lines.flatMap(({ number, text }) =>
    [...text.matchAll(rule.pattern)]
      .map(([found]) => found)
      .filter(
        (found) =>
          !rule.allowedMatch?.test(found) && !(isTestFile && rule.allowedMatchInTests?.test(found)),
      )
      .map((found) => ({ line: number, rule: rule.name, found, reason: rule.reason })),
  );
}

/** In order down the text; a sort keeps the rules' order on one line. */
function byLine(a: HygieneFault, b: HygieneFault): number {
  return a.line - b.line;
}

/** What breaks the rules in a tracked file's text, by its path from the repository's root. */
export function findFileFaults(path: string, text: string): HygieneFault[] {
  const lines = linesOf(text);
  const isMarkdown = MARKDOWN_FILE.test(path);
  const isTestFile = TEST_FILE.test(path);
  const prose = isMarkdown ? proseLinesOf(lines) : [];
  return HYGIENE_RULES.filter((rule) => !Object.hasOwn(rule.allowedFiles ?? {}, path))
    .flatMap((rule) => faultsOf(rule, rule.markdownProseOnly === true ? prose : lines, isTestFile))
    .sort(byLine);
}

/**
 * A message's own lines in the file git hands the `commit-msg` hook: without its `#` comment
 * lines, and ending above the scissors line. Each keeps its number in the file.
 */
function messageLinesOf(message: string): Line[] {
  const lines = linesOf(message);
  const scissors = lines.findIndex(({ text }) => text === SCISSORS);
  const above = scissors === -1 ? lines : lines.slice(0, scissors);
  return above.filter(({ text }) => !text.startsWith(COMMENT_MARK));
}

/** What breaks the rules in a commit's message, as git hands it to the `commit-msg` hook. */
export function findMessageFaults(message: string): HygieneFault[] {
  return messageFaultsOf(messageLinesOf(message));
}

/** What breaks the rules held to messages, among the lines given. */
function messageFaultsOf(lines: readonly Line[]): HygieneFault[] {
  return HYGIENE_RULES.filter((rule) => rule.inMessages)
    .flatMap((rule) => faultsOf(rule, lines, false))
    .sort(byLine);
}

function whatAndWhy(fault: Pick<HygieneFault, "rule" | "found" | "reason">): string {
  return `${fault.rule}: "${fault.found}". ${fault.reason}`;
}

/** A file's fault as a failure prints it: the path and line, the rule, what it found, and why. */
export function describeFileFault(path: string, fault: HygieneFault): string {
  return `${path}:${fault.line} ${whatAndWhy(fault)}`;
}

/**
 * The `commit-msg` hook's check of a message, as git hands it over: prints each fault to `err`
 * and answers the exit code, 1 when the message breaks a rule.
 */
export function runCommitMessageCheck(message: string, err: (line: string) => void): number {
  const faults = findMessageFaults(message);
  if (faults.length === 0) return 0;
  err(
    'commit-msg: the message breaks the rules for what is committed (CLAUDE.md, "Everything committed is public"):',
  );
  for (const fault of faults) err(`  line ${fault.line}, ${whatAndWhy(fault)}`);
  err("Lines starting with # and everything below the scissors line are not read.");
  return 1;
}

/** The kinds of change a commit's subject and a branch's name start with. */
const CHANGE_KINDS = ["feat", "fix", "chore", "docs", "test", "refactor"] as const;
const BRANCH_NAME = new RegExp(`^(?:${CHANGE_KINDS.join("|")})/[a-z0-9][a-z0-9-]*$`);
/** The body's sections, in order, as `.github/pull_request_template.md` lays them out. */
export const PULL_REQUEST_SECTIONS = ["What changes", "Why", "Look at", "Checked", "Risk"] as const;
/** A first- or second-level heading, which ends the section above it. */
const SECTION_HEADING = /^ {0,3}(#{1,2})(?!#)(?:\s+(.*?))?\s*#*\s*$/;
/** An HTML comment, which GitHub does not show; one left open hides the rest of the text. */
const HTML_COMMENT = /<!--[\s\S]*?(?:-->|$)/g;
const TEMPLATE = ".github/pull_request_template.md";

/** A pull request's public text: GitHub shows each part the moment the branch is pushed. */
export interface PullRequestText {
  readonly branch: string;
  readonly title: string;
  readonly body: string;
}

export interface PullRequestFault {
  /** The part it stands in. */
  readonly part: keyof PullRequestText;
  /** The body's line it stands on, counted from 1; null for a whole part or a missing section. */
  readonly line: number | null;
  /** The rule it breaks. */
  readonly rule: string;
  /** What the rule found. */
  readonly found: string;
  /** Why the rule holds. */
  readonly reason: string;
}

function inPart(part: keyof PullRequestText, line: number | null) {
  return (fault: HygieneFault): PullRequestFault => ({
    part,
    line,
    rule: fault.rule,
    found: fault.found,
    reason: fault.reason,
  });
}

function branchFaultsOf(branch: string): PullRequestFault[] {
  const shape: PullRequestFault[] = BRANCH_NAME.test(branch)
    ? []
    : [
        {
          part: "branch",
          line: null,
          rule: "Branch name",
          found: branch,
          reason: `A branch's name is public once pushed, so it names its kind of change as a commit does (${CHANGE_KINDS.join(", ")}), then a slash and lowercase words joined by hyphens.`,
        },
      ];
  return [...shape, ...messageFaultsOf(linesOf(branch)).map(inPart("branch", null))];
}

interface Heading {
  /** Its index among the body's lines. */
  readonly index: number;
  /** 1 or 2: a section is a second-level heading. */
  readonly level: number;
  readonly title: string;
}

/** The body's first- and second-level headings outside fenced code. */
function headingsOf(lines: readonly Line[]): Heading[] {
  const { isCode } = fencesOf(lines);
  return lines.flatMap(({ text }, index) => {
    const match = isCode[index] === true ? null : SECTION_HEADING.exec(text);
    return match === null ? [] : [{ index, level: match[1]?.length ?? 0, title: match[2] ?? "" }];
  });
}

/**
 * The body's lines as GitHub shows them: each HTML comment outside fenced code blanked, a
 * multi-line one too, so a heading inside one is no section. Each line keeps its number.
 */
function shownLinesOf(lines: readonly Line[]): Line[] {
  const { isCode } = fencesOf(lines);
  const shown: Line[] = [];
  let prose: Line[] = [];
  const flush = () => {
    const text = prose
      .map((line) => line.text)
      .join("\n")
      .replace(HTML_COMMENT, (comment) => comment.replace(/[^\n]/g, ""));
    text.split("\n").forEach((line, index) => {
      const at = prose[index];
      if (at !== undefined) shown.push({ number: at.number, text: line.trimEnd() });
    });
    prose = [];
  };
  lines.forEach((line, index) => {
    if (isCode[index] === true) {
      flush();
      shown.push(line);
    } else {
      prose.push(line);
    }
  });
  flush();
  return shown;
}

function sectionFault(heading: string, rule: string, reason: string): PullRequestFault {
  return { part: "body", line: null, rule, found: `## ${heading}`, reason };
}

/** The five sections, each present, in order, and saying something beyond the template's hint. */
function shapeFaultsOf(lines: readonly Line[]): PullRequestFault[] {
  const headings = headingsOf(lines);
  let lastIndex = -1;
  return PULL_REQUEST_SECTIONS.flatMap((title) => {
    const at = headings.findIndex((heading) => heading.level === 2 && heading.title === title);
    const heading = headings[at];
    if (heading === undefined) {
      return [
        sectionFault(
          title,
          "Section missing",
          `The body holds ${PULL_REQUEST_SECTIONS.length} sections, in the order ${TEMPLATE} gives them.`,
        ),
      ];
    }
    const { index } = heading;
    const end = headings[at + 1]?.index ?? lines.length;
    const said = lines
      .slice(index + 1, end)
      .map(({ text }) => text)
      .join("\n")
      .trim();
    const faults: PullRequestFault[] = [];
    if (index < lastIndex) {
      faults.push(
        sectionFault(
          title,
          "Section out of order",
          `A reader finds each section where ${TEMPLATE} puts it.`,
        ),
      );
    }
    if (said === "") {
      faults.push(
        sectionFault(
          title,
          "Section empty",
          "Each section says at least one line; the template's comment alone is a hint, not an answer.",
        ),
      );
    }
    lastIndex = Math.max(lastIndex, index);
    return faults;
  });
}

/**
 * What breaks the rules in a pull request's branch name, title and body. The body is Markdown,
 * so the rules read its prose outside fenced code, comments included, since they stay in its
 * source; it also holds the template's five sections.
 */
export function findPullRequestFaults(text: PullRequestText): PullRequestFault[] {
  const bodyLines = linesOf(text.body);
  const { unclosed } = fencesOf(bodyLines);
  const fenceFaults: PullRequestFault[] =
    unclosed === null
      ? []
      : [
          {
            part: "body",
            line: unclosed.number,
            rule: "Unclosed code fence",
            found: unclosed.text.trim(),
            reason:
              "A fence left open hides every line below it from the rules and the sections; close it with the same marker.",
          },
        ];
  const bodyFaults = messageFaultsOf(proseLinesOf(bodyLines)).map((fault) =>
    inPart("body", fault.line)(fault),
  );
  return [
    ...branchFaultsOf(text.branch),
    ...messageFaultsOf(linesOf(text.title)).map(inPart("title", null)),
    ...fenceFaults,
    ...bodyFaults,
    ...shapeFaultsOf(shownLinesOf(bodyLines)),
  ];
}

function placeOf(fault: PullRequestFault): string {
  return fault.line === null ? fault.part : `${fault.part} line ${fault.line}`;
}

/**
 * The pull request check, as `.github/workflows/pr-text.yml` runs it: prints each fault to `err`
 * and answers the exit code, 1 when the branch name, title or body breaks a rule.
 */
export function runPullRequestTextCheck(
  text: PullRequestText,
  err: (line: string) => void,
): number {
  const faults = findPullRequestFaults(text);
  if (faults.length === 0) return 0;
  err(
    'pr-text: the pull request breaks the rules for what is committed (CLAUDE.md, "Everything committed is public"):',
  );
  for (const fault of faults) err(`  ${placeOf(fault)}, ${whatAndWhy(fault)}`);
  err("Text inside fenced code is not read.");
  return 1;
}
