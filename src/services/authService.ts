/**
 * Sign-in.
 *
 * The one rule this file exists to enforce: every failure looks identical from
 * the outside. Unknown email, no password set, wrong password — all return the
 * same null, and the caller turns that into one generic message. Distinguishing
 * them would let anyone enumerate which emails have accounts.
 *
 * It also spends roughly the same time on a missing user as on a real one, by
 * verifying against a dummy hash. Otherwise the response time alone leaks
 * whether an address is registered.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { SessionPayload } from "@/lib/auth/token";
import { log } from "@/lib/logger";

/**
 * A real hash of a value nobody knows, used to burn the same CPU time on a
 * missing user as on a present one. Computed once, lazily, and cached.
 */
let decoyHash: Promise<string> | null = null;
function decoy(): Promise<string> {
  decoyHash ??= hashPassword(`no-such-account-${Math.random()}`);
  return decoyHash;
}

/** Returns the session payload on success, null on any failure. */
export async function authenticate(email: string, password: string): Promise<SessionPayload | null> {
  const normalized = email.trim().toLowerCase();

  const senior = await prisma.senior.findUnique({
    where: { email: normalized },
    select: { id: true, name: true, email: true, passwordHash: true },
  });

  if (!senior?.passwordHash || !senior.email) {
    await verifyPassword(password, await decoy());
    log.warn("auth.failed", { reason: "unknown_account" });
    return null;
  }

  if (!(await verifyPassword(password, senior.passwordHash))) {
    log.warn("auth.failed", { reason: "bad_password", seniorId: senior.id });
    return null;
  }

  log.info("auth.signed_in", { seniorId: senior.id });
  return {
    seniorId: senior.id,
    email: senior.email,
    name: senior.name,
    // Single account for now; the caregiver dashboard is the family view of the
    // same senior. `role` is in the token so adding a distinct caregiver login
    // later does not need a new session format.
    role: "senior",
  };
}
