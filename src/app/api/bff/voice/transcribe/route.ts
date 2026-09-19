import { NextResponse } from "next/server";

import { handler } from "@/lib/server/route";
import { AiUnavailableError, transcribeSpeech } from "@/services/openaiService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/bff/voice/transcribe — speech to text.
 *
 * The fallback path for browsers with no SpeechRecognition API. The client
 * records with MediaRecorder, posts the clip here as multipart form data, and
 * the OpenAI key stays server-side exactly as it does for `/api/chat`.
 *
 * Failures answer `{ text: "" }` with a reason rather than an error status: the
 * senior can always type instead, and a 500 in the console is not worth turning
 * the composer into an error state over.
 */

/** Well past a spoken sentence, well short of anything worth paying to process. */
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/**
 * Containers MediaRecorder actually produces across browsers, plus the plain
 * `audio/*` variants Safari reports. Checked as a prefix because browsers append
 * codec parameters (`audio/webm;codecs=opus`).
 */
const ALLOWED_PREFIXES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "video/webm", // Chrome labels an audio-only webm this way often enough to matter.
];

/** Maps our UI's language names onto the ISO-639-1 hint the API wants. */
function languageHint(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalised = value.trim().toLowerCase();
  if (normalised.startsWith("hi")) return "hi";
  if (normalised.startsWith("en")) return "en";
  return undefined;
}

export const POST = handler(async (request: Request) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ text: "", reason: "malformed_form_data" }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ text: "", reason: "no_audio" }, { status: 400 });
  }

  if (audio.size === 0) {
    return NextResponse.json({ text: "", reason: "empty_audio" }, { status: 400 });
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ text: "", reason: "audio_too_large" }, { status: 413 });
  }

  const type = audio.type.toLowerCase();
  // An empty type is allowed through: some browsers omit it on a Blob slice, and
  // the filename extension is enough for the API to identify the container.
  if (type && !ALLOWED_PREFIXES.some((prefix) => type.startsWith(prefix))) {
    return NextResponse.json({ text: "", reason: "unsupported_audio_type" }, { status: 415 });
  }

  try {
    const text = await transcribeSpeech({
      audio,
      // A FormData entry uploaded with a filename arrives as a File; the
      // extension it carries is the most reliable format signal we have.
      filename: audio instanceof File ? audio.name : undefined,
      language: languageHint(form.get("language")),
    });
    return NextResponse.json({ text });
  } catch (error) {
    // AiUnavailableError already carries a scrubbed reason; anything else is
    // logged by `handler` upstream. Either way the UI just falls back to typing.
    const reason = error instanceof AiUnavailableError ? error.reason : "transcription_failed";
    return NextResponse.json({ text: "", reason }, { status: 503 });
  }
});
