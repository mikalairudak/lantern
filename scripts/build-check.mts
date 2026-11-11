/**
 * `pnpm build:check`: the production build Vercel runs, in a directory of its own, so a running
 * `pnpm dev` keeps its `.next`, and then the built app served by `next start` and asked for the
 * pages a visitor opens. The build prerenders every page it knows, which is where Cache
 * Components refuses a page that reads the clock or a request outside a boundary; neither
 * `pnpm check` nor the e2e's dev server renders a page so. A day's address the build never saw,
 * a kept day's id, is rendered on its first visit as a static page for that address, the same
 * refusal at request time, which the build cannot see and only a served app shows: production
 * answered such an address with a 500 on 2026-11-01 (`docs/harness.md`, "The build before a
 * merge"). `next build` adds its directory's route types to tsconfig.json's `include` and writes
 * the file back in its own format, which the commit gate's format check refuses, so the file is
 * put back as it was, whatever the outcome. Like `next build`, it reads `.env.local` if there is
 * one; CI has none and builds and serves with no keys.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const BUILD_DIR = ".next-build";
const TSCONFIG = fileURLToPath(new URL("../tsconfig.json", import.meta.url));
const tsconfigBefore = readFileSync(TSCONFIG, "utf8");
const env = { ...process.env, NEXT_DIST_DIR: BUILD_DIR };

/** How long the served app has to answer its first request. */
const READY_TIMEOUT_MS = 30_000;
const READY_POLL_MS = 250;
/**
 * How long the app is left after the last answer to finish what a visit started in the
 * background, such as an unlisted address's static page, whose failure reaches only the log.
 */
const SETTLE_MS = 3_000;
const HTTP_SERVER_ERROR = 500;
/** What `next start` prints of a render that failed, in a request or in the background. */
const SERVER_ERROR = /Error:|⨯|NEXT_STATIC_GEN_BAILOUT|Error revalidating/;

/**
 * The pages asked of the served app: the start screen, a written day's address, prerendered by
 * the build, a day written by hand's old address, now a city with no day, which search engines
 * still hold, and a city written with an accent, the written days and the kept day's id the
 * rule against those must leave alone, the page every page leads to, the two files crawlers
 * ask for first, and the card and the icon a link and a tab show.
 */
function pagesToAsk(): string[] {
  return [
    "/",
    ...NOT_FOUND_PATHS,
    ...DAY_PATHS,
    "/privacy",
    "/robots.txt",
    "/sitemap.xml",
    ...Object.keys(FILE_TYPES),
  ];
}

/**
 * The files a crawler or a browser asks for by name, each with the type it must answer in:
 * served as a page, or not at all, an image is a 404 in a crawler's eyes, not an error here.
 */
const FILE_TYPES: Readonly<Record<string, string>> = {
  "/opengraph-image": "image/png",
  "/favicon.ico": "image/x-icon",
};

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

/**
 * Addresses that name no day, each answered with the not-found page and a 404 from its first
 * visit: the route's prerendered shell would answer it 200 before the page's `notFound()` ran
 * (`notADaySource` in `src/lib/days/not-a-day.ts`). Asked once each, so the first visit is the one
 * checked.
 */
const NOT_FOUND_PATHS: readonly string[] = ["/day/kyoto", "/day/vienna", "/day/caf%C3%A9"];

/** What is wrong with an address that names no day's answer, or null when it is a 404. */
function notFoundProblemOf(path: string, response: Response): string | null {
  if (!NOT_FOUND_PATHS.includes(path) || response.status === HTTP_NOT_FOUND) return null;
  return `${path} answered ${response.status} on its first visit, not ${HTTP_NOT_FOUND}`;
}

/**
 * Addresses that name a day, each answered 200, so the rule that refuses the rest leaves them
 * to their page: three starts' days and two city days, prerendered by the build, and a kept
 * day's id it never saw.
 */
const DAY_PATHS: readonly string[] = [
  "/day/kanazawa",
  "/day/bologna",
  "/day/porto",
  "/day/paris",
  "/day/seoul",
  `/day/${randomUUID()}`,
];

/** What is wrong with a day's answer, or null when it is a 200. */
function dayProblemOf(path: string, response: Response): string | null {
  if (!DAY_PATHS.includes(path) || response.status === HTTP_OK) return null;
  return `${path} answered ${response.status}, not ${HTTP_OK}`;
}

/** What is wrong with a file's answer, or null when it is the file it should be. */
function fileProblemOf(path: string, response: Response): string | null {
  const type = FILE_TYPES[path];
  if (type === undefined) return null;
  const answered = response.headers.get("content-type");
  if (response.status === HTTP_OK && answered === type) return null;
  return `${path} answered ${response.status} as ${answered ?? "no type"}, not ${HTTP_OK} as ${type}`;
}

let current: ChildProcess | null = null;

function putTsconfigBack(): void {
  if (readFileSync(TSCONFIG, "utf8") === tsconfigBefore) return;
  writeFileSync(TSCONFIG, tsconfigBefore);
  process.stdout.write("tsconfig.json is back as it was before the build.\n");
}

function exitOf(child: ChildProcess): Promise<number> {
  return new Promise((resolve) => {
    child.on("error", (error) => {
      process.stderr.write(`${error.message}\n`);
      resolve(1);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A port nothing listens on now, from the system. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, () => {
      const address = probe.address();
      probe.close(() =>
        typeof address === "object" && address !== null
          ? resolve(address.port)
          : reject(new Error("No port")),
      );
    });
  });
}

async function untilServing(base: string, hasExited: () => boolean): Promise<boolean> {
  const giveUpAt = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < giveUpAt && !hasExited()) {
    try {
      await (await fetch(base)).text();
      return true;
    } catch {
      await wait(READY_POLL_MS);
    }
  }
  return false;
}

/** Serves the build, asks for each page, and returns what went wrong: answers and log lines. */
async function serveCheck(): Promise<string[]> {
  const port = await freePort();
  const base = `http://localhost:${port}`;
  const server = spawn("next", ["start", "-p", String(port)], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  current = server;
  let output = "";
  const keep = (chunk: Buffer, to: NodeJS.WriteStream): void => {
    output += chunk.toString();
    to.write(chunk);
  };
  server.stdout?.on("data", (chunk: Buffer) => keep(chunk, process.stdout));
  server.stderr?.on("data", (chunk: Buffer) => keep(chunk, process.stderr));
  let hasExited = false;
  const exited = exitOf(server).then((code) => {
    hasExited = true;
    return code;
  });
  const problems: string[] = [];
  try {
    if (!(await untilServing(base, () => hasExited))) {
      return [`next start did not answer within ${READY_TIMEOUT_MS / 1000} s`];
    }
    for (const path of pagesToAsk()) {
      const response = await fetch(`${base}${path}`, { redirect: "manual" });
      await response.text();
      process.stdout.write(`${path}: ${response.status}\n`);
      if (response.status >= HTTP_SERVER_ERROR)
        problems.push(`${path} answered ${response.status}`);
      const fileProblem = fileProblemOf(path, response);
      if (fileProblem !== null) problems.push(fileProblem);
      const notFoundProblem = notFoundProblemOf(path, response);
      if (notFoundProblem !== null) problems.push(notFoundProblem);
      const dayProblem = dayProblemOf(path, response);
      if (dayProblem !== null) problems.push(dayProblem);
    }
    await wait(SETTLE_MS);
  } finally {
    server.kill("SIGTERM");
    await exited;
    current = null;
  }
  const errors = output.split("\n").filter((line) => SERVER_ERROR.test(line));
  return [...problems, ...errors.map((line) => `the server logged: ${line.trim()}`)];
}

async function buildCheck(): Promise<number> {
  try {
    const build = spawn("next", ["build"], { stdio: "inherit", env });
    current = build;
    const built = await exitOf(build);
    current = null;
    if (built !== 0) return built;
    process.stdout.write("\nServing the build and asking for the pages a visitor opens…\n");
    const problems = await serveCheck();
    if (problems.length > 0) {
      process.stderr.write(
        `\nThe served build failed:\n${problems.map((p) => `  ${p}`).join("\n")}\n`,
      );
      return 1;
    }
    process.stdout.write("The served build answered every page with no error.\n");
    return 0;
  } finally {
    putTsconfigBack();
  }
}

// Ctrl-C reaches the build or the server from the terminal; this script waits for it to end,
// to put the file back. A stop sent to this script alone is passed on.
process.on("SIGINT", () => undefined);
process.on("SIGTERM", () => current?.kill("SIGTERM"));

process.exitCode = await buildCheck();
