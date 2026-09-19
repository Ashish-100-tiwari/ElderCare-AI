/**
 * Tests for the voice routes' guards and the audio filename derivation.
 *
 * Every case here is rejected before any OpenAI call, so the suite needs no API
 * key and costs nothing to run. The filename tests exist because that logic
 * fails in the most unhelpful way available: the API answers 400 for every
 * single request, with nothing in the response pointing at the filename.
 *
 * Needs `--conditions=react-server`; `npm run test` sets it.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { audioFilename } from "../src/services/openaiService";
import { POST as speak } from "../src/app/api/bff/voice/speak/route";
import { POST as transcribe } from "../src/app/api/bff/voice/transcribe/route";

function blob(type: string, bytes = 4096): Blob {
  return new Blob([new Uint8Array(bytes)], { type });
}

/** Builds a multipart request the way the browser's FormData would. */
function upload(fields: Record<string, string | Blob>, filename?: string): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value instanceof Blob && filename) form.append(key, value, filename);
    else form.append(key, value);
  }
  return new Request("http://localhost/api/bff/voice/transcribe", { method: "POST", body: form });
}

function speakRequest(body: unknown): Request {
  return new Request("http://localhost/api/bff/voice/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("audioFilename", () => {
  it("derives the extension from the container type", () => {
    assert.equal(audioFilename(blob("audio/webm")), "speech.webm");
    assert.equal(audioFilename(blob("audio/ogg")), "speech.ogg");
    assert.equal(audioFilename(blob("audio/mp4")), "speech.mp4");
    assert.equal(audioFilename(blob("audio/wav")), "speech.wav");
    assert.equal(audioFilename(blob("audio/flac")), "speech.flac");
  });

  it("maps audio/mpeg to .mp3, not .mpeg", () => {
    // The regression that produced a 400 on every request: MP3 bytes uploaded
    // under a .webm name, because the name was hardcoded.
    assert.equal(audioFilename(blob("audio/mpeg")), "speech.mp3");
  });

  it("strips codec parameters before matching", () => {
    assert.equal(audioFilename(blob("audio/webm;codecs=opus")), "speech.webm");
    assert.equal(audioFilename(blob("audio/ogg; codecs=opus")), "speech.ogg");
  });

  it("treats Chrome's audio-only video/webm as webm", () => {
    assert.equal(audioFilename(blob("video/webm")), "speech.webm");
  });

  it("keeps a supplied filename that already carries a known extension", () => {
    assert.equal(audioFilename(blob("audio/webm"), "recording.ogg"), "recording.ogg");
    assert.equal(audioFilename(blob("audio/mpeg"), "clip.mp3"), "clip.mp3");
  });

  it("ignores a supplied filename with no usable extension", () => {
    // MediaRecorder blobs reach the server as "blob" with no extension.
    assert.equal(audioFilename(blob("audio/mpeg"), "blob"), "speech.mp3");
    assert.equal(audioFilename(blob("audio/webm"), "speech.exe"), "speech.webm");
  });

  it("falls back to webm for an absent or unknown type", () => {
    assert.equal(audioFilename(blob("")), "speech.webm");
    assert.equal(audioFilename(blob("audio/basic")), "speech.webm");
  });
});

describe("POST /api/bff/voice/transcribe — guards", () => {
  it("rejects a request with no audio field", async () => {
    const response = await transcribe(upload({ language: "en" }));
    assert.equal(response.status, 400);
    assert.equal(((await response.json()) as { reason: string }).reason, "no_audio");
  });

  it("rejects an empty clip", async () => {
    const response = await transcribe(upload({ audio: blob("audio/webm", 0) }, "speech.webm"));
    assert.equal(response.status, 400);
    assert.equal(((await response.json()) as { reason: string }).reason, "empty_audio");
  });

  it("rejects a clip over the size cap with 413", async () => {
    const response = await transcribe(
      upload({ audio: blob("audio/webm", 10 * 1024 * 1024 + 1) }, "speech.webm"),
    );
    assert.equal(response.status, 413);
    assert.equal(((await response.json()) as { reason: string }).reason, "audio_too_large");
  });

  it("rejects a non-audio content type with 415", async () => {
    const response = await transcribe(upload({ audio: blob("application/pdf") }, "x.pdf"));
    assert.equal(response.status, 415);
    assert.equal(((await response.json()) as { reason: string }).reason, "unsupported_audio_type");
  });

  it("rejects a body that is not multipart form data", async () => {
    const response = await transcribe(
      new Request("http://localhost/api/bff/voice/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"audio":"nope"}',
      }),
    );
    assert.equal(response.status, 400);
    assert.equal(((await response.json()) as { reason: string }).reason, "malformed_form_data");
  });

  it("always answers with a text field, so the client never reads undefined", async () => {
    const response = await transcribe(upload({ language: "en" }));
    assert.equal(((await response.json()) as { text: string }).text, "");
  });
});

describe("POST /api/bff/voice/speak — guards", () => {
  it("rejects a missing text field", async () => {
    const response = await speak(speakRequest({}));
    assert.equal(response.status, 400);
  });

  it("rejects whitespace-only text", async () => {
    const response = await speak(speakRequest({ text: "   \n\t " }));
    assert.equal(response.status, 400);
  });

  it("rejects a non-string text field", async () => {
    const response = await speak(speakRequest({ text: 42 }));
    assert.equal(response.status, 400);
  });

  it("rejects text beyond the length cap", async () => {
    const response = await speak(speakRequest({ text: "a".repeat(1201) }));
    assert.equal(response.status, 400);
  });

  it("treats a malformed JSON body as missing text rather than throwing", async () => {
    const response = await speak(speakRequest("not json at all"));
    assert.equal(response.status, 400);
  });
});
