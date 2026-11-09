import { ipAddress } from "@vercel/functions";

/**
 * A visitor is known by a salted SHA-256 of the client's address: no cookie, no banner, and the
 * address itself is never stored or logged (`docs/harness.md`, "Limits and spend").
 */

if (typeof window !== "undefined") {
  throw new Error("src/lib/live/visitor.ts reads the client's address and runs only on the server");
}

/**
 * Every request whose address the platform did not give, as on a laptop's dev server, shares
 * one visitor: a missing header can only make the limits stricter, never looser.
 */
const UNKNOWN_ADDRESS = "unknown";

const IPV6_GROUPS = 8;
/** An IPv6 network hands one subscriber a /64, the first four groups. */
const IPV6_SUBSCRIBER_GROUPS = 4;
const IPV4_MAPPED_PREFIX = [0, 0, 0, 0, 0, 0xffff];
const BYTE = 8;
const BYTE_MASK = 0xff;
const MAX_OCTET = 255;

/** The four octets of a dotted IPv4 address, or null when it is not one. */
function ipv4Octets(text: string): number[] | null {
  const parts = text.split(".");
  if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  return octets.every((octet) => octet <= MAX_OCTET) ? octets : null;
}

/**
 * The eight 16-bit groups of an IPv6 address, written in any of its forms: compressed with
 * `::`, in any case, in brackets, with a zone, or ending in a dotted IPv4 address. Null
 * when the text is not one.
 */
function ipv6Groups(address: string): number[] | null {
  let text = address
    .replace(/^\[|\]$/g, "")
    .replace(/%.*$/, "")
    .toLowerCase();
  const lastColon = text.lastIndexOf(":");
  const tail = ipv4Octets(text.slice(lastColon + 1));
  if (tail !== null) {
    const [a = 0, b = 0, c = 0, d = 0] = tail;
    text = `${text.slice(0, lastColon + 1)}${((a << BYTE) | b).toString(16)}:${((c << BYTE) | d).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const groupsOf = (part: string | undefined): string[] =>
    part === undefined || part === "" ? [] : part.split(":");
  const head = groupsOf(halves[0]);
  const rest = groupsOf(halves[1]);
  const missing = IPV6_GROUPS - head.length - rest.length;
  // `::` stands for at least one group of zeros; without it all eight are written.
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.map((group) => parseInt(group, 16));
}

/**
 * What a visitor's limits are kept under. An IPv4 address stands for itself. An IPv6 client
 * usually holds a whole /64, 2^64 addresses it can move between at will, so the visitor is
 * the /64; an IPv4 address mapped into IPv6 is read as the IPv4 address it carries.
 */
export function visitorKeyOf(address: string | undefined): string {
  const trimmed = address?.trim();
  if (trimmed === undefined || trimmed === "") return UNKNOWN_ADDRESS;
  const ipv4 = ipv4Octets(trimmed);
  if (ipv4 !== null) return ipv4.join(".");
  const groups = ipv6Groups(trimmed);
  if (groups === null) return trimmed.toLowerCase();
  if (IPV4_MAPPED_PREFIX.every((group, index) => groups[index] === group)) {
    const [high = 0, low = 0] = groups.slice(IPV4_MAPPED_PREFIX.length);
    return [high >> BYTE, high & BYTE_MASK, low >> BYTE, low & BYTE_MASK].join(".");
  }
  const prefix = groups.slice(0, IPV6_SUBSCRIBER_GROUPS).map((group) => group.toString(16));
  return `${prefix.join(":")}::/64`;
}

/** The salted hash a visitor's counters are kept under, as 64 hex characters. */
export async function hashVisitor(address: string | undefined, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${visitorKeyOf(address)}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * The visitor behind a request. The address is read as Next's docs say for Vercel, through
 * `ipAddress` from `@vercel/functions`, which reads the `x-real-ip` header. Only Vercel's
 * edge sets that header and overwrites one a client sends, so it is trustworthy on Vercel
 * alone: behind any other host a client could write its own and take fresh limits each
 * time. A client's `x-forwarded-for` is never read, since anyone can write one.
 */
export function visitorOf(request: Request, salt: string): Promise<string> {
  return hashVisitor(ipAddress(request), salt);
}
