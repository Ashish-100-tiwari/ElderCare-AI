import { NextResponse } from "next/server";

import { handler } from "@/lib/server/route";
import { fetchConversations } from "@/lib/server/live";
import { getConversations } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  return NextResponse.json((await fetchConversations()) ?? getConversations());
});
