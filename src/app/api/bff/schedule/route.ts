import { NextResponse } from "next/server";

import { handler } from "@/lib/server/route";
import { fetchSchedule } from "@/lib/server/live";
import { getSchedule } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const live = await fetchSchedule();
  // An empty live schedule is still a real answer; only `null` means "no backend".
  return NextResponse.json(live ?? getSchedule());
});
