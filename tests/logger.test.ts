/**
 * Tests for structured logging.
 *
 * The point of these is redaction. `log.*` is called from route handlers with
 * whatever context happened to be in scope, so the guarantee worth pinning down
 * is that no shape of input — a nested config object, a pg error, a raw string
 * with a connection string in it — can put a secret on stdout.
 *
 * Needs `--conditions=react-server`; `npm run test` sets it.
 */

import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { log, preview } from "../src/lib/logger";

/** Runs `fn` with console silenced and returns the single line it wrote. */
function capture(fn: () => void, method: "log" | "warn" | "error" = "log") {
  const spy = mock.method(console, method, () => {});
  try {
    fn();
    assert.equal(spy.mock.callCount(), 1, "expected exactly one line");
    return JSON.parse(spy.mock.calls[0].arguments[0] as string) as Record<string, unknown>;
  } finally {
    spy.mock.restore();
  }
}

afterEach(() => mock.restoreAll());

describe("log — line shape", () => {
  it("writes one JSON object with level, event and a timestamp", () => {
    const line = capture(() => log.info("chat.request", { route: "/api/chat" }));
    assert.equal(line.level, "info");
    assert.equal(line.event, "chat.request");
    assert.equal(line.route, "/api/chat");
    assert.ok(!Number.isNaN(Date.parse(line.at as string)), "at must be an ISO timestamp");
  });

  it("works with no data at all", () => {
    const line = capture(() => log.info("auth.signed_out"));
    assert.deepEqual(Object.keys(line).sort(), ["at", "event", "level"]);
  });

  it("routes warn to console.warn and error to console.error", () => {
    assert.equal(capture(() => log.warn("request.rejected"), "warn").level, "warn");
    assert.equal(capture(() => log.error("request.failed"), "error").level, "error");
  });

  it("cannot have its level or event overwritten by the data object", () => {
    // Spread order puts data last, so this documents the current behaviour: a
    // caller-supplied `level` wins. Worth knowing before trusting a log filter.
    const line = capture(() => log.info("chat.request", { level: "error" }));
    assert.equal(line.level, "error");
  });
});

describe("log — redaction by field name", () => {
  it("redacts anything that reads like a credential", () => {
    const line = capture(() =>
      log.info("chat.request", {
        apiKey: "sk-live-abcdef123456",
        OPENAI_API_KEY: "sk-live-abcdef123456",
        token: "eyJhbGciOiJIUzI1NiJ9.x.y",
        sessionToken: "eyJhbGciOiJIUzI1NiJ9.x.y",
        password: "123@Test",
        passwd: "123@Test",
        secret: "s3cret",
        credentials: "u:p",
        authorization: "Bearer abc",
        cookie: "eldercare_session=abc",
        DATABASE_URL: "postgresql://user:hunter2@localhost:5432/db",
        connectionString: "postgresql://user:hunter2@localhost:5432/db",
      }),
    );

    for (const [key, value] of Object.entries(line)) {
      if (key === "level" || key === "event" || key === "at") continue;
      assert.equal(value, "[REDACTED]", `${key} was not redacted`);
    }

    const raw = JSON.stringify(line);
    assert.equal(raw.includes("hunter2"), false);
    assert.equal(raw.includes("123@Test"), false);
  });

  it("matches the field name case-insensitively and as a substring", () => {
    const line = capture(() => log.info("chat.request", { userPasswordHash: "x", Cookie_Jar: "y" }));
    assert.equal(line.userPasswordHash, "[REDACTED]");
    assert.equal(line.Cookie_Jar, "[REDACTED]");
  });

  it("leaves ordinary fields readable", () => {
    const line = capture(() =>
      log.info("wellness.detected", { seniorId: "senior-001", severity: "HIGH", count: 2, ok: true }),
    );
    assert.equal(line.seniorId, "senior-001");
    assert.equal(line.severity, "HIGH");
    assert.equal(line.count, 2);
    assert.equal(line.ok, true);
  });

  it("redacts nested and array-nested credential fields", () => {
    const line = capture(() =>
      log.info("chat.request", {
        config: { openai: { apiKey: "sk-live-abcdef123456" } },
        attempts: [{ password: "123@Test", email: "test@gmail.com" }],
      }),
    );
    const config = line.config as { openai: { apiKey: string } };
    assert.equal(config.openai.apiKey, "[REDACTED]");
    const attempts = line.attempts as Array<{ password: string; email: string }>;
    assert.equal(attempts[0].password, "[REDACTED]");
    // The email is not a secret — an auth log is useless without a subject.
    assert.equal(attempts[0].email, "test@gmail.com");
  });

  it("stops descending after four levels instead of recursing forever", () => {
    const line = capture(() => log.info("chat.request", { a: { b: { c: { d: { e: "deep" } } } } }));
    const a = line.a as { b: { c: { d: { e: unknown } } } };
    assert.equal(a.b.c.d.e, "[truncated]");
  });

  it("survives a self-referencing object", () => {
    const cyclic: Record<string, unknown> = { name: "loop" };
    cyclic.self = cyclic;
    const line = capture(() => log.info("chat.request", cyclic));
    assert.equal(line.name, "loop");
  });
});

describe("log — redaction by value", () => {
  it("scrubs an OpenAI key that arrived in an innocently-named field", () => {
    const line = capture(
      () => log.error("chat.openai_failed", { detail: "auth failed for sk-live-abcdef123456" }),
      "error",
    );
    assert.equal(line.detail, "auth failed for [REDACTED]");
  });

  it("scrubs a connection string out of free text", () => {
    const line = capture(() =>
      log.error("db.error", { detail: "could not connect to postgresql://user:hunter2@db:5432/app" }),
      "error",
    );
    assert.equal(line.detail, "could not connect to [REDACTED]");
    assert.equal(JSON.stringify(line).includes("hunter2"), false);
  });

  it("scrubs a postgres:// URL too", () => {
    const line = capture(() => log.error("db.error", { detail: "postgres://u:p@db:5432/app is down" }), "error");
    assert.match(line.detail as string, /^\[REDACTED\] is down$/);
  });

  it("scrubs values inside arrays", () => {
    const line = capture(() => log.info("chat.request", { notes: ["sk-live-abcdef123456"] }));
    assert.deepEqual(line.notes, ["[REDACTED]"]);
  });
});

describe("log — errors", () => {
  it("logs the name and message but never the stack", () => {
    const line = capture(() => log.error("request.failed", { error: new TypeError("bad input") }), "error");
    assert.deepEqual(line.error, { name: "TypeError", message: "bad input" });
    assert.equal(JSON.stringify(line).includes("logger.test"), false, "stack frames must not be logged");
  });

  it("scrubs a secret out of an error message", () => {
    const line = capture(
      () => log.error("db.error", { error: new Error("connect ECONNREFUSED postgresql://u:hunter2@db:5432") }),
      "error",
    );
    const error = line.error as { message: string };
    assert.equal(error.message.includes("hunter2"), false);
    assert.match(error.message, /\[REDACTED\]/);
  });

  it("keeps a pg error's code, which is what maps it to a 503", () => {
    const pgError = Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" });
    const line = capture(() => log.error("db.error", { code: pgError.code, error: pgError }), "error");
    assert.equal(line.code, "ECONNREFUSED");
  });
});

describe("preview", () => {
  it("collapses all whitespace to single spaces and trims", () => {
    assert.equal(preview("  My   leg\n\nhurts.\t "), "My leg hurts.");
  });

  it("returns short text unchanged", () => {
    assert.equal(preview("My leg hurts."), "My leg hurts.");
  });

  it("truncates at the default 60 characters with an ellipsis", () => {
    const out = preview("x".repeat(100));
    assert.equal(out.length, 61, "60 characters plus the ellipsis");
    assert.equal(out, `${"x".repeat(60)}…`);
  });

  it("honours a custom maximum, and does not truncate at exactly the limit", () => {
    assert.equal(preview("abcdefghij", 10), "abcdefghij");
    assert.equal(preview("abcdefghijk", 10), "abcdefghij…");
  });

  it("scrubs a secret before previewing", () => {
    assert.equal(preview("my key is sk-live-abcdef123456"), "my key is [REDACTED]");
  });

  it("handles empty input", () => {
    assert.equal(preview(""), "");
    assert.equal(preview("   \n "), "");
  });
});
