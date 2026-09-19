import { NextResponse } from "next/server";

import { handler, readJson } from "@/lib/server/route";
import { postMessage } from "@/lib/server/live";
import { recordMood } from "@/lib/server/store";
import type { Mood } from "@/lib/types";

export const dynamic = "force-dynamic";

/** What tapping a face actually says, in the senior's voice. */
const moodQuote: Record<Mood, string> = {
  good: "I'm feeling good today.",
  okay: "I'm feeling okay today.",
  unwell: "I'm not feeling well today.",
};

/**
 * Tapping a mood face is both a wellness report and a turn in the conversation,
 * so it returns the same shape as sending a message.
 *
 * The live path sends the senior's words — not our classification — through the
 * chat endpoint. The backend refuses a client-supplied severity or category by
 * design: it decides those itself, so the two paths can never disagree.
 */
export const POST = handler(async (request: Request) => {
  const body = await readJson<{ mood: Mood }>(request);
  const mood = body.mood;

  if (!mood || !["good", "okay", "unwell"].includes(mood)) {
    return NextResponse.json({ error: "A valid mood is required." }, { status: 400 });
  }

  const live = await postMessage({ text: moodQuote[mood], source: "quick-reply" });
  if (live) {
    // The reply is the model's; the mood is the senior's own tap.
    return NextResponse.json({
      ...live,
      message: { ...live.message, signals: { ...live.message.signals, mood, topic: "wellness check" } },
    });
  }

  return NextResponse.json(recordMood(mood));
});
