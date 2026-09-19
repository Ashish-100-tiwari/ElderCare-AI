/**
 * Tests for the route-protection proxy (`middleware.ts`'s replacement).
 *
 * This is the optimistic check, not the security boundary — the route handlers
 * verify the session for themselves. So what is worth asserting is exactly what
 * this layer promises: a signed-out visitor never loads a dashboard shell, and
 * where they were going survives the trip to /signin.
 *
 * Needs `--conditions=react-server`; `npm run test` sets it.
 */

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { NextRequest } from "next/server";

import { SESSION_COOKIE } from "../src/lib/auth/session-cookie";
import { signSessionToken } from "../src/lib/auth/token";
import { config, proxy } from "../src/proxy";

const payload = {
  seniorId: "senior-001",
  email: "test@gmail.com",
  name: "Rajesh Sharma",
  role: "senior" as const,
};

/** A request to `path`, optionally carrying a session cookie. */
function request(path: string, cookie?: string) {
  const headers = new Headers();
  if (cookie !== undefined) headers.set("cookie", `${SESSION_COOKIE}=${cookie}`);
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

/** The Location header of a redirect, parsed. */
function redirectTarget(response: Response) {
  const location = response.headers.get("location");
  assert.ok(location, "expected a Location header");
  return new URL(location);
}

describe("proxy — signed out", () => {
  it("redirects to /signin", async () => {
    const response = await proxy(request("/senior"));
    assert.equal(response.status, 307);
    assert.equal(redirectTarget(response).pathname, "/signin");
  });

  it("remembers the path it turned away", async () => {
    const target = redirectTarget(await proxy(request("/caregiver/conversations")));
    assert.equal(target.searchParams.get("redirect"), "/caregiver/conversations");
  });

  it("keeps the query string, so a deep link still lands correctly", async () => {
    const target = redirectTarget(await proxy(request("/senior/schedule?day=tomorrow")));
    assert.equal(target.searchParams.get("redirect"), "/senior/schedule?day=tomorrow");
  });

  it("redirects when there is no cookie at all", async () => {
    const response = await proxy(request("/senior"));
    assert.equal(response.status, 307);
  });

  it("redirects for an empty, malformed or unsigned cookie", async () => {
    for (const cookie of ["", "not-a-jwt", "aaa.bbb.ccc", "eyJhbGciOiJub25lIn0..", "null"]) {
      const response = await proxy(request("/senior", cookie));
      assert.equal(response.status, 307, `expected a redirect for cookie ${cookie || "''"}`);
      assert.equal(redirectTarget(response).pathname, "/signin");
    }
  });

  it("stays on the same origin — the redirect target is never attacker-controlled", async () => {
    const target = redirectTarget(await proxy(request("/senior?next=https://evil.example.com")));
    assert.equal(target.origin, "http://localhost:3000");
    assert.equal(target.pathname, "/signin");
  });
});

describe("proxy — signed in", () => {
  before(() => {
    process.env.AUTH_SECRET ??= "test-secret-for-the-suite-only-not-a-real-key";
  });

  it("lets a valid session through without redirecting", async () => {
    const response = await proxy(request("/senior", await signSessionToken(payload)));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("location"), null);
  });

  it("lets a valid session through on a nested path", async () => {
    const token = await signSessionToken(payload);
    for (const path of ["/senior/schedule", "/senior/profile", "/caregiver", "/caregiver/knowledge-base"]) {
      const response = await proxy(request(path, token));
      assert.equal(response.status, 200, `expected pass-through for ${path}`);
    }
  });

  it("redirects a token whose claims were edited", async () => {
    const token = await signSessionToken(payload);
    const [header, body, signature] = token.split(".");
    const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, unknown>;
    claims.seniorId = "senior-999";
    const forged = `${header}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${signature}`;

    const response = await proxy(request("/senior", forged));
    assert.equal(response.status, 307);
  });

  it("redirects a token signed with a different secret", async () => {
    const token = await signSessionToken(payload);
    const original = process.env.AUTH_SECRET;
    try {
      process.env.AUTH_SECRET = "a-completely-different-secret-value";
      assert.equal((await proxy(request("/senior", token))).status, 307);
    } finally {
      process.env.AUTH_SECRET = original;
    }
  });
});

describe("proxy — matcher", () => {
  it("covers both signed-in areas and their subtrees", () => {
    assert.deepEqual(config.matcher, ["/senior", "/senior/:path*", "/caregiver", "/caregiver/:path*"]);
  });

  it("does not run on the landing page, /signin or the API", () => {
    // The API routes answer 401 themselves; redirecting a fetch() to HTML would
    // turn a clean error into an unparseable response.
    for (const pattern of config.matcher) {
      assert.equal(pattern.startsWith("/api"), false);
      assert.equal(pattern === "/", false);
      assert.equal(pattern.startsWith("/signin"), false);
    }
  });
});
