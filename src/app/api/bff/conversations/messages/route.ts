import { NextResponse } from "next/server";

import { handler, readJson } from "@/lib/server/route";
import { postMessage } from "@/lib/server/live";
import { sendMessage } from "@/lib/server/store";
import type { SendMessagePayload } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * The single entry point for companion conversation.
 *
 * The live path forwards to the backend's `/api/chat`, which owns the model call
 * and the wellness detection. No model provider key exists in this process's
 * client bundle, and none is needed here either.
 */
export const POST = handler(async (request: Request) => {
  const body = await readJson<SendMessagePayload>(request);
  const text = body.text?.trim();

  if (!text) {
    return NextResponse.json({ error: "A message is required." }, { status: 400 });
  }

  const payload: SendMessagePayload = {
    text,
    conversationId: body.conversationId,
    source: body.source ?? "text",
  };

  return NextResponse.json((await postMessage(payload)) ?? sendMessage(payload));
});
