import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  StudioLock,
  isStudioLogin,
  isStudioPath,
  studioLoginOf,
  studioLoginProblemOf,
  studioVerdictOf,
  type StudioLogin,
} from "./studio-gate";

const PASSWORD = "the owner's own, in the test";
const LOGIN: StudioLogin = {
  passwordSha256: createHash("sha256").update(PASSWORD).digest("hex"),
};
const SET = { STUDIO_PASSWORD: PASSWORD };
const PRODUCTION = false;
const DEVELOPMENT = true;

function basic(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

describe("the studio's paths", () => {
  it("holds the studio, the lab, and every file beside one of their pages", () => {
    for (const path of [
      "/studio",
      "/studio/",
      "/lab",
      "/lab/",
      "/lab/matrix/stop-row",
      "/lab.rsc",
      "/studio.rsc",
      "/lab/stream.rsc",
      "/lab/matrix.segments/_tree.segment.rsc",
      "/lab;x",
    ]) {
      expect(isStudioPath(path), path).toBe(true);
    }
  });

  it("holds no path of the public site", () => {
    for (const path of [
      "/",
      "/labs",
      "/laboratory",
      "/studios",
      "/day/lab",
      "/privacy",
      "/api/day",
    ]) {
      expect(isStudioPath(path), path).toBe(false);
    }
  });
});

describe("the studio's login", () => {
  it("is read from the environment: the password alone, held as its SHA-256", () => {
    expect(studioLoginOf(SET)).toEqual(LOGIN);
    // A user name or a hash left in Vercel from before is not read.
    expect(
      studioLoginOf({ ...SET, STUDIO_USER: "owner", STUDIO_PASSWORD_SHA256: "0".repeat(64) }),
    ).toEqual(LOGIN);
  });

  it("takes the password as it is, a space in it included", () => {
    const login = studioLoginOf({ STUDIO_PASSWORD: ` ${PASSWORD}\n` });
    expect(login).not.toBeNull();
    if (login === null) return;
    expect(isStudioLogin(basic("owner", ` ${PASSWORD}\n`), login)).toBe(true);
    expect(isStudioLogin(basic("owner", PASSWORD), login)).toBe(false);
  });

  it("is none without the password, or with an empty one", () => {
    expect(studioLoginOf({})).toBeNull();
    expect(studioLoginOf({ STUDIO_PASSWORD: "" })).toBeNull();
    expect(
      studioLoginOf({ STUDIO_USER: "owner", STUDIO_PASSWORD_SHA256: "0".repeat(64) }),
    ).toBeNull();
  });

  it("opens to the password it was set with, under any user name", () => {
    for (const user of ["owner", "Owner", "someone else", ""]) {
      expect(isStudioLogin(basic(user, PASSWORD), LOGIN), user).toBe(true);
    }
    // A password may hold a colon: only the first one parts it from the user.
    const withColon = { passwordSha256: createHash("sha256").update("a:b").digest("hex") };
    expect(isStudioLogin(basic("owner", "a:b"), withColon)).toBe(true);
    expect(isStudioLogin(basic("", "a:b"), withColon)).toBe(true);
  });

  it("opens to nothing else", () => {
    for (const header of [
      null,
      "",
      basic("owner", `${PASSWORD} `),
      basic("owner", ""),
      basic("", ""),
      // The password typed as the user.
      basic(PASSWORD, ""),
      `Bearer ${PASSWORD}`,
      `Basic ${Buffer.from(`owner${PASSWORD}`).toString("base64")}`,
      "Basic not base64",
      // The hash itself is not the password.
      basic("owner", LOGIN.passwordSha256),
    ]) {
      expect(isStudioLogin(header, LOGIN), String(header)).toBe(false);
    }
  });
});

describe("the studio's verdict", () => {
  it("lets in the login, and asks anyone else", () => {
    const given = { login: LOGIN, isDevelopment: PRODUCTION };
    expect(studioVerdictOf(basic("owner", PASSWORD), given)).toBe("open");
    expect(studioVerdictOf(null, given)).toBe("ask");
    expect(studioVerdictOf(basic("owner", "guess"), given)).toBe("ask");
  });

  it("is shut to everyone in a build with no login set, whatever the request gives", () => {
    const unset = { login: null, isDevelopment: PRODUCTION };
    for (const header of [null, "", basic("owner", PASSWORD), basic("", PASSWORD), basic("", "")]) {
      expect(studioVerdictOf(header, unset), String(header)).toBe("ask");
    }
  });

  it("is open on a laptop's dev server with no login set, and asks there once one is", () => {
    expect(studioVerdictOf(null, { login: null, isDevelopment: DEVELOPMENT })).toBe("open");
    expect(studioVerdictOf(null, { login: LOGIN, isDevelopment: DEVELOPMENT })).toBe("ask");
    expect(
      studioVerdictOf(basic("owner", PASSWORD), { login: LOGIN, isDevelopment: DEVELOPMENT }),
    ).toBe("open");
  });

  it("holds no login of its own in the code, so the repository gives no password away", () => {
    const source = readFileSync(join(__dirname, "studio-gate.ts"), "utf8");
    expect(source).not.toMatch(/[0-9a-f]{64}/i);
  });
});

describe("the studio's lock in a process", () => {
  function lockWithLog(): { lock: StudioLock; lines: [string, Record<string, string>][] } {
    const lines: [string, Record<string, string>][] = [];
    return { lock: new StudioLock((event, fields) => lines.push([event, fields])), lines };
  }

  function verdictOf(
    lock: StudioLock,
    env: Record<string, string>,
    header: string | null,
    isDevelopment = PRODUCTION,
  ): string {
    return studioVerdictOf(header, lock.settingsOf(env, isDevelopment));
  }

  it("opens in production to the variable's password, and writes no line", () => {
    const { lock, lines } = lockWithLog();
    expect(verdictOf(lock, SET, basic("owner", PASSWORD))).toBe("open");
    expect(verdictOf(lock, { ...SET, STUDIO_USER: "owner" }, basic("", PASSWORD))).toBe("open");
    expect(verdictOf(lock, SET, null)).toBe("ask");
    expect(lines).toEqual([]);
  });

  it("is shut in production without the variable, or with it empty, and says so in one line", () => {
    const unset: Record<string, string>[] = [
      {},
      { STUDIO_PASSWORD: "" },
      // A hash of the password, under the name a draft of this lock read, is not read.
      { STUDIO_PASSWORD_SHA256: LOGIN.passwordSha256 },
    ];
    for (const env of unset) {
      const { lock, lines } = lockWithLog();
      expect(verdictOf(lock, env, basic("owner", PASSWORD)), JSON.stringify(env)).toBe("ask");
      expect(lines).toEqual([["studio-closed", { reason: "STUDIO_PASSWORD is not set" }]]);
    }
  });

  it("writes nothing of the environment's values, nor of the password a request gives", () => {
    const { lock, lines } = lockWithLog();
    verdictOf(lock, { STUDIO_USER: "someone-secret", STUDIO_PASSWORD: "" }, basic("x", PASSWORD));
    const written = JSON.stringify(lines);
    expect(written).not.toContain("someone-secret");
    expect(written).not.toContain(PASSWORD);
    expect(written).not.toContain(LOGIN.passwordSha256);
  });

  it("writes its line once, however many requests it shuts out", () => {
    const { lock, lines } = lockWithLog();
    for (let request = 0; request < 5; request += 1) verdictOf(lock, {}, null);
    expect(lines).toHaveLength(1);
  });

  it("is open on a laptop's dev server without the variable, and writes no line", () => {
    const { lock, lines } = lockWithLog();
    expect(verdictOf(lock, {}, null, DEVELOPMENT)).toBe("open");
    expect(lines).toEqual([]);
  });
});

describe("why the environment gives no login", () => {
  it("is nothing when it gives one", () => {
    expect(studioLoginProblemOf(SET)).toBeNull();
    expect(studioLoginProblemOf({ STUDIO_PASSWORD: " " })).toBeNull();
  });
});
