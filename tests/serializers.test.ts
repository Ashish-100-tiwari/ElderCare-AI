/**
 * Tests for response shaping.
 *
 * These are privacy tests, not formatting tests. Every route answers through one
 * of these serialisers, so an assertion that `familyWebhookUrl` and
 * `passwordHash` are absent is the thing standing between a schema change and a
 * leak — adding a column to `Senior` must never widen an API response.
 *
 * Needs `--conditions=react-server`; `npm run test` sets it.
 */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import type { Alert, Conversation, Schedule, Senior, WellnessReport } from "../src/generated/prisma";
import {
  alertItem,
  caregiverSenior,
  conversationItem,
  publicSenior,
  scheduleItem,
  wellnessItem,
} from "../src/lib/serializers";

const CREATED_AT = new Date("2026-09-19T02:00:00.000Z");

/** A full database row, including the fields no client may ever see. */
function senior(overrides: Partial<Senior> = {}): Senior {
  return {
    id: "senior-001",
    name: "Rajesh Sharma",
    age: 72,
    language: "Hindi",
    email: "test@gmail.com",
    passwordHash: "scrypt$65536$8$1$c2FsdA==$aGFzaA==",
    preferences: ["Likes morning walks"],
    familyContactName: "Priya Sharma",
    familyContactPhone: "+91 98765 43210",
    familyWebhookUrl: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  } as Senior;
}

/** Restores the env each test touches, so ordering cannot change a result. */
const originalWebhookUrl = process.env.FAMILY_WEBHOOK_URL;
afterEach(() => {
  if (originalWebhookUrl === undefined) delete process.env.FAMILY_WEBHOOK_URL;
  else process.env.FAMILY_WEBHOOK_URL = originalWebhookUrl;
});

describe("publicSenior — what the companion app sees", () => {
  it("returns exactly the companion-safe fields", () => {
    assert.deepEqual(publicSenior(senior()), {
      id: "senior-001",
      name: "Rajesh Sharma",
      age: 72,
      language: "Hindi",
      preferences: ["Likes morning walks"],
      familyContactName: "Priya Sharma",
      createdAt: "2026-09-19T02:00:00.000Z",
    });
  });

  it("omits the phone number, webhook URL and credentials", () => {
    const view = publicSenior(senior({ familyWebhookUrl: "https://hooks.example.com/abc" }));
    for (const key of ["familyContactPhone", "familyWebhookUrl", "email", "passwordHash", "updatedAt"]) {
      assert.equal(key in view, false, `${key} must not be exposed`);
    }
    const raw = JSON.stringify(view);
    assert.equal(raw.includes("98765"), false);
    assert.equal(raw.includes("hooks.example.com"), false);
    assert.equal(raw.includes("scrypt"), false);
  });

  it("emits createdAt as an ISO string, not a Date", () => {
    assert.equal(typeof publicSenior(senior()).createdAt, "string");
  });
});

describe("caregiverSenior — what the dashboard sees", () => {
  it("adds the family phone on top of the public view", () => {
    delete process.env.FAMILY_WEBHOOK_URL;
    const view = caregiverSenior(senior());
    assert.equal(view.familyContactPhone, "+91 98765 43210");
    assert.equal(view.name, "Rajesh Sharma");
  });

  it("never exposes the webhook URL itself, only whether one is configured", () => {
    const view = caregiverSenior(senior({ familyWebhookUrl: "https://hooks.example.com/secret-path" }));
    assert.equal("familyWebhookUrl" in view, false);
    assert.equal(view.webhookConfigured, true);
    assert.equal(JSON.stringify(view).includes("secret-path"), false);
  });

  it("reports configured when only the environment fallback is set", () => {
    process.env.FAMILY_WEBHOOK_URL = "https://hooks.example.com/global";
    assert.equal(caregiverSenior(senior({ familyWebhookUrl: null })).webhookConfigured, true);
  });

  it("reports not configured when neither the row nor the environment has one", () => {
    delete process.env.FAMILY_WEBHOOK_URL;
    assert.equal(caregiverSenior(senior({ familyWebhookUrl: null })).webhookConfigured, false);
  });

  it("treats a blank value as not configured", () => {
    // A whitespace-only override would fail to deliver; saying "configured"
    // would tell the family alerts are going out when they are not.
    process.env.FAMILY_WEBHOOK_URL = "   ";
    assert.equal(caregiverSenior(senior({ familyWebhookUrl: "   " })).webhookConfigured, false);
  });

  it("returns a boolean, never the truthy string", () => {
    process.env.FAMILY_WEBHOOK_URL = "https://hooks.example.com/global";
    assert.equal(typeof caregiverSenior(senior()).webhookConfigured, "boolean");
  });
});

describe("scheduleItem", () => {
  const row = {
    id: "sch-1",
    seniorId: "senior-001",
    activity: "Morning walk",
    description: "20 minutes in the park",
    scheduledTime: new Date("2026-09-19T02:00:00.000Z"),
    status: "UPCOMING",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  } as Schedule;

  it("returns the client fields with an ISO time", () => {
    assert.deepEqual(scheduleItem(row), {
      id: "sch-1",
      activity: "Morning walk",
      description: "20 minutes in the park",
      scheduledTime: "2026-09-19T02:00:00.000Z",
      status: "UPCOMING",
    });
  });

  it("drops seniorId and the bookkeeping timestamps", () => {
    const view = scheduleItem(row);
    for (const key of ["seniorId", "createdAt", "updatedAt"]) {
      assert.equal(key in view, false, `${key} must not be exposed`);
    }
  });
});

describe("conversationItem", () => {
  it("returns both sides of the turn with an ISO timestamp", () => {
    const view = conversationItem({
      id: "conv-1",
      seniorId: "senior-001",
      userMessage: "My leg hurts.",
      aiResponse: "I am sorry to hear that.",
      createdAt: CREATED_AT,
    } as Conversation);

    assert.deepEqual(view, {
      id: "conv-1",
      userMessage: "My leg hurts.",
      aiResponse: "I am sorry to hear that.",
      createdAt: "2026-09-19T02:00:00.000Z",
    });
  });
});

describe("wellnessItem", () => {
  it("returns the senior's own words with the server-decided category and severity", () => {
    const view = wellnessItem({
      id: "well-1",
      seniorId: "senior-001",
      message: "My leg hurts.",
      category: "DISCOMFORT",
      severity: "MEDIUM",
      createdAt: CREATED_AT,
    } as WellnessReport);

    assert.deepEqual(view, {
      id: "well-1",
      message: "My leg hurts.",
      category: "DISCOMFORT",
      severity: "MEDIUM",
      createdAt: "2026-09-19T02:00:00.000Z",
    });
  });
});

describe("alertItem", () => {
  it("returns the delivery status but nothing about the destination", () => {
    const view = alertItem({
      id: "alert-1",
      seniorId: "senior-001",
      type: "DISCOMFORT_REPORTED",
      message: "Rajesh Sharma reported discomfort.",
      webhookStatus: "SIMULATED",
      createdAt: CREATED_AT,
    } as Alert);

    assert.deepEqual(view, {
      id: "alert-1",
      type: "DISCOMFORT_REPORTED",
      message: "Rajesh Sharma reported discomfort.",
      webhookStatus: "SIMULATED",
      createdAt: "2026-09-19T02:00:00.000Z",
    });
  });
});
