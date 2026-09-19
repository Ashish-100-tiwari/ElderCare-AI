import { NextResponse } from "next/server";

import { handler, readJson } from "@/lib/server/route";
import { AiUnavailableError, synthesizeSpeech } from "@/services/openaiService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/bff/voice/speak — text to speech.
 *
 * Answers with MP3 bytes, not JSON, so the client can hand the response
 * straight to an `<audio>` element without a base64 round trip.
 *
 * A 503 here is not a failure the senior should ever see: the client falls back
 * to the browser's own speechSynthesis, which is flatter but always available.
 */

/** A companion line is a sentence or two. Anything longer is a bug upstream. */
const MAX_TEXT_LENGTH = 1200;

export const POST = handler(async (request: Request) => {
  const body = await readJson<{ text: string }>(request);
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!text) {
    return NextResponse.json({ error: "text is required." }, { status: 400 });
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `text must be at most ${MAX_TEXT_LENGTH} characters.` },
      { status: 400 },
    );
  }

  try {
    const { audio, contentType } = await synthesizeSpeech({ text });

    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(audio.byteLength),
        // The same line regenerated is the same audio, but it is also the
        // senior's speech passing through a shared cache. Keep it out of one.
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const reason = error instanceof AiUnavailableError ? error.reason : "synthesis_failed";
    return NextResponse.json({ error: "Speech synthesis is unavailable.", reason }, { status: 503 });
  }
});
