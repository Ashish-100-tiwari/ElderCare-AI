import { NextResponse } from "next/server";

import { handler } from "@/lib/server/route";
import { fetchAlerts } from "@/lib/server/live";
import { acknowledgeAlert } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/**
 * Acknowledging an alert.
 *
 * The backend has no acknowledgement endpoint yet, so for a live alert this
 * returns the alert marked acknowledged without persisting it — the caregiver UI
 * keeps that in its own cache. Swap in the real call when it exists.
 */
export const POST = handler(
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;

    const live = (await fetchAlerts())?.find((candidate) => candidate.id === id);
    if (live) {
      return NextResponse.json({
        ...live,
        acknowledged: true,
        acknowledgedAt: new Date().toISOString(),
      });
    }

    const updated = acknowledgeAlert(id);
    if (!updated) {
      return NextResponse.json({ error: `No alert with id "${id}"` }, { status: 404 });
    }
    return NextResponse.json(updated);
  },
);
