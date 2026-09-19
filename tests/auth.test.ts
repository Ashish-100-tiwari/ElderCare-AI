/**
 * Tests for password hashing, session tokens and the sign-in schema.
 *
 * No database and no running server: `authService` is the only piece that needs
 * Postgres, and what is worth testing about it — that every failure is
 * indistinguishable — is asserted end-to-end against the live route instead.
 *
 * Needs `--conditions=react-server`; `npm run test` sets it.
 */

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { signSessionToken, verifySessionToken } from "../src/lib/auth/token";
import { signInSchema } from "../src/lib/validation";

describe("hashPassword / verifyPassword", () => {
  it("accepts the correct password", async () => {
    const stored = await hashPassword("123@Test");
    assert.equal(await verifyPassword("123@Test", stored), true);
  });

  it("rejects a wrong password, including near misses", async () => {
    const stored = await hashPassword("123@Test");
    assert.equal(await verifyPassword("123@test", stored), false);
    assert.equal(await verifyPassword("123@Tes", stored), false);
    assert.equal(await verifyPassword("123@Test ", stored), false);
    assert.equal(await verifyPassword("", stored), false);
  });

  it("produces a self-describing hash with the parameters embedded", async () => {
    const stored = await hashPassword("123@Test");
    const [scheme, N, r, p, salt, hash] = stored.split("$");
    assert.equal(scheme, "scrypt");
    assert.equal(N, String(2 ** 16));
    assert.equal(r, "8");
    assert.equal(p, "1");
    assert.equal(Buffer.from(salt, "base64").length, 16);
    assert.equal(Buffer.from(hash, "base64").length, 32);
  });

  it("salts, so the same password never stores the same hash twice", async () => {
    const [first, second] = await Promise.all([hashPassword("same"), hashPassword("same")]);
    assert.notEqual(first, second);
    // …and both still verify.
    assert.equal(await verifyPassword("same", first), true);
    assert.equal(await verifyPassword("same", second), true);
  });

  it("verifies a hash written with different cost parameters", async () => {
    // Proves the parameters really are read back from the stored string, which is
    // what lets the cost be raised later without invalidating old passwords.
    const cheap = "scrypt$4096$8$1$" + Buffer.from("saltsaltsaltsalt").toString("base64");
    const { scrypt } = await import("node:crypto");
    const key = await new Promise<Buffer>((resolve, reject) => {
      scrypt(
        "legacy",
        Buffer.from("saltsaltsaltsalt"),
        32,
        { N: 4096, r: 8, p: 1 },
        (error, derived) => (error ? reject(error) : resolve(derived)),
      );
    });
    const stored = `${cheap}$${key.toString("base64")}`;
    assert.equal(await verifyPassword("legacy", stored), true);
    assert.equal(await verifyPassword("wrong", stored), false);
  });

  it("returns false rather than throwing for a corrupt stored value", async () => {
    for (const bad of [
      "",
      "not-a-hash",
      "scrypt$65536$8$1$onlyfiveparts",
      "bcrypt$65536$8$1$c2FsdA==$aGFzaA==",
      "scrypt$abc$8$1$c2FsdA==$aGFzaA==",
      // N far above the allowed ceiling — must be refused, not attempted.
      "scrypt$1073741824$8$1$c2FsdA==$aGFzaA==",
      "scrypt$65536$8$1$$aGFzaA==",
    ]) {
      assert.equal(await verifyPassword("123@Test", bad), false, `expected false for ${bad || "''"}`);
    }
  });
});

describe("signSessionToken / verifySessionToken", () => {
  const payload = {
    seniorId: "senior-001",
    email: "test@gmail.com",
    name: "Rajesh Sharma",
    role: "senior" as const,
  };

  before(() => {
    // The real secret lives in .env.local, which the test runner does not load.
    process.env.AUTH_SECRET ??= "test-secret-for-the-suite-only-not-a-real-key";
  });

  it("round-trips the payload", async () => {
    const token = await signSessionToken(payload);
    assert.deepEqual(await verifySessionToken(token), payload);
  });

  it("is a three-part JWT that does not contain the secret", async () => {
    const token = await signSessionToken(payload);
    assert.equal(token.split(".").length, 3);
    assert.ok(!token.includes(process.env.AUTH_SECRET!));
  });

  it("rejects a token whose payload was edited", async () => {
    const token = await signSessionToken(payload);
    const [header, body, signature] = token.split(".");

    const decoded = JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, unknown>;
    decoded.seniorId = "senior-999";
    const forged = Buffer.from(JSON.stringify(decoded)).toString("base64url");

    // Same signature, different claims — exactly the attack HS256 exists to stop.
    assert.equal(await verifySessionToken(`${header}.${forged}.${signature}`), null);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signSessionToken(payload);
    const original = process.env.AUTH_SECRET;
    try {
      process.env.AUTH_SECRET = "a-completely-different-secret-value";
      assert.equal(await verifySessionToken(token), null);
    } finally {
      process.env.AUTH_SECRET = original;
    }
  });

  it("rejects an unsigned (alg: none) token", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    assert.equal(await verifySessionToken(`${header}.${body}.`), null);
  });

  it("returns null for missing and malformed input", async () => {
    assert.equal(await verifySessionToken(undefined), null);
    assert.equal(await verifySessionToken(""), null);
    assert.equal(await verifySessionToken("not.a.jwt"), null);
    assert.equal(await verifySessionToken("aaaa"), null);
  });

  it("sets an expiry a week out", async () => {
    const token = await signSessionToken(payload);
    const body = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    ) as { exp: number; iat: number };
    assert.equal(body.exp - body.iat, 60 * 60 * 24 * 7);
  });
});

describe("signInSchema", () => {
  it("normalises the email and leaves the password untouched", () => {
    const parsed = signInSchema.parse({ email: "  Test@Gmail.COM ", password: " 123@Test " });
    assert.equal(parsed.email, "test@gmail.com");
    // Not trimmed: a leading space may genuinely be part of the password.
    assert.equal(parsed.password, " 123@Test ");
  });

  it("rejects a malformed email", () => {
    for (const email of ["", "   ", "nope", "a@", "@b.com"]) {
      assert.equal(signInSchema.safeParse({ email, password: "x" }).success, false, email);
    }
  });

  it("rejects an empty password and unknown fields", () => {
    assert.equal(
      signInSchema.safeParse({ email: "test@gmail.com", password: "" }).success,
      false,
    );
    // Strict object: nothing can be smuggled alongside the credentials.
    assert.equal(
      signInSchema.safeParse({ email: "test@gmail.com", password: "x", role: "admin" }).success,
      false,
    );
  });

  it("caps the input length so a huge body never reaches scrypt", () => {
    assert.equal(
      signInSchema.safeParse({ email: "test@gmail.com", password: "x".repeat(201) }).success,
      false,
    );
    assert.equal(
      signInSchema.safeParse({ email: `${"a".repeat(250)}@b.com`, password: "x" }).success,
      false,
    );
  });
});
