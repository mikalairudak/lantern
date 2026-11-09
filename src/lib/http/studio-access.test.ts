import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ authorization: null as string | null }));
const NOT_FOUND = "NEXT_NOT_FOUND";

vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve(
      new Headers(request.authorization ? { authorization: request.authorization } : {}),
    ),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error(NOT_FOUND);
  },
}));

const { requireStudioLogin, studioMetadataOf } = await import("./studio-access");

const APP = join(__dirname, "..", "..", "app");
const PASSWORD = "a generated password, twenty characters and more";

function basic(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

/** Every page and layout of the studio and the lab. */
function studioFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return studioFiles(path);
    return name === "page.tsx" || name === "layout.tsx" ? [path] : [];
  });
}

describe("the studio's lock inside its pages", () => {
  beforeEach(() => {
    vi.stubEnv("STUDIO_PASSWORD", PASSWORD);
    vi.stubEnv("NODE_ENV", "production");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    request.authorization = null;
  });

  it("lets the page render with the password, under any user name", async () => {
    for (const user of ["owner", ""]) {
      request.authorization = basic(user, PASSWORD);
      await expect(requireStudioLogin(), user).resolves.toBeUndefined();
    }
  });

  it("finds no page without it, or with another", async () => {
    for (const authorization of [null, basic("owner", "guess"), basic(PASSWORD, "")]) {
      request.authorization = authorization;
      await expect(requireStudioLogin(), String(authorization)).rejects.toThrow(NOT_FOUND);
    }
  });

  it("finds no page in a build with no login set, whatever the request gives, and says why once", async () => {
    vi.stubEnv("STUDIO_PASSWORD", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const authorization of [null, basic("owner", PASSWORD), basic("", PASSWORD)]) {
      request.authorization = authorization;
      await expect(requireStudioLogin(), String(authorization)).rejects.toThrow(NOT_FOUND);
    }
    expect(log.mock.calls).toEqual([
      [JSON.stringify({ event: "studio-closed", reason: "STUDIO_PASSWORD is not set" })],
    ]);
  });

  it("lets the page render on a laptop's dev server with no login set", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STUDIO_PASSWORD", "");
    await expect(requireStudioLogin()).resolves.toBeUndefined();
  });

  it("gives a page its title with the login alone", async () => {
    request.authorization = basic("owner", PASSWORD);
    await expect(studioMetadataOf("Stream scrubber")).resolves.toEqual({
      title: "Stream scrubber",
    });
    request.authorization = null;
    await expect(studioMetadataOf("Stream scrubber")).resolves.toEqual({});
  });

  it("sets no page's title as a constant, which the build would write where the proxy is not", () => {
    const pages = studioFiles(join(APP, "lab"))
      .concat(studioFiles(join(APP, "studio")))
      .filter((path) => path.endsWith("page.tsx"));
    const titled = pages.filter((path) =>
      /export const metadata[^;]*title/s.test(readFileSync(path, "utf8")),
    );
    expect(titled.map((path) => relative(APP, path))).toEqual([]);
  });

  it("is called by every page and layout of the studio and the lab, first", () => {
    const files = [...studioFiles(join(APP, "lab")), ...studioFiles(join(APP, "studio"))];
    expect(files.length).toBeGreaterThan(10);
    const unlocked = files.filter((path) => {
      const text = readFileSync(path, "utf8");
      const body = /export default async function \w+\([\s\S]*?\) \{\n(.*)\n/.exec(text)?.[1];
      return body?.trim() !== "await requireStudioLogin();";
    });
    expect(unlocked.map((path) => relative(APP, path))).toEqual([]);
  });
});
