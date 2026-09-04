import { getSupabaseAdmin } from "@/lib/supabase-admin";

const LOCATION_ID = "22222222-2222-2222-2222-222222222222";
const ORGANIZATION_ID = "11111111-1111-1111-1111-111111111111";
const ACTIVE_RESERVATION_STATUSES = ["pending", "confirmed", "seated"];
const FUTURE_RESERVATION_STATUSES = ["pending", "confirmed"];

function dubaiDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dayBoundsUtc(date: string) {
  // Dubai is UTC+4 year-round.
  return {
    start: new Date(`${date}T00:00:00+04:00`).toISOString(),
    end: new Date(`${date}T23:59:59.999+04:00`).toISOString(),
  };
}

export async function getDashboardSnapshot() {
  const supabase = getSupabaseAdmin();
  const locationId = process.env.LUMIERE_LOCATION_ID ?? LOCATION_ID;
  const organizationId = process.env.LUMIERE_ORGANIZATION_ID ?? ORGANIZATION_ID;
  const today = dubaiDate();
  const bounds = dayBoundsUtc(today);

  const [
    reservationsResult,
    callsResult,
    tablesResult,
    todayReservationsResult,
    upcomingReservationsResult,
    todayCallsResult,
  ] = await Promise.all([
    supabase
      .from("reservations")
      .select("id, guest_name, customer_phone, reservation_date, reservation_time, party_size, seating_preference, occasion, dietary_requirements, special_requests, booking_source, reservation_status, confirmation_code, created_at, restaurant_tables(table_code, area)")
      .eq("location_id", locationId)
      .order("reservation_date", { ascending: true })
      .order("reservation_time", { ascending: true })
      .limit(500),
    supabase
      .from("ai_calls")
      .select("id, vapi_call_id, caller_phone, call_status, call_outcome, duration_seconds, transcript, ai_summary, customer_sentiment, recording_url, started_at, ended_at, created_at, reservation_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("restaurant_tables")
      .select("id, table_code, area, capacity, is_active")
      .eq("location_id", locationId)
      .order("area")
      .order("capacity"),
    supabase
      .from("reservations")
      .select("id, party_size, reservation_status")
      .eq("location_id", locationId)
      .eq("reservation_date", today)
      .in("reservation_status", ACTIVE_RESERVATION_STATUSES),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("location_id", locationId)
      .gt("reservation_date", today)
      .in("reservation_status", FUTURE_RESERVATION_STATUSES),
    supabase
      .from("ai_calls")
      .select("id, reservation_id")
      .eq("organization_id", organizationId)
      .gte("created_at", bounds.start)
      .lte("created_at", bounds.end),
  ]);

  const errors = [
    reservationsResult.error,
    callsResult.error,
    tablesResult.error,
    todayReservationsResult.error,
    upcomingReservationsResult.error,
    todayCallsResult.error,
  ].filter(Boolean);

  if (errors.length) {
    throw new Error(errors.map((error) => error?.message).join(" | "));
  }

  const todayReservations = todayReservationsResult.data ?? [];
  const todayCalls = todayCallsResult.data ?? [];
  const expectedGuestsToday = todayReservations.reduce(
    (sum, row) => sum + (row.party_size ?? 0),
    0,
  );

  return {
    generatedAt: new Date().toISOString(),
    today,
    stats: {
      reservationsToday: todayReservations.length,
      upcomingReservations: upcomingReservationsResult.count ?? 0,
      expectedGuestsToday,
      callsToday: todayCalls.length,
    },
    reservations: reservationsResult.data ?? [],
    calls: callsResult.data ?? [],
    tables: tablesResult.data ?? [],
  };
}
