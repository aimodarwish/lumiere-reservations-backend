import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { AvailabilityArguments } from "@/lib/vapi";

const ACTIVE_STATUSES = ["pending", "confirmed", "seated"];
const DEFAULT_DURATION_MINUTES = 120;
const DEFAULT_INTERVAL_MINUTES = 30;

type RestaurantTable = {
  id: string;
  table_code: string;
  area: "indoor" | "terrace";
  capacity: number;
};

type ExistingReservation = {
  assigned_table_id: string | null;
  reservation_time: string;
  duration_minutes: number;
};

type BusinessHours = {
  open_time: string;
  close_time: string;
  is_closed: boolean;
};

type LocationSettings = {
  default_reservation_duration: number;
  booking_interval_minutes: number;
  max_online_party_size: number;
  is_active: boolean;
};

function timeToMinutes(time: string): number {
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function minutesToTime(total: number): string {
  const normalized = ((total % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeToServiceDay(minutes: number, open: number, close: number): number {
  const overnight = close <= open;
  if (overnight && minutes < open) return minutes + 1440;
  return minutes;
}

function getDubaiToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getDayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && endA > startB;
}

async function loadContext(args: AvailabilityArguments) {
  const supabase = getSupabaseAdmin();
  const locationId = process.env.LUMIERE_LOCATION_ID ?? "22222222-2222-2222-2222-222222222222";
  const dayOfWeek = getDayOfWeek(args.reservation_date);

  const [{ data: location, error: locationError }, { data: hours, error: hoursError }] =
    await Promise.all([
      supabase
        .from("restaurant_locations")
        .select("default_reservation_duration, booking_interval_minutes, max_online_party_size, is_active")
        .eq("id", locationId)
        .single(),
      supabase
        .from("business_hours")
        .select("open_time, close_time, is_closed")
        .eq("location_id", locationId)
        .eq("day_of_week", dayOfWeek)
        .single(),
    ]);

  if (locationError || !location) {
    throw new Error(`Restaurant location could not be loaded: ${locationError?.message ?? "not found"}`);
  }
  if (hoursError || !hours) {
    throw new Error(`Business hours could not be loaded: ${hoursError?.message ?? "not found"}`);
  }

  const locationRecord = location as unknown as LocationSettings;
  const hoursRecord = hours as unknown as BusinessHours;

  if (!locationRecord.is_active) throw new Error("The restaurant location is currently inactive.");

  const areaFilter = args.seating_preference === "no_preference" ? null : args.seating_preference;
  let tablesQuery = supabase
    .from("restaurant_tables")
    .select("id, table_code, area, capacity")
    .eq("location_id", locationId)
    .eq("is_active", true)
    .gte("capacity", args.party_size)
    .order("capacity", { ascending: true });

  if (areaFilter) tablesQuery = tablesQuery.eq("area", areaFilter);

  const [{ data: tables, error: tablesError }, { data: reservations, error: reservationsError }] =
    await Promise.all([
      tablesQuery,
      supabase
        .from("reservations")
        .select("assigned_table_id, reservation_time, duration_minutes")
        .eq("location_id", locationId)
        .eq("reservation_date", args.reservation_date)
        .in("reservation_status", ACTIVE_STATUSES),
    ]);

  if (tablesError) throw new Error(`Tables could not be loaded: ${tablesError.message}`);
  if (reservationsError) throw new Error(`Reservations could not be loaded: ${reservationsError.message}`);

  return {
    locationId,
    hours: hoursRecord,
    tables: (tables ?? []) as unknown as RestaurantTable[],
    reservations: (reservations ?? []) as unknown as ExistingReservation[],
    duration: locationRecord.default_reservation_duration ?? DEFAULT_DURATION_MINUTES,
    interval: locationRecord.booking_interval_minutes ?? DEFAULT_INTERVAL_MINUTES,
    maxPartySize: locationRecord.max_online_party_size ?? 8,
  };
}

function findAvailableTable(params: {
  time: string;
  hours: BusinessHours;
  tables: RestaurantTable[];
  reservations: ExistingReservation[];
  duration: number;
}): RestaurantTable | null {
  const open = timeToMinutes(params.hours.open_time);
  const closeRaw = timeToMinutes(params.hours.close_time);
  const close = closeRaw <= open ? closeRaw + 1440 : closeRaw;
  const requestedStart = normalizeToServiceDay(timeToMinutes(params.time), open, closeRaw);
  const requestedEnd = requestedStart + params.duration;

  if (params.hours.is_closed || requestedStart < open || requestedEnd > close) return null;

  for (const table of params.tables) {
    const occupied = params.reservations.some((reservation) => {
      if (reservation.assigned_table_id !== table.id) return false;
      const existingStart = normalizeToServiceDay(
        timeToMinutes(reservation.reservation_time),
        open,
        closeRaw,
      );
      const existingEnd = existingStart + (reservation.duration_minutes ?? params.duration);
      return overlaps(requestedStart, requestedEnd, existingStart, existingEnd);
    });

    if (!occupied) return table;
  }

  return null;
}

function createCandidateTimes(params: {
  requestedTime: string;
  hours: BusinessHours;
  duration: number;
  interval: number;
}): string[] {
  const open = timeToMinutes(params.hours.open_time);
  const closeRaw = timeToMinutes(params.hours.close_time);
  const close = closeRaw <= open ? closeRaw + 1440 : closeRaw;
  const requested = normalizeToServiceDay(timeToMinutes(params.requestedTime), open, closeRaw);
  const lastStart = close - params.duration;
  const times: number[] = [];

  for (let cursor = open; cursor <= lastStart; cursor += params.interval) times.push(cursor);

  return times
    .filter((time) => time !== requested)
    .sort((a, b) => Math.abs(a - requested) - Math.abs(b - requested) || a - b)
    .map(minutesToTime);
}

export async function checkAvailability(args: AvailabilityArguments) {
  if (args.reservation_date < getDubaiToday()) {
    return {
      available: false,
      reason: "past_date" as const,
      alternatives: [] as string[],
    };
  }

  const context = await loadContext(args);

  if (args.party_size > context.maxPartySize) {
    return {
      available: false,
      reason: "party_too_large" as const,
      alternatives: [] as string[],
    };
  }

  const selectedTable = findAvailableTable({
    time: args.preferred_time,
    hours: context.hours,
    tables: context.tables,
    reservations: context.reservations,
    duration: context.duration,
  });

  if (selectedTable) {
    return {
      available: true,
      reason: "available" as const,
      alternatives: [args.preferred_time],
      table: selectedTable,
    };
  }

  const alternatives: string[] = [];
  const candidates = createCandidateTimes({
    requestedTime: args.preferred_time,
    hours: context.hours,
    duration: context.duration,
    interval: context.interval,
  });

  for (const candidate of candidates) {
    if (alternatives.length >= 3) break;
    const table = findAvailableTable({
      time: candidate,
      hours: context.hours,
      tables: context.tables,
      reservations: context.reservations,
      duration: context.duration,
    });
    if (table) alternatives.push(candidate);
  }

  return {
    available: false,
    reason: alternatives.length ? ("requested_time_unavailable" as const) : ("fully_booked" as const),
    alternatives,
  };
}
