/**
 * A database's errors can quote its connection string, password included. These take the
 * string and its password, raw or percent-decoded, out of a message before it is logged or
 * printed. No imports: `scripts/db-migrate.mts` runs this file through Node directly.
 */

const REDACTED = "[DATABASE_URL]";

/** What a message could quote: the whole string, and its password raw and decoded. */
export function secretsOf(connectionString: string): string[] {
  const secrets = [connectionString];
  try {
    const { password } = new URL(connectionString);
    secrets.push(password);
    secrets.push(decodeURIComponent(password));
  } catch {
    // Not a URL, or a password that does not decode: the rest is redacted all the same.
  }
  // Longest first, so the whole string goes before the password inside it.
  return [...new Set(secrets.filter((secret) => secret !== ""))].sort(
    (a, b) => b.length - a.length,
  );
}

export function redacted(message: string, secrets: readonly string[]): string {
  let text = message;
  for (const secret of secrets) text = text.replaceAll(secret, REDACTED);
  return text;
}
