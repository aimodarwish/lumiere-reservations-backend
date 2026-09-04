import { NextResponse } from "next/server";
import { POST as eventsHandler } from "@/app/api/vapi/events/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return eventsHandler(request);
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Lumière Voice Webhook endpoint is active" });
}
