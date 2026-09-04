import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkAvailability } from "@/lib/availability";
import type { CreateReservationArguments } from "@/lib/vapi";

const LOCATION_ID = "22222222-2222-2222-2222-222222222222";
const ORGANIZATION_ID = "11111111-1111-1111-1111-111111111111";

export type ReservationCreationContext = {
  customerPhone?: string | null;
  vapiCallId?: string | null;
};

function cleanOptional(value: string | undefined | null): string | null {
  if (!value) return null;
  const clean = value.trim();
  if (!clean || /^(none|no|n\/a|not applicable)$/i.test(clean)) return null;
  return clean;
}

function confirmationCode(): string {
  return `LUM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function createReservation(
  args: CreateReservationArguments,
  context: ReservationCreationContext = {},
) {
  const supabase = getSupabaseAdmin();
  const locationId = process.env.LUMIERE_LOCATION_ID ?? LOCATION_ID;
  const organizationId = process.env.LUMIERE_ORGANIZATION_ID ?? ORGANIZATION_ID;
  const customerPhone = cleanOptional(context.customerPhone);
  const occasion = cleanOptional(args.occasion);
  const dietary = cleanOptional(args.dietary_requirements);
  const requests = cleanOptional(args.special_requests);

  // Prefer the atomic database function installed by sql/phase-2-migration.sql.
  const { data: rpcData, error: rpcError } = await supabase.rpc("create_lumiere_reservation", {
    p_location_id: locationId,
    p_organization_id: organizationId,
    p_guest_name: args.guest_name.trim(),
    p_customer_phone: customerPhone,
    p_reservation_date: args.reservation_date,
    p_reservation_time: args.reservation_time,
    p_party_size: args.party_size,
    p_seating_preference: args.seating_preference,
    p_occasion: occasion,
    p_dietary_requirements: dietary,
    p_special_requests: requests,
    p_vapi_call_id: cleanOptional(context.vapiCallId),
  });

  if (!rpcError && rpcData) {
    const payload = typeof rpcData === "string" ? JSON.parse(rpcData) : rpcData;
    if (payload.success) return payload;
    return payload;
  }

  // Friendly fallback for deployments that have not run the migration yet.
  if (rpcError && !/function .* does not exist|schema cache/i.test(rpcError.message)) {
    throw new Error(`Reservation database function failed: ${rpcError.message}`);
  }

  const availability = await checkAvailability({
    reservation_date: args.reservation_date,
    preferred_time: args.reservation_time,
    party_size: args.party_size,
    seating_preference: args.seating_preference,
  });

  if (!availability.available || !availability.table) {
    return {
      success: false,
      reason: "no_longer_available",
      alternatives: availability.alternatives,
    };
  }

  let customerId: string | null = null;
  if (customerPhone) {
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id, total_reservations")
      .eq("organization_id", organizationId)
      .eq("phone", customerPhone)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      await supabase
        .from("customers")
        .update({
          full_name: args.guest_name.trim(),
          preferred_seating: args.seating_preference,
          total_reservations: (existingCustomer.total_reservations ?? 0) + 1,
        })
        .eq("id", customerId);
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          organization_id: organizationId,
          full_name: args.guest_name.trim(),
          phone: customerPhone,
          preferred_seating: args.seating_preference,
          total_reservations: 1,
        })
        .select("id")
        .single();
      if (customerError) throw new Error(`Customer could not be saved: ${customerError.message}`);
      customerId = newCustomer.id;
    }
  }

  const code = confirmationCode();
  const { data: reservation, error } = await supabase
    .from("reservations")
    .insert({
      location_id: locationId,
      customer_id: customerId,
      guest_name: args.guest_name.trim(),
      customer_phone: customerPhone,
      reservation_date: args.reservation_date,
      reservation_time: args.reservation_time,
      party_size: args.party_size,
      seating_preference: args.seating_preference,
      assigned_table_id: availability.table.id,
      occasion,
      dietary_requirements: dietary,
      special_requests: requests,
      booking_source: "ai_voice",
      reservation_status: "confirmed",
      confirmation_code: code,
      vapi_call_id: cleanOptional(context.vapiCallId),
    })
    .select("id, confirmation_code")
    .single();

  if (error) throw new Error(`Reservation could not be saved: ${error.message}`);

  return {
    success: true,
    reservation_id: reservation.id,
    confirmation_code: reservation.confirmation_code,
    assigned_table: availability.table.table_code,
    seating_area: availability.table.area,
  };
}
