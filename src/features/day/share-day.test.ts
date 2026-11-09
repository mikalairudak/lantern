import { describe, expect, it, vi } from "vitest";
import { dayLinkOf, shareDayLink, type ShareChannel } from "./share-day";

const LINK = {
  url: "https://www.lanternday.com/day/kyoto",
  title: "A calm Saturday in Kyoto · Lantern",
};

function abort(): Error {
  const error = new Error("The user cancelled");
  error.name = "AbortError";
  return error;
}

function channelOf(
  share?: ShareChannel["share"],
  fails = false,
): ShareChannel & {
  copied: string[];
} {
  const copied: string[] = [];
  return {
    copied,
    share,
    clipboard: {
      writeText: (text: string) => {
        if (fails) return Promise.reject(new Error("denied"));
        copied.push(text);
        return Promise.resolve();
      },
    },
  };
}

describe("dayLinkOf", () => {
  it("puts the day's address on the page's origin", () => {
    expect(dayLinkOf("/day/kyoto", "https://www.lanternday.com")).toBe(LINK.url);
    expect(dayLinkOf("/day/1b6f0c2e", "https://lantern-git-x.vercel.app")).toBe(
      "https://lantern-git-x.vercel.app/day/1b6f0c2e",
    );
  });
});

describe("shareDayLink", () => {
  it("opens the share sheet on a phone, with the day's title and link", async () => {
    const share = vi.fn(() => Promise.resolve());
    const channel = channelOf(share);
    await expect(shareDayLink(LINK, { channel, isPhone: true })).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: LINK.title, url: LINK.url });
    expect(channel.copied).toEqual([]);
  });

  it("says a sheet closed without sending was cancelled, and copies nothing", async () => {
    const channel = channelOf(() => Promise.reject(abort()));
    await expect(shareDayLink(LINK, { channel, isPhone: true })).resolves.toBe("cancelled");
    expect(channel.copied).toEqual([]);
  });

  it("copies the link where the sheet cannot open, and on a laptop", async () => {
    const failing = channelOf(() => Promise.reject(new Error("NotAllowedError")));
    await expect(shareDayLink(LINK, { channel: failing, isPhone: true })).resolves.toBe("copied");
    expect(failing.copied).toEqual([LINK.url]);

    const share = vi.fn(() => Promise.resolve());
    const laptop = channelOf(share);
    await expect(shareDayLink(LINK, { channel: laptop, isPhone: false })).resolves.toBe("copied");
    expect(share).not.toHaveBeenCalled();
  });

  it("fails without throwing where nothing can send it", async () => {
    await expect(
      shareDayLink(LINK, { channel: channelOf(undefined, true), isPhone: false }),
    ).resolves.toBe("failed");
    await expect(shareDayLink(LINK, { channel: {}, isPhone: false })).resolves.toBe("failed");
    await expect(shareDayLink(LINK, { channel: null, isPhone: true })).resolves.toBe("failed");
  });

  it("reads the device itself when not told", async () => {
    const original = navigator.clipboard;
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    try {
      await expect(shareDayLink(LINK)).resolves.toBe("copied");
      expect(writeText).toHaveBeenCalledWith(LINK.url);
    } finally {
      Object.defineProperty(navigator, "clipboard", { value: original, configurable: true });
    }
  });
});
