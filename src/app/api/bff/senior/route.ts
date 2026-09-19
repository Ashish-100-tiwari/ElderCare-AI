import { NextResponse } from "next/server";

import { fetchSenior } from "@/lib/server/live";
import { handler, readJson } from "@/lib/server/route";
import { getSenior, updateSenior } from "@/lib/server/store";
import type { SeniorUpdate } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  return NextResponse.json((await fetchSenior()) ?? getSenior());
});

/**
 * The backend has no profile-write endpoint yet, so edits always land in the
 * demo store. When one ships, add the call here — no UI change needed.
 */
export const PATCH = handler(async (request: Request) => {
  const body = await readJson<SeniorUpdate>(request);
  return NextResponse.json(updateSenior(body));
});
