/**
 * Tests for request validation and error mapping.
 *
 * The important one is "a client cannot inject a wellness flag": the brief says
 * the backend must decide wellness events independently, and a strict schema is
 * what enforces it. The rest pin down the status codes so an error never
 * degrades into a 500 with internals attached.
 *
 * Needs `--conditions=react-server`; `npm run test` sets it.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError, handleRoute, ok, parseJsonBody } from "../src/lib/http";
import { chatRequestSchema, parseLimit, scheduleUpdateSchema } from "../src/lib/validation";

/** Builds a POST request with a raw (possibly invalid) body. */
function post(body: string) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("chatRequestSchema", () => {
  it("accepts a valid request", () => {
    const parsed = chatRequestSchema.parse({ seniorId: "senior-001", message: "My leg hurts." });
    assert.deepEqual(parsed, { seniorId: "senior-001", message: "My leg hurts." });
  });

  it("rejects a client-supplied wellnessAlert flag", () => {
    // The backend decides wellness events; the client may not assert one.
    assert.throws(() =>
      chatRequestSchema.parse({ seniorId: "senior-001", message: "Hello", wellnessAlert: true }),
    );
  });

  it("rejects a client-supplied severity", () => {
    assert.throws(() =>
      chatRequestSchema.parse({ seniorId: "senior-001", message: "Hello", severity: "HIGH" }),
    );
  });

  it("rejects an empty or whitespace-only message", () => {
    assert.throws(() => chatRequestSchema.parse({ seniorId: "senior-001", message: "" }));
    assert.throws(() => chatRequestSchema.parse({ seniorId: "senior-001", message: "   " }));
  });

  it("rejects a missing seniorId", () => {
    assert.throws(() => chatRequestSchema.parse({ message: "Hello" }));
  });

  it("rejects a non-string message", () => {
    assert.throws(() => chatRequestSchema.parse({ seniorId: "senior-001", message: 42 }));
  });

  it("rejects an id with unexpected characters", () => {
    assert.throws(() => chatRequestSchema.parse({ seniorId: "../../etc/passwd", message: "Hi" }));
  });

  it("trims surrounding whitespace", () => {
    assert.equal(
      chatRequestSchema.parse({ seniorId: " senior-001 ", message: " hello " }).message,
      "hello",
    );
  });
});

describe("scheduleUpdateSchema", () => {
  for (const status of ["UPCOMING", "IN_PROGRESS", "COMPLETED", "SKIPPED"]) {
    it(`accepts ${status}`, () => {
      assert.equal(scheduleUpdateSchema.parse({ status }).status, status);
    });
  }

  it("rejects an invalid status", () => {
    assert.throws(() => scheduleUpdateSchema.parse({ status: "DONE" }));
  });

  it("rejects extra fields", () => {
    assert.throws(() => scheduleUpdateSchema.parse({ status: "COMPLETED", seniorId: "x" }));
  });
});

describe("parseLimit", () => {
  it("falls back when absent", () => assert.equal(parseLimit(null, 20, 100), 20));
  it("caps at the maximum", () => assert.equal(parseLimit("500", 20, 100), 100));
  it("accepts a valid value", () => assert.equal(parseLimit("5", 20, 100), 5));
  it("rejects non-numeric input", () => assert.throws(() => parseLimit("abc", 20, 100)));
  it("rejects zero and negatives", () => {
    assert.throws(() => parseLimit("0", 20, 100));
    assert.throws(() => parseLimit("-3", 20, 100));
  });
});

describe("parseJsonBody", () => {
  it("parses a valid body", async () => {
    assert.deepEqual(await parseJsonBody(post('{"a":1}')), { a: 1 });
  });

  it("rejects malformed JSON with a 400", async () => {
    await assert.rejects(
      () => parseJsonBody(post("{")),
      (error: unknown) => error instanceof ApiError && error.status === 400,
    );
  });

  it("rejects an empty body with a 400", async () => {
    await assert.rejects(
      () => parseJsonBody(post("")),
      (error: unknown) => error instanceof ApiError && error.status === 400,
    );
  });
});

describe("handleRoute", () => {
  it("passes a success response through", async () => {
    const response = await handleRoute("test", async () => ok({ hello: "world" }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { hello: "world" });
  });

  it("maps ApiError to its status and code", async () => {
    const response = await handleRoute("test", async () => {
      throw ApiError.notFound("Senior not found.");
    });
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.error.code, "NOT_FOUND");
    assert.equal(body.error.message, "Senior not found.");
  });

  it("maps a validation failure to 400 with field details", async () => {
    const response = await handleRoute("test", async () => {
      chatRequestSchema.parse({ seniorId: "senior-001", message: "" });
      return ok({});
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert.ok(body.error.details.message, "expected per-field details");
  });

  it("never leaks an unexpected error's message or stack", async () => {
    const response = await handleRoute("test", async () => {
      throw new Error("postgresql://user:hunter2@db:5432 blew up at line 42");
    });
    assert.equal(response.status, 500);

    const raw = JSON.stringify(await response.json());
    assert.equal(raw.includes("hunter2"), false, "must not leak credentials");
    assert.equal(raw.includes("postgresql://"), false, "must not leak a connection string");
    assert.equal(raw.includes("line 42"), false, "must not leak internals");
    assert.match(raw, /Something went wrong/);
  });
});
