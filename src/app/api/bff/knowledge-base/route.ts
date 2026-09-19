import { NextResponse } from "next/server";

import { handler } from "@/lib/server/route";
import { fetchSenior } from "@/lib/server/live";
import { getKnowledgeBase } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/**
 * The knowledge base is a view over the senior's profile — the same context the
 * backend feeds the model. With a live backend we render its profile; the
 * "learned from conversations" list stays empty because the backend does not
 * extract facts yet, and demo observations must not be shown as real ones.
 */
export const GET = handler(async () => {
  const live = await fetchSenior();
  return NextResponse.json(live ? getKnowledgeBase(live, []) : getKnowledgeBase());
});
