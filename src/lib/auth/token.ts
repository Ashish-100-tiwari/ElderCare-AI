/**
 * Session tokens — sign and verify only.
 *
 * Deliberately free of `next/headers`: `proxy.ts` needs to verify a token, and
 * anything that reaches for the request-scoped cookie store cannot be imported
 * there. Reading and writing the cookie itself lives in `session.ts`.
 *
 * Stateless HS256 JWTs. There is no server-side session table, so signing out
 * clears the cookie rather than revoking the token — the token stays valid until
 * it expires. That is the accepted trade-off for a single-tenant demo; rotating
 * AUTH_SECRET is the lever that invalidates everything at once.
 */

import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

/** How long a session lasts. Long enough that a senior is not asked twice a day. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const ALGORITHM = "HS256";
const ISSUER = "eldercare-ai";
const AUDIENCE = "eldercare-app";

export type Role = "senior" | "caregiver";

/** What the app knows about the signed-in user without touching the database. */
export type SessionPayload = {
  /** The Senior row this session acts as. */
  seniorId: string;
  email: string;
  name: string;
  role: Role;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.authSecret());
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(payload.seniorId)
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_MAX_AGE_SECONDS)
    .sign(secretKey());
}

/**
 * Returns the payload, or null for anything that is not a currently valid token
 * signed by this deployment. Never throws: an expired or tampered cookie is an
 * ordinary "not signed in", not an error worth a 500.
 */
export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    const { seniorId, email, name, role } = payload as Record<string, unknown>;
    if (
      typeof seniorId !== "string" ||
      typeof email !== "string" ||
      typeof name !== "string" ||
      (role !== "senior" && role !== "caregiver")
    ) {
      return null;
    }
    return { seniorId, email, name, role };
  } catch (error) {
    // Expiry is the common case and not worth a log line at warn.
    const code = (error as { code?: unknown })?.code;
    if (code !== "ERR_JWT_EXPIRED") {
      log.warn("auth.token.invalid", { code: typeof code === "string" ? code : "unknown" });
    }
    return null;
  }
}

/**
 * Verifies the session straight off a request's `Cookie` header.
 *
 * Used where `next/headers` is unavailable or undesirable: `proxy.ts` has no
 * request-scoped cookie store, and reading the header keeps the `/api/bff/*`
 * wrapper callable from a test with a plain `Request`.
 */
export async function verifySessionFromCookieHeader(
  header: string | null | undefined,
  cookieName: string,
): Promise<SessionPayload | null> {
  if (!header) return null;

  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() !== cookieName) continue;

    const raw = pair.slice(separator + 1).trim();
    // Cookie values are percent-encoded by some clients; a JWT contains no
    // characters that need it, so a failed decode means it is not our token.
    let value: string;
    try {
      value = decodeURIComponent(raw);
    } catch {
      value = raw;
    }
    return verifySessionToken(value);
  }

  return null;
}
