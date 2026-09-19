import { NextResponse } from "next/server";

import { handler } from "@/lib/server/route";
import { fetchAlerts } from "@/lib/server/live";
import { getAlerts } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  return NextResponse.json((await fetchAlerts()) ?? getAlerts());
});
