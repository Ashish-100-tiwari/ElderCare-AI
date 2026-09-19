import { NextResponse } from "next/server";

import { handler, readJson } from "@/lib/server/route";
import { patchSchedule } from "@/lib/server/live";
import { updateScheduleItem } from "@/lib/server/store";
import type { ScheduleItemUpdate } from "@/lib/types";

export const dynamic = "force-dynamic";

export const PATCH = handler(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const body = await readJson<ScheduleItemUpdate>(request);

    if (body.status) {
      const live = await patchSchedule(id, body.status);
      if (live) return NextResponse.json(live);
    }

    const updated = updateScheduleItem(id, body);
    if (!updated) {
      return NextResponse.json({ error: `No schedule item with id "${id}"` }, { status: 404 });
    }
    return NextResponse.json(updated);
  },
);
