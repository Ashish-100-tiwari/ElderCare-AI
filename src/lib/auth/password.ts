/**
 * Password hashing.
 *
 * scrypt from node:crypto — no dependency, no native build step, and a KDF
 * OWASP still recommends. Stored format is a single self-describing string:
 *
 *   scrypt$<N>$<r>$<p>$<salt-base64>$<hash-base64>
 *
 * The parameters travel with the hash so raising the cost later does not
 * invalidate existing passwords: an old hash still verifies against its own
 * recorded N/r/p.
 */

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/** OWASP's current floor for scrypt. ~64 MB of memory per hash. */
const COST = { N: 2 ** 16, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
/** node's default maxmem (32 MB) is below what N=2^16 needs, so raise it. */
const MAXMEM = 128 * COST.N * COST.r * 2;

const PREFIX = "scrypt";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, {
    ...COST,
    maxmem: MAXMEM,
  });
  return [
    PREFIX,
    COST.N,
    COST.r,
    COST.p,
    salt.toString("base64"),
    hash.toString("base64"),
  ].join("$");
}

/**
 * Constant-time comparison against a stored hash. Returns false — never throws —
 * for a malformed or unrecognised stored value, so a corrupt row reads as a
 * failed sign-in rather than a 500 that tells the caller the row is corrupt.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;

  const [, rawN, rawR, rawP, rawSalt, rawHash] = parts;
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  // A hostile stored value could otherwise ask for a memory-exhausting N.
  if (N < 2 ** 12 || N > 2 ** 20 || r < 1 || r > 32 || p < 1 || p > 16) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(rawHash, "base64");
    const salt = Buffer.from(rawSalt, "base64");
    if (expected.length === 0 || salt.length === 0) return false;

    const actual = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N,
      r,
      p,
      maxmem: Math.max(MAXMEM, 128 * N * r * 2),
    });
    // Lengths match by construction (keylen === expected.length), so
    // timingSafeEqual cannot throw here.
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
