import { WRITTEN_REQUESTS } from "@/lib/days/written/requests";
import {
  CITY_SIGNATURE_HEADER,
  signedKeyOf,
  type IntakeRouteAnswer,
  type SignedCity,
  type SignedPart,
} from "@/lib/intake/signed-city";
import type { IntakeResult } from "@/lib/schema/intake.schema";
import type { KeptRecord } from "./generation-log";

/**
 * The city's signature (`docs/decisions.md`, 2026-10-30, "A day for a city Lantern has not
 * written carries the intake's signature"). The day's model reads one free text, the city,
 * and plans in one zone, both sent by the client. The intake route signs each city it
 * resolved, its name and zone as the provider gave them, and the day route writes a city
 * Lantern has not written only under that signature: a client cannot send its own text to
 * the day's model, nor a zone of its choosing. The words the sentence lets a visitor change
 * are not signed, so they change on the client. Server only: the key is the server's.
 */

if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/live/city-signature.ts signs with the server's secret and runs only on the server",
  );
}

/**
 * What the key is for, so the visitor's salt derives a key that signs only cities, and the
 * salt itself never signs anything. A new label starts every signature afresh, as a changed
 * salt does.
 */
const KEY_LABEL = "lantern/city-signature/v1";

/** An HMAC-SHA-256 is 32 bytes, 43 characters of unpadded base64url. */
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const encoder = new TextEncoder();

/**
 * The key the intake route signs with and the day route checks with: derived from the
 * visitor's salt, `VISITOR_HASH_SALT`, by HKDF under its own label, so no new secret is
 * needed and a signature says nothing about any visitor's hash.
 */
export async function citySignatureKey(salt: string): Promise<CryptoKey> {
  const secret = await crypto.subtle.importKey("raw", encoder.encode(salt), "HKDF", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: encoder.encode(KEY_LABEL) },
    secret,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign", "verify"],
  );
}

/** The city and zone as one string, so neither can be moved into the other. */
function bytesOf(part: SignedPart): Uint8Array<ArrayBuffer> {
  return encoder.encode(signedKeyOf(part));
}

/** A city and its zone, signed. */
export async function signCity(
  key: CryptoKey,
  { city, timezone }: SignedPart,
): Promise<SignedCity> {
  const mac = await crypto.subtle.sign("HMAC", key, bytesOf({ city, timezone }));
  return { city, timezone, signature: Buffer.from(mac).toString("base64url") };
}

/** Whether a signature is the key's for this city and zone; in constant time, as `verify` is. */
export async function isSignedCity(
  key: CryptoKey,
  part: SignedPart,
  signature: string | null,
): Promise<boolean> {
  if (signature === null || !SIGNATURE_PATTERN.test(signature)) return false;
  return crypto.subtle.verify("HMAC", key, Buffer.from(signature, "base64url"), bytesOf(part));
}

/** Every city an intake result could play: the request's own, and each of its readings. */
function citiesOf(result: IntakeResult): SignedPart[] {
  const request = result.kind === "request" ? [result.request] : [];
  const readings =
    result.kind === "request" || result.kind === "question"
      ? result.readings.map(({ name, timezone }) => ({ city: name, timezone }))
      : [];
  const parts = [...request, ...readings].map(({ city, timezone }) => ({ city, timezone }));
  return parts.filter(
    (part, index) => parts.findIndex((other) => signedKeyOf(other) === signedKeyOf(part)) === index,
  );
}

/** The intake's result with every city it could play signed; as it is when it has none. */
export async function signedAnswerOf(
  result: IntakeResult,
  salt: string,
): Promise<IntakeRouteAnswer> {
  const cities = citiesOf(result);
  if (cities.length === 0) return result;
  const key = await citySignatureKey(salt);
  return { ...result, signed: await Promise.all(cities.map((city) => signCity(key, city))) };
}

/** A written day's city in its own zone: Lantern's own words, which need no signature. */
function isWrittenCity({ city, timezone }: SignedPart): boolean {
  return WRITTEN_REQUESTS.some((written) => written.city === city && written.timezone === timezone);
}

/**
 * Whether the day route may write this request: its city is a written day's, as when a
 * visitor changes a word of Kanazawa's day, or the request carries the intake's signature of
 * its city and zone in `CITY_SIGNATURE_HEADER`.
 */
export async function isSignedRequest(
  request: Request,
  part: SignedPart,
  salt: string,
): Promise<boolean> {
  if (isWrittenCity(part)) return true;
  const key = await citySignatureKey(salt);
  return isSignedCity(key, part, request.headers.get(CITY_SIGNATURE_HEADER));
}

/**
 * The city and zone of a day the server kept, as its record holds them, or null when the record
 * cannot vouch for them. A day's record was written only once its city passed `isSignedRequest`,
 * and a re-plan's only once its request named the city of the day the server read (`basis`). A
 * re-plan recorded before the server read its own day held a client's request
 * (`docs/security.md`, S1), so it vouches for nothing. The city it gives is one the visitor could
 * already ask for again with the signature they had, under the same limits.
 */
export function keptCityOf(record: KeptRecord | null): SignedPart | null {
  if (record === null || record.request === null) return null;
  if (record.context !== undefined && record.context.basis === undefined) return null;
  const { city, timezone } = record.request;
  return { city, timezone };
}
