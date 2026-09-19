import { NextResponse } from "next/server";

import { handler, readJson } from "@/lib/server/route";
import { fetchAlerts, fetchWellnessReports, postWellnessCheck } from "@/lib/server/live";
import { createWellnessReport, getWellnessReports } from "@/lib/server/store";
import type { CreateWellnessReportPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  return NextResponse.json((await fetchWellnessReports()) ?? getWellnessReports());
});

export const POST = handler(async (request: Request) => {
  const body = await readJson<CreateWellnessReportPayload>(request);

  if (!body.mood) {
    return NextResponse.json({ error: "A mood is required." }, { status: 400 });
  }

  const payload: CreateWellnessReportPayload = {
    mood: body.mood,
    category: body.category,
    quote: body.quote,
    detail: body.detail,
    conversationId: body.conversationId ?? null,
  };

  /**
   * The live backend records the report and raises the alert in one call, then
   * we read both back so the caller gets the full objects rather than ids.
   */
  const quote = payload.quote?.trim();
  if (quote) {
    const outcome = await postWellnessCheck(quote);
    if (outcome) {
      const [reports, alerts] = await Promise.all([fetchWellnessReports(), fetchAlerts()]);
      return NextResponse.json(
        {
          report: reports?.[0] ?? null,
          alert: alerts?.find((candidate) => candidate.id === outcome.alertId) ?? null,
        },
        { status: 201 },
      );
    }
  }

  return NextResponse.json(createWellnessReport(payload), { status: 201 });
});
