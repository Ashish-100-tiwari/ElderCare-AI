/**
 * Tests for the validation pieces `api.test.ts` does not cover: the id rules and
 * the route-segment / wellness parsers.
 *
 * `parseRouteId` is the one that matters most — it is the only thing between a
 * URL segment a stranger typed and a database query, and its error message must
 * never echo what was sent.
 *
 * Needs `--conditions=react-server`; `npm run test` sets it.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError } from "../src/lib/http";
import { idSchema, messageSchema, parseRouteId, wellnessRequestSchema } from "../src/lib/validation";

describe("idSchema", () => {
  it("accepts the id shapes the app actually uses", () => {
    for (const id of ["senior-001", "clx1a2b3c4d5e6f7g8h9i0j1", "a", "A_b-9", "1".repeat(128)]) {
      assert.equal(idSchema.safeParse(id).success, true, id);
    }
  });

  it("trims before validating", () => {
    assert.equal(idSchema.parse("  senior-001  "), "senior-001");
  });

  it("rejects empty and whitespace-only ids", () => {
    for (const id of ["", "   ", "\t\n"]) {
      assert.equal(idSchema.safeParse(id).success, false, JSON.stringify(id));
    }
  });

  it("rejects anything longer than 128 characters", () => {
    assert.equal(idSchema.safeParse("1".repeat(129)).success, false);
  });

  it("rejects path traversal, separators and wildcards", () => {
    for (const id of ["../../etc/passwd", "senior/001", "senior..001", "*", "senior 001", "senior%2F001"]) {
      assert.equal(idSchema.safeParse(id).success, false, id);
    }
  });

  it("rejects the shapes an injection attempt would use", () => {
    for (const id of ["1 OR 1=1", "senior'--", "'; DROP TABLE seniors;--", "{$ne:null}", "<script>"]) {
      assert.equal(idSchema.safeParse(id).success, false, id);
    }
  });

  it("rejects non-strings, including a number that looks like an id", () => {
    for (const id of [1, null, undefined, true, ["senior-001"], { id: "senior-001" }]) {
      assert.equal(idSchema.safeParse(id).success, false, JSON.stringify(id) ?? "undefined");
    }
  });

  it("rejects non-ASCII characters", () => {
    for (const id of ["senior-००१", "señor-001", "senior-001​"]) {
      assert.equal(idSchema.safeParse(id).success, false, id);
    }
  });
});

describe("messageSchema", () => {
  it("accepts a normal complaint and trims it", () => {
    assert.equal(messageSchema.parse("  My leg hurts.  "), "My leg hurts.");
  });

  it("accepts exactly 2000 characters and rejects 2001", () => {
    assert.equal(messageSchema.safeParse("x".repeat(2000)).success, true);
    assert.equal(messageSchema.safeParse("x".repeat(2001)).success, false);
  });

  it("rejects whitespace-only input, which trims to nothing", () => {
    assert.equal(messageSchema.safeParse("   \n  ").success, false);
  });

  it("accepts a message that is only 2000 characters after trimming", () => {
    assert.equal(messageSchema.safeParse(`  ${"x".repeat(2000)}  `).success, true);
  });
});

describe("wellnessRequestSchema", () => {
  it("accepts a valid report", () => {
    assert.deepEqual(wellnessRequestSchema.parse({ seniorId: "senior-001", message: "I feel dizzy." }), {
      seniorId: "senior-001",
      message: "I feel dizzy.",
    });
  });

  it("refuses a client-asserted severity or category", () => {
    // The whole point of the wellness pipeline is that the server decides this.
    for (const extra of [{ severity: "HIGH" }, { category: "DISCOMFORT" }, { wellnessAlert: true }]) {
      assert.equal(
        wellnessRequestSchema.safeParse({ seniorId: "senior-001", message: "I feel dizzy.", ...extra }).success,
        false,
        JSON.stringify(extra),
      );
    }
  });

  it("requires both fields", () => {
    assert.equal(wellnessRequestSchema.safeParse({ seniorId: "senior-001" }).success, false);
    assert.equal(wellnessRequestSchema.safeParse({ message: "I feel dizzy." }).success, false);
    assert.equal(wellnessRequestSchema.safeParse({}).success, false);
  });

  it("rejects a non-object body", () => {
    for (const body of [null, "senior-001", 42, []]) {
      assert.equal(wellnessRequestSchema.safeParse(body).success, false, JSON.stringify(body));
    }
  });
});

describe("parseRouteId", () => {
  it("returns the trimmed id when it is valid", () => {
    assert.equal(parseRouteId("senior-001", "seniorId"), "senior-001");
    assert.equal(parseRouteId(" senior-001 ", "seniorId"), "senior-001");
  });

  it("throws a 400 for a missing segment", () => {
    assert.throws(
      () => parseRouteId(undefined, "seniorId"),
      (error: unknown) =>
        error instanceof ApiError && error.status === 400 && error.code === "VALIDATION_ERROR",
    );
  });

  it("throws a 400 rather than running a doomed query", () => {
    for (const value of ["", "   ", "../../etc/passwd", "a".repeat(200), "senior 001"]) {
      assert.throws(() => parseRouteId(value, "seniorId"), ApiError, `expected a throw for ${value || "''"}`);
    }
  });

  it("names the parameter but never echoes the value back", () => {
    // Reflecting the input would hand an attacker a way to bounce text off the API.
    try {
      parseRouteId("<script>alert(1)</script>", "seniorId");
      assert.fail("expected a throw");
    } catch (error) {
      assert.ok(error instanceof ApiError);
      assert.equal(error.message, "Invalid seniorId.");
      assert.equal(error.message.includes("script"), false);
      assert.equal(error.details, undefined);
    }
  });

  it("uses the label it was given, so the client knows which segment was wrong", () => {
    assert.throws(() => parseRouteId("bad id", "scheduleId"), { message: "Invalid scheduleId." });
  });
});
