/**
 * Tests for the family webhook.
 *
 * These matter more than they look: the brief requires that a missing URL, a
 * failing receiver and a timeout each produce a specific recorded status and
 * never an exception, because an alert must never be lost to a webhook problem.
 *
 * Runs against a real throwaway HTTP server on localhost — no database and no
 * mocking of fetch. Needs `--conditions=react-server` so the `server-only`
 * marker resolves to a no-op outside Next; `npm run test` sets that.
 */

import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";

import { sendFamilyAlert } from "../src/services/webhookService";

const SENIOR = { id: "senior-001", name: "Rajesh Sharma", familyWebhookUrl: null };

/** Spins up a server whose behaviour each test controls. */
let server: Server;
let port: number;
let mode: "ok" | "error" | "hang" = "ok";
let received: Array<{ headers: Record<string, unknown>; body: string }> = [];

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      received.push({ headers: req.headers, body });
      if (mode === "hang") return; // never respond: forces the client timeout
      if (mode === "error") {
        res.writeHead(500).end("boom");
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" }).end("{}");
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  port = typeof address === "object" && address ? address.port : 0;
});

after(() => {
  server.closeAllConnections?.();
  server.close();
});

function url(path = "/hook") {
  return `http://127.0.0.1:${port}${path}`;
}

describe("sendFamilyAlert — no URL configured", () => {
  it("returns SIMULATED rather than failing", async () => {
    delete process.env.FAMILY_WEBHOOK_URL;
    const status = await sendFamilyAlert({ senior: SENIOR, message: "My leg hurts.", alertId: "a1" });
    assert.equal(status, "SIMULATED");
  });

  it("returns SIMULATED for a malformed URL instead of throwing", async () => {
    process.env.FAMILY_WEBHOOK_URL = "not-a-url";
    const status = await sendFamilyAlert({ senior: SENIOR, message: "My leg hurts.", alertId: "a2" });
    assert.equal(status, "SIMULATED");
  });

  it("refuses a non-HTTP protocol", async () => {
    process.env.FAMILY_WEBHOOK_URL = "file:///etc/passwd";
    const status = await sendFamilyAlert({ senior: SENIOR, message: "My leg hurts.", alertId: "a3" });
    assert.equal(status, "SIMULATED");
  });
});

describe("sendFamilyAlert — delivery", () => {
  it("returns SENT and posts the documented payload", async () => {
    mode = "ok";
    received = [];
    process.env.FAMILY_WEBHOOK_URL = url();

    const status = await sendFamilyAlert({
      senior: SENIOR,
      message: "My leg feels uncomfortable.",
      alertId: "a4",
    });

    assert.equal(status, "SENT");
    assert.equal(received.length, 1);

    const payload = JSON.parse(received[0].body);
    assert.equal(payload.event, "senior_discomfort");
    assert.equal(payload.seniorId, "senior-001");
    assert.equal(payload.seniorName, "Rajesh Sharma");
    assert.equal(payload.message, "My leg feels uncomfortable.");
    // An ISO 8601 timestamp, per the brief.
    assert.ok(!Number.isNaN(Date.parse(payload.timestamp)), "timestamp must be parseable");
    assert.equal(received[0].headers["content-type"], "application/json");
  });

  it("prefers the senior's own webhook URL over the environment default", async () => {
    mode = "ok";
    received = [];
    process.env.FAMILY_WEBHOOK_URL = "http://127.0.0.1:1/never-used";

    const status = await sendFamilyAlert({
      senior: { ...SENIOR, familyWebhookUrl: url("/per-senior") },
      message: "I feel dizzy.",
      alertId: "a5",
    });

    assert.equal(status, "SENT");
    assert.equal(received.length, 1);
  });

  it("returns FAILED on a 500 without throwing", async () => {
    mode = "error";
    received = [];
    process.env.FAMILY_WEBHOOK_URL = url();

    const status = await sendFamilyAlert({ senior: SENIOR, message: "My leg hurts.", alertId: "a6" });
    assert.equal(status, "FAILED");
  });

  it("returns FAILED when the receiver is unreachable", async () => {
    // Port 1 refuses connections.
    process.env.FAMILY_WEBHOOK_URL = "http://127.0.0.1:1/hook";
    const status = await sendFamilyAlert({ senior: SENIOR, message: "My leg hurts.", alertId: "a7" });
    assert.equal(status, "FAILED");
  });
});
