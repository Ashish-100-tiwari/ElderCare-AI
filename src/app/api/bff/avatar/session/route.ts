import { NextResponse } from "next/server";

import { handler } from "@/lib/server/route";

export const dynamic = "force-dynamic";

/**
 * Integration point for a real-time avatar provider (HeyGen LiveAvatar).
 *
 * The provider key never reaches the browser: the client asks this route for a
 * short-lived session token, and only that token crosses the wire. Set
 * `HEYGEN_API_KEY` (and optionally `HEYGEN_AVATAR_ID`) server-side to switch the
 * live avatar on.
 *
 * Every failure path answers `configured: false` rather than an error, because
 * the UI's fallback — the built-in illustrated companion — is a perfectly good
 * experience and a demo must never die on a third party being unavailable.
 */

const TOKEN_ENDPOINT = "https://api.heygen.com/v1/streaming.create_token";

export const POST = handler(async () => {
  const apiKey = process.env.HEYGEN_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json({
      configured: false,
      reason: "No avatar provider configured. Using the built-in companion.",
    });
  }

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      // Status only — a provider error body can echo back request details.
      console.warn(`[eldercare] avatar token request failed: ${response.status}`);
      return NextResponse.json({
        configured: false,
        reason: "The avatar provider is unavailable. Using the built-in companion.",
      });
    }

    const body = (await response.json()) as { data?: { token?: string } };
    const token = body.data?.token;

    if (!token) {
      return NextResponse.json({
        configured: false,
        reason: "The avatar provider returned no token. Using the built-in companion.",
      });
    }

    return NextResponse.json({
      configured: true,
      token,
      sessionId: `heygen-${Date.now()}`,
      avatarId: process.env.HEYGEN_AVATAR_ID?.trim(),
    });
  } catch (error) {
    console.warn("[eldercare] avatar provider unreachable:", error);
    return NextResponse.json({
      configured: false,
      reason: "The avatar provider is unreachable. Using the built-in companion.",
    });
  }
});
