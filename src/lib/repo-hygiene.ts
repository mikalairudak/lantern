/**
 * The rules for what may be committed that a pattern can see (`CLAUDE.md`, "Everything
 * committed is public", and `docs/decisions.md`, "Everything committed is written for a reader
 * of the code"). `repo-hygiene.test.ts` holds every tracked text file to them.
 */

export interface HygieneRule {
  /** What a failure calls it. */
  readonly name: string;
  /** What it finds, read one line at a time; global, so a line can hold several. */
  readonly pattern: RegExp;
  /** Why it stays out of the repository. */
  readonly reason: string;
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
/** A line that opens or closes a fenced code block. */
const FENCE = /^ {0,3}(?:```|~~~)/;

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
  },
  {
    name: "Session trailer",
    pattern: /^\s*Claude-Session:.*/gi,
    reason: "A commit records what changed, not the session that wrote it.",
  },
  {
    name: "Local path",
    pattern:
      /(?<![\w.-])\/(?:Users|home)\/[^/\s]+\/|\b[A-Za-z]:\\Users\\|\/private\/tmp\/|\/tmp\/(?:claude|cc-socks)/g,
    reason: "A path on one machine names its account and leads nowhere on another.",
  },
  {
    name: "Agent machinery",
    pattern: /\bworktree-agent-[\w-]*|\.claude\/worktrees\/agent-[\w-]*|\buds:\S*/g,
    reason: "An auto-made branch or a socket address is how the work ran, not what the code is.",
  },
  {
    name: "Record of approval",
    pattern:
      /\b(?:said|says) yes\b|\bowner['’]s yes\b|\bsigned off\b|\bowner (?:said|asked)\b|\basked by the owner\b|\bat the owner['’]s request\b|\((?:the )?owner, \d{4}-/gi,
    reason: "State a call with its reason: how it was agreed, and who asked, is not what is true.",
  },
  {
    name: "Email address",
    // A connection string's `scheme://user:password@` is taken whole, so a test's fake one
    // can pass as a connection string and a real one anywhere else is still found.
    pattern:
      /(?:\b[a-z][a-z\d+.-]*:\/\/[^\s/@:]*:)?(?<![\w.%+-])[\w.%+-]+@[a-z\d-]+(?:\.[a-z\d-]+)*\.[a-z]{2,}\b/gi,
    reason:
      "An address names a person or an account; Lantern's own, GitHub's no-reply ones and reserved test domains are written.",
    allowedMatch: ALLOWED_ADDRESS,
    allowedMatchInTests: /^[a-z][a-z\d+.-]*:\/\//i,
  },
  {
    name: "API key",
    pattern: /\bsk-ant-[\w-]{8,}|\bghp_[A-Za-z\d]{36}\b|\bgithub_pat_\w{22,}|\bAKIA[A-Z\d]{16}\b/g,
    reason: "A key in a public repository is a leaked key; keys live in .env.local and Vercel.",
  },
  {
    name: "Commit hash",
    // Seven to forty hex digits holding both a figure and a letter, with no `#`, `-` or word
    // character beside them: a hex colour, a UUID's part and a SHA-256 sum are not one.
    pattern: /(?<![\w#-])(?=[\da-f]*\d)(?=[\da-f]*[a-f])[\da-f]{7,40}(?![\w-])/g,
    reason: "History can be rewritten, so a hash leads nowhere; name a date or a state.",
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

/** The lines outside fenced code blocks. */
function proseLinesOf(lines: readonly Line[]): Line[] {
  let isInFence = false;
  return lines.filter(({ text }) => {
    if (FENCE.test(text)) {
      isInFence = !isInFence;
      return false;
    }
    return !isInFence;
  });
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

function whatAndWhy(fault: HygieneFault): string {
  return `${fault.rule}: "${fault.found}". ${fault.reason}`;
}

/** A file's fault as a failure prints it: the path and line, the rule, what it found, and why. */
export function describeFileFault(path: string, fault: HygieneFault): string {
  return `${path}:${fault.line} ${whatAndWhy(fault)}`;
}
