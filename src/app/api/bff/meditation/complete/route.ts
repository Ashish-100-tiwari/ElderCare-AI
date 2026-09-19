import { NextResponse } from "next/server";

import { handler, readJson } from "@/lib/server/route";
import { SENIOR_ID, findMeditationItem, patchSchedule } from "@/lib/server/live";
import { completeMeditation } from "@/lib/server/store";
import type { MeditationSession } from "@/lib/types";

export const dynamic = "force-dynamic";

interface CompleteMeditationBody {
  actualMinutes: number;
}

/**
 * Marks today's meditation done and returns the session plus the schedule row
 * that changed, so the senior screen can show the tick without a refetch.
 *
 * The backend models the schedule but not meditation sessions, so in live mode
 * the session record is built here from what the senior actually did.
 */
export const POST = handler(async (request: Request) => {
  const body = await readJson<CompleteMeditationBody>(request);
  const actualMinutes = Number.isFinite(body.actualMinutes) ? Number(body.actualMinutes) : 10;

  const liveItem = await findMeditationItem();
  if (liveItem) {
    const scheduleItem = await patchSchedule(liveItem.id, "completed");
    const now = new Date();
    const session: MeditationSession = {
      id: `meditation-${now.getTime()}`,
      seniorId: SENIOR_ID,
      startedAt: new Date(now.getTime() - actualMinutes * 60_000).toISOString(),
      completedAt: now.toISOString(),
      plannedMinutes: liveItem.durationMinutes,
      actualMinutes,
      completed: true,
    };
    return NextResponse.json({ session, scheduleItem: scheduleItem ?? liveItem });
  }

  return NextResponse.json(completeMeditation(actualMinutes));
});
