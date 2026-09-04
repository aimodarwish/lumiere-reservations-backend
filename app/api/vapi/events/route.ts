import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { asRecord } from "@/lib/vapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCATION_ID = "22222222-2222-2222-2222-222222222222";
const ORGANIZATION_ID = "11111111-1111-1111-1111-111111111111";

function isAuthorized(request: Request): boolean {
  const expected = process.env.VAPI_WEBHOOK_SECRET;
  if (!expected || expected === "CHANGE_ME_TO_A_LONG_RANDOM_SECRET") return true;
  return request.headers.get("x-vapi-secret") === expected;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function integer(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed));
}

function objectPath(root: Record<string, unknown> | null, ...keys: string[]) {
  let current: unknown = root;
  for (const key of keys) {
    current = asRecord(current)?.[key];
  }
  return current;
}

function secondsBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const value = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();
    const root = asRecord(body);
    const message = asRecord(root?.message);
    const type = text(message?.type);

    if (type !== "end-of-call-report") {
      return NextResponse.json({ ok: true, ignored: type ?? "unknown" });
    }

    const call = asRecord(message?.call);
    const customer = asRecord(message?.customer) ?? asRecord(call?.customer);
    const artifact = asRecord(message?.artifact) ?? asRecord(call?.artifact);
    const analysis = asRecord(message?.analysis) ?? asRecord(call?.analysis);
    const structuredData = asRecord(analysis?.structuredData);

    const vapiCallId = text(call?.id);
    if (!vapiCallId) {
      return NextResponse.json({ ok: false, error: "Missing call id" }, { status: 200 });
    }

    const startedAt = text(message?.startedAt) ?? text(call?.startedAt);
    const endedAt = text(message?.endedAt) ?? text(call?.endedAt);
    const transcript =
      text(artifact?.transcript) ??
      text(message?.transcript) ??
      text(objectPath(call, "artifact", "transcript"));
    const summary = text(analysis?.summary) ?? text(objectPath(call, "analysis", "summary"));
    const recordingUrl =
      text(artifact?.recordingUrl) ??
      text(objectPath(artifact, "recording", "url")) ??
      text(objectPath(call, "artifact", "recordingUrl"));
    const sentiment =
      text(structuredData?.customer_sentiment) ??
      text(structuredData?.sentiment) ??
      text(analysis?.sentiment);
    const outcome =
      text(structuredData?.call_outcome) ??
      text(structuredData?.booking_outcome) ??
      text(message?.endedReason) ??
      text(call?.endedReason);
    const duration =
      integer(message?.durationSeconds) ??
      integer(call?.durationSeconds) ??
      secondsBetween(startedAt, endedAt);

    const supabase = getSupabaseAdmin();
    const locationId = process.env.LUMIERE_LOCATION_ID ?? LOCATION_ID;
    const organizationId = process.env.LUMIERE_ORGANIZATION_ID ?? ORGANIZATION_ID;

    const { data: linkedReservation } = await supabase
      .from("reservations")
      .select("id")
      .eq("vapi_call_id", vapiCallId)
      .maybeSingle();

    const { error } = await supabase.from("ai_calls").upsert(
      {
        organization_id: organizationId,
        location_id: locationId,
        reservation_id: linkedReservation?.id ?? null,
        vapi_call_id: vapiCallId,
        caller_phone: text(customer?.number),
        call_status: "completed",
        call_outcome: outcome,
        duration_seconds: duration,
        transcript,
        ai_summary: summary,
        customer_sentiment: sentiment,
        recording_url: recordingUrl,
        started_at: startedAt,
        ended_at: endedAt,
      },
      { onConflict: "vapi_call_id" },
    );

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Vapi event webhook failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
