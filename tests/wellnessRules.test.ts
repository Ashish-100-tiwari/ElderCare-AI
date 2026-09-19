/**
 * Unit tests for wellness detection.
 *
 * Run with: npm run test
 *
 * No database and no API key required — analyzeWithRules is pure, which is the
 * whole reason it lives apart from wellnessService. These cases are the
 * behaviour we actually care about: the brief's examples must fire, ordinary
 * chat must not, and a denial must not be read as a complaint.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analyzeWithRules } from "../src/services/wellnessRules";

describe("analyzeWithRules — the brief's examples must all raise a concern", () => {
  const examples = [
    "My leg hurts.",
    "My chest feels uncomfortable.",
    "I'm feeling dizzy.",
    "I don't feel well.",
    "My leg feels uncomfortable.",
  ];

  for (const message of examples) {
    it(`flags: ${message}`, () => {
      const result = analyzeWithRules(message);
      assert.equal(result.isConcern, true, `expected a concern for "${message}"`);
      assert.equal(result.source, "rules");
    });
  }
});

describe("analyzeWithRules — ordinary conversation must stay quiet", () => {
  const benign = [
    "Good morning!",
    "What time is my walk today?",
    "I enjoyed the devotional music.",
    "Thank you, that was helpful.",
    "Tell me about the Ramayana.",
    "My grandson is coming to visit.",
    "",
    "   ",
  ];

  for (const message of benign) {
    it(`ignores: ${JSON.stringify(message)}`, () => {
      assert.equal(analyzeWithRules(message).isConcern, false);
    });
  }
});

describe("analyzeWithRules — negation", () => {
  it("does not flag a denial of pain", () => {
    assert.equal(analyzeWithRules("My leg does not hurt today.").isConcern, false);
    assert.equal(analyzeWithRules("No pain at all now.").isConcern, false);
  });

  it("still flags 'I don't feel well' despite the negation word", () => {
    const result = analyzeWithRules("I don't feel well.");
    assert.equal(result.isConcern, true);
    assert.equal(result.category, "GENERAL");
  });
});

describe("analyzeWithRules — categories", () => {
  it("routes a physical symptom to DISCOMFORT", () => {
    assert.equal(analyzeWithRules("My knee is aching.").category, "DISCOMFORT");
  });

  it("routes loneliness to EMOTIONAL", () => {
    assert.equal(analyzeWithRules("I feel very lonely today.").category, "EMOTIONAL");
  });

  it("prefers DISCOMFORT when a message mentions both", () => {
    assert.equal(analyzeWithRules("I am sad and my back hurts.").category, "DISCOMFORT");
  });

  it("routes a vague complaint to GENERAL", () => {
    assert.equal(analyzeWithRules("I feel weak today.").category, "GENERAL");
  });
});

describe("analyzeWithRules — severity", () => {
  it("escalates chest and breathing mentions to HIGH", () => {
    assert.equal(analyzeWithRules("My chest feels uncomfortable.").severity, "HIGH");
    assert.equal(analyzeWithRules("I am having trouble breathing.").severity, "HIGH");
  });

  it("escalates a fall to HIGH", () => {
    assert.equal(analyzeWithRules("I slipped and my hip hurts.").severity, "HIGH");
  });

  it("escalates on an intensifier", () => {
    assert.equal(analyzeWithRules("My head hurts very badly.").severity, "HIGH");
  });

  it("de-escalates on a softener", () => {
    assert.equal(analyzeWithRules("My leg is a little sore.").severity, "LOW");
  });

  it("uses MEDIUM for a plain report", () => {
    assert.equal(analyzeWithRules("My leg hurts.").severity, "MEDIUM");
  });
});

describe("analyzeWithRules — critical phrases stand alone", () => {
  // Each of these contains no word from the symptom list; the phrase itself
  // has to carry the detection.
  const critical = [
    "I am having trouble breathing.",
    "I can't breathe properly.",
    "I have shortness of breath.",
    "I have chest pressure.",
    "I fainted this morning.",
    "I fell in the bathroom.",
  ];

  for (const message of critical) {
    it(`flags HIGH: ${message}`, () => {
      const result = analyzeWithRules(message);
      assert.equal(result.isConcern, true, `expected a concern for "${message}"`);
      assert.equal(result.severity, "HIGH", `expected HIGH for "${message}"`);
    });
  }

  it("cannot be de-escalated by a softener", () => {
    assert.equal(analyzeWithRules("I have a little trouble breathing.").severity, "HIGH");
  });

  it("does not fire on meditation talk about breathing", () => {
    assert.equal(analyzeWithRules("Let's do some deep breathing together.").isConcern, false);
    assert.equal(analyzeWithRules("I finished my breathing exercise.").isConcern, false);
  });
});

describe("analyzeWithRules — Hindi/Hinglish", () => {
  it("flags 'dard' (pain)", () => {
    const result = analyzeWithRules("Mere pair mein dard hai.");
    assert.equal(result.isConcern, true);
    assert.equal(result.category, "DISCOMFORT");
  });

  it("flags 'chakkar' (dizziness)", () => {
    assert.equal(analyzeWithRules("Mujhe chakkar aa raha hai.").isConcern, true);
  });

  it("flags 'tabiyat theek nahi'", () => {
    assert.equal(analyzeWithRules("Meri tabiyat theek nahi hai.").isConcern, true);
  });
});

describe("analyzeWithRules — input hygiene", () => {
  it("survives control characters and zero-width padding", () => {
    const result = analyzeWithRules("My\u0000 leg​ hurts‮.");
    assert.equal(result.isConcern, true);
  });

  it("reports which terms fired", () => {
    const result = analyzeWithRules("My leg hurts.");
    assert.ok(result.matched.includes("hurts"), `matched was ${JSON.stringify(result.matched)}`);
  });
});
