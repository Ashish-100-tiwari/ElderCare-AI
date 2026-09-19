import { NextResponse } from "next/server";

import { handler } from "@/lib/server/route";
import { clearLiveOverlay } from "@/lib/server/live";
import { resetDemo } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/**
 * Resets demo state so the presentation can be run again from the top.
 *
 * Deliberately local: it clears the in-memory demo store and any live status
 * overlay, and never deletes anything from the backend's database. Re-seeding
 * that is `npm run db:seed`, which is the database owner's call, not a button's.
 */
export const POST = handler(async () => {
  clearLiveOverlay();
  resetDemo();
  return NextResponse.json({ ok: true });
});
