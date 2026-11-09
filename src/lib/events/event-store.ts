import type { ProductEvent } from "./event.schema";

/**
 * Where the product's events are kept, and how many a day may bring: an interface with an
 * in-memory implementation for tests and a laptop, and the Postgres one a deploy writes to
 * (`postgres-event-store.ts`), which keeps the same contract.
 *
 * A visitor is known by a hash of their address under a salt that lives one UTC day
 * (`docs/decisions.md`, "Product events are kept under a visitor key that lives one day"): a
 * visitor's events of one day share a key, and nothing ties them to the same visitor's events of
 * another day, nor to the limits' key.
 */

/** How many events a day may bring, per UTC day and environment. */
export interface EventLimits {
  perVisitor: number;
  perApp: number;
}

/**
 * A visitor's ordinary session sends a few dozen events; 200 leaves room for several people
 * behind one address, as on a hotel's network. The app's 5,000 is many times a busy day's
 * traffic, and holds a day at its most to about 1.2 MB of events, indexes included
 * (measured on PGlite): a whole year at the cap is about 440 MB. Past it, the day's further
 * events are refused.
 */
export const EVENT_LIMITS: EventLimits = { perVisitor: 200, perApp: 5_000 };

/** One event as it is kept. */
export interface EventEntry {
  id: string;
  /** The visitor's hash under the day's salt, as 64 hex characters. */
  visitor: string;
  /** The UTC day it arrived, as `YYYY-MM-DD`. No time of day is kept. */
  day: string;
  event: ProductEvent;
}

export interface EventStore {
  /**
   * The random salt the visitors of `day` are hashed with, made the first time the day is
   * asked for. The days before it lose theirs, so their hashes cannot be made again.
   */
  saltOn(day: string): Promise<string>;
  /**
   * Keeps the event, or resolves false, keeping nothing, once the visitor's or the app's
   * events of the day are spent, or for a day whose salt is gone. Counting and keeping are
   * one step, so two events at once cannot both take the last place.
   */
  record(entry: EventEntry): Promise<boolean>;
}

const SALT_BYTES = 32;

/** A day's salt: 32 random bytes as hex. */
export function newSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** A process that runs for days keeps only the latest, as the in-memory generation log does. */
const MAX_IN_MEMORY_EVENTS = 500;

/**
 * Events in one process, for tests and a laptop without a database. It holds only the
 * current day's salt and counts, as the database does once the next day's first event
 * comes.
 */
export class InMemoryEventStore implements EventStore {
  readonly entries: EventEntry[] = [];
  private day = "";
  private salt = "";
  private appEvents = 0;
  private readonly visitorEvents = new Map<string, number>();

  constructor(private readonly limits: EventLimits = EVENT_LIMITS) {}

  saltOn(day: string): Promise<string> {
    if (day !== this.day) {
      this.day = day;
      this.salt = newSalt();
      this.appEvents = 0;
      this.visitorEvents.clear();
    }
    return Promise.resolve(this.salt);
  }

  record(entry: EventEntry): Promise<boolean> {
    const visitorEvents = this.visitorEvents.get(entry.visitor) ?? 0;
    const isSpent = visitorEvents >= this.limits.perVisitor || this.appEvents >= this.limits.perApp;
    if (entry.day !== this.day || isSpent) return Promise.resolve(false);
    this.visitorEvents.set(entry.visitor, visitorEvents + 1);
    this.appEvents += 1;
    this.entries.push(entry);
    if (this.entries.length > MAX_IN_MEMORY_EVENTS) this.entries.shift();
    return Promise.resolve(true);
  }
}
