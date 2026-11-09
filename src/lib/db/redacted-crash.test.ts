// @vitest-environment node
import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { crashLineOf, redactCrashesOf, type CrashingProcess } from "./redacted-crash";

const PASSWORD = "p@ss-not-real";
const OWNER_URL = `postgresql://neondb_owner:${encodeURIComponent(PASSWORD)}@ep-test-1234.us-east-1.aws.neon.tech/neondb`;
const READER_URL =
  "postgresql://lantern_reader:other-not-real@ep-test-1234.us-east-1.aws.neon.tech/neondb";

interface FakeProcess extends CrashingProcess {
  emitter: EventEmitter;
  written: string[];
  exitCodes: number[];
}

function fakeProcess(): FakeProcess {
  const emitter = new EventEmitter();
  const written: string[] = [];
  const exitCodes: number[] = [];
  return {
    emitter,
    written,
    exitCodes,
    on: (event, listener) => emitter.on(event, listener),
    exit: (code) => {
      exitCodes.push(code);
    },
    stderr: { write: (text) => written.push(text) },
  };
}

describe("a crash in a database script", () => {
  it("prints its message alone, never the client a driver's error carries", () => {
    const target = fakeProcess();
    redactCrashesOf(OWNER_URL, target);

    // As the Neon pool's unheard error event did: the client, string and all, in `context`.
    const crash = Object.assign(new Error("Unhandled error. ()"), {
      context: { client: { config: { connectionString: OWNER_URL } } },
    });
    target.emitter.emit("uncaughtException", crash);

    expect(target.written).toEqual(["Stopped: Unhandled error. ()\n"]);
    expect(target.exitCodes).toEqual([1]);
  });

  it("takes the string and its password, raw or encoded, out of the message", () => {
    const target = fakeProcess();
    redactCrashesOf(OWNER_URL, target);

    target.emitter.emit(
      "unhandledRejection",
      new Error(`no route to ${OWNER_URL}; auth ${PASSWORD} and ${encodeURIComponent(PASSWORD)}`),
    );

    expect(target.written.join("")).toBe(
      "Stopped: no route to [DATABASE_URL]; auth [DATABASE_URL] and [DATABASE_URL]\n",
    );
  });

  it("listens once, and redacts every string it was given", () => {
    const target = fakeProcess();
    redactCrashesOf(READER_URL, target);
    redactCrashesOf(OWNER_URL, target);

    expect(target.emitter.listenerCount("uncaughtException")).toBe(1);
    expect(target.emitter.listenerCount("unhandledRejection")).toBe(1);
    target.emitter.emit("uncaughtException", new Error(`${READER_URL} ${OWNER_URL}`));
    expect(target.written).toEqual(["Stopped: [DATABASE_URL] [DATABASE_URL]\n"]);
  });

  it("says so when what was thrown is not an error", () => {
    expect(crashLineOf({ connectionString: OWNER_URL }, [])).toBe(
      "Stopped: an error with no message",
    );
  });
});
