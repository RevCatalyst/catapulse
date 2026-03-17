import { NextResponse } from "next/server";

import { getDashboardPayload } from "@/lib/catapulse-data";

export async function GET() {
  const dashboard = await getDashboardPayload();
  return NextResponse.json(dashboard);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    apiKey?: string;
  };

  const dashboard = await getDashboardPayload({
    apiKeyOverride: body.apiKey,
  });

  return NextResponse.json(dashboard);
}
