/**
 * Tests for female browser-voice selection.
 *
 * The voice lists below are the real ones these platforms report, so a
 * regression here means Asha actually changes gender on that platform.
 *
 * Needs `--conditions=react-server`; `npm run test` sets it.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pickFemaleVoice, type VoiceLike } from "../src/lib/voice/femaleVoice";

const CHROME_LINUX: VoiceLike[] = [
  { name: "Google US English", lang: "en-US" },
  { name: "Google UK English Female", lang: "en-GB" },
  { name: "Google UK English Male", lang: "en-GB" },
  { name: "Google हिन्दी", lang: "hi-IN" },
];

const MACOS: VoiceLike[] = [
  { name: "Alex", lang: "en-US" },
  { name: "Daniel", lang: "en-GB" },
  { name: "Rishi", lang: "en-IN" },
  { name: "Veena", lang: "en-IN" },
  { name: "Lekha", lang: "hi-IN" },
  { name: "Samantha", lang: "en-US" },
];

const WINDOWS: VoiceLike[] = [
  { name: "Microsoft David - English (United States)", lang: "en-US" },
  { name: "Microsoft Zira - English (United States)", lang: "en-US" },
  { name: "Microsoft Heera - English (India)", lang: "en-IN" },
];

/** espeak, which is all a bare Linux box tends to have. */
const ESPEAK_MALE_ONLY: VoiceLike[] = [
  { name: "English (America)", lang: "en-US" },
  { name: "English (Great Britain)", lang: "en-GB" },
];

describe("pickFemaleVoice", () => {
  it("prefers the Hindi female voice on macOS", () => {
    // Lekha is hi-IN and female; Rishi is en-IN and male.
    assert.equal(pickFemaleVoice(MACOS)?.name, "Lekha");
  });

  it("never returns a known male voice", () => {
    for (const voices of [CHROME_LINUX, MACOS, WINDOWS]) {
      const picked = pickFemaleVoice(voices);
      assert.ok(picked, "expected a voice");
      for (const male of ["Alex", "Daniel", "Rishi", "David", "Male"]) {
        assert.ok(!picked.name.includes(male), `picked a male voice: ${picked.name}`);
      }
    }
  });

  it("is not fooled by 'Male' being a substring of 'Female'", () => {
    // "Google UK English Female" contains "male". The female check has to win.
    const picked = pickFemaleVoice([
      { name: "Google UK English Male", lang: "en-GB" },
      { name: "Google UK English Female", lang: "en-GB" },
    ]);
    assert.equal(picked?.name, "Google UK English Female");
  });

  it("refuses a male voice even when it is the only option", () => {
    assert.equal(
      pickFemaleVoice([{ name: "Microsoft David - English (United States)", lang: "en-US" }]),
      null,
    );
  });

  it("picks the Indian female voice on Windows", () => {
    assert.equal(pickFemaleVoice(WINDOWS)?.name, "Microsoft Heera - English (India)");
  });

  it("picks a female voice on Chrome/Linux", () => {
    const picked = pickFemaleVoice(CHROME_LINUX);
    assert.ok(picked);
    assert.ok(
      picked.name === "Google हिन्दी" || picked.name.includes("Female"),
      `unexpected pick: ${picked.name}`,
    );
  });

  it("returns null rather than gambling on an unlabelled voice", () => {
    // Neither name says anything about gender. Guessing would be a coin flip, so
    // the caller is told to use the platform default instead.
    assert.equal(pickFemaleVoice(ESPEAK_MALE_ONLY), null);
  });

  it("honours espeak's +f variants and the word 'female'", () => {
    assert.equal(
      pickFemaleVoice([
        { name: "English (America)", lang: "en-US" },
        { name: "english-us+f3", lang: "en-US" },
      ])?.name,
      "english-us+f3",
    );
  });

  it("respects the language preference order", () => {
    const voices: VoiceLike[] = [
      { name: "Samantha", lang: "en-US" },
      { name: "Veena", lang: "en-IN" },
    ];
    assert.equal(pickFemaleVoice(voices, ["en-IN", "en-US"])?.name, "Veena");
    assert.equal(pickFemaleVoice(voices, ["en-US", "en-IN"])?.name, "Samantha");
  });

  it("tolerates an underscore locale and odd casing", () => {
    assert.equal(pickFemaleVoice([{ name: "VEENA", lang: "en_IN" }])?.name, "VEENA");
  });

  it("returns null for an empty list", () => {
    assert.equal(pickFemaleVoice([]), null);
  });
});
