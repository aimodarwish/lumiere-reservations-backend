-- =====================================================
-- LUMIÈRE AI RESERVATION SYSTEM — PHASE 2
-- Atomic reservation creation + call reporting support
-- Run once in Supabase SQL Editor.
-- =====================================================

create or replace function public.create_lumiere_reservation(
  p_location_id uuid,
  p_organization_id uuid,
  p_guest_name text,
  p_customer_phone text,
  p_reservation_date date,
  p_reservation_time time,
  p_party_size integer,
  p_seating_preference text,
  p_occasion text,
  p_dietary_requirements text,
  p_special_requests text,
  p_vapi_call_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location public.restaurant_locations%rowtype;
  v_hours public.business_hours%rowtype;
  v_table public.restaurant_tables%rowtype;
  v_customer_id uuid;
  v_reservation_id uuid;
  v_confirmation_code text;
  v_open_minutes integer;
  v_close_minutes integer;
  v_request_minutes integer;
  v_request_end integer;
  v_duration integer;
  v_existing_start integer;
  v_existing_end integer;
  v_attempt integer := 0;
begin
  if p_guest_name is null or length(trim(p_guest_name)) < 2 then
    return jsonb_build_object('success', false, 'reason', 'invalid_guest_name');
  end if;

  if p_party_size < 1 then
    return jsonb_build_object('success', false, 'reason', 'invalid_party_size');
  end if;

  if p_seating_preference not in ('indoor', 'terrace', 'no_preference') then
    return jsonb_build_object('success', false, 'reason', 'invalid_seating_preference');
  end if;

  select * into v_location
  from public.restaurant_locations
  where id = p_location_id
    and organization_id = p_organization_id
    and is_active = true;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'location_not_found');
  end if;

  if p_party_size > v_location.max_online_party_size then
    return jsonb_build_object('success', false, 'reason', 'party_too_large');
  end if;

  if p_reservation_date < (now() at time zone coalesce(v_location.timezone, 'Asia/Dubai'))::date then
    return jsonb_build_object('success', false, 'reason', 'past_date');
  end if;

  select * into v_hours
  from public.business_hours
  where location_id = p_location_id
    and day_of_week = extract(dow from p_reservation_date)::integer;

  if not found or v_hours.is_closed then
    return jsonb_build_object('success', false, 'reason', 'restaurant_closed');
  end if;

  v_duration := coalesce(v_location.default_reservation_duration, 120);
  v_open_minutes := extract(hour from v_hours.open_time)::integer * 60
                    + extract(minute from v_hours.open_time)::integer;
  v_close_minutes := extract(hour from v_hours.close_time)::integer * 60
                     + extract(minute from v_hours.close_time)::integer;
  v_request_minutes := extract(hour from p_reservation_time)::integer * 60
                       + extract(minute from p_reservation_time)::integer;

  if v_close_minutes <= v_open_minutes then
    v_close_minutes := v_close_minutes + 1440;
    if v_request_minutes < v_open_minutes then
      v_request_minutes := v_request_minutes + 1440;
    end if;
  end if;

  v_request_end := v_request_minutes + v_duration;

  if v_request_minutes < v_open_minutes or v_request_end > v_close_minutes then
    return jsonb_build_object('success', false, 'reason', 'outside_business_hours');
  end if;

  -- Serialize bookings for this restaurant/date to prevent double booking.
  perform pg_advisory_xact_lock(
    hashtextextended(p_location_id::text || ':' || p_reservation_date::text, 0)
  );

  select t.* into v_table
  from public.restaurant_tables t
  where t.location_id = p_location_id
    and t.is_active = true
    and t.capacity >= p_party_size
    and (
      p_seating_preference = 'no_preference'
      or t.area = p_seating_preference
    )
    and not exists (
      select 1
      from public.reservations r
      where r.location_id = p_location_id
        and r.reservation_date = p_reservation_date
        and r.assigned_table_id = t.id
        and r.reservation_status in ('pending', 'confirmed', 'seated')
        and (
          (
            case
              when v_close_minutes > 1440
               and (extract(hour from r.reservation_time)::integer * 60
                    + extract(minute from r.reservation_time)::integer) < v_open_minutes
              then (extract(hour from r.reservation_time)::integer * 60
                    + extract(minute from r.reservation_time)::integer) + 1440
              else (extract(hour from r.reservation_time)::integer * 60
                    + extract(minute from r.reservation_time)::integer)
            end
          ) < v_request_end
          and
          (
            case
              when v_close_minutes > 1440
               and (extract(hour from r.reservation_time)::integer * 60
                    + extract(minute from r.reservation_time)::integer) < v_open_minutes
              then (extract(hour from r.reservation_time)::integer * 60
                    + extract(minute from r.reservation_time)::integer) + 1440
              else (extract(hour from r.reservation_time)::integer * 60
                    + extract(minute from r.reservation_time)::integer)
            end
            + coalesce(r.duration_minutes, v_duration)
          ) > v_request_minutes
        )
    )
  order by t.capacity asc, t.table_code asc
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'no_longer_available');
  end if;

  if nullif(trim(coalesce(p_customer_phone, '')), '') is not null then
    select id into v_customer_id
    from public.customers
    where organization_id = p_organization_id
      and phone = trim(p_customer_phone)
    limit 1;

    if found then
      update public.customers
      set full_name = trim(p_guest_name),
          preferred_seating = p_seating_preference,
          total_reservations = total_reservations + 1,
          updated_at = now()
      where id = v_customer_id;
    else
      insert into public.customers (
        organization_id,
        full_name,
        phone,
        preferred_seating,
        total_reservations
      ) values (
        p_organization_id,
        trim(p_guest_name),
        trim(p_customer_phone),
        p_seating_preference,
        1
      )
      returning id into v_customer_id;
    end if;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_confirmation_code := 'LUM-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
    exit when not exists (
      select 1 from public.reservations where confirmation_code = v_confirmation_code
    );
    if v_attempt > 10 then
      raise exception 'Could not generate a unique confirmation code';
    end if;
  end loop;

  insert into public.reservations (
    location_id,
    customer_id,
    guest_name,
    customer_phone,
    reservation_date,
    reservation_time,
    duration_minutes,
    party_size,
    seating_preference,
    assigned_table_id,
    occasion,
    dietary_requirements,
    special_requests,
    booking_source,
    reservation_status,
    confirmation_code,
    vapi_call_id
  ) values (
    p_location_id,
    v_customer_id,
    trim(p_guest_name),
    nullif(trim(coalesce(p_customer_phone, '')), ''),
    p_reservation_date,
    p_reservation_time,
    v_duration,
    p_party_size,
    p_seating_preference,
    v_table.id,
    nullif(trim(coalesce(p_occasion, '')), ''),
    nullif(trim(coalesce(p_dietary_requirements, '')), ''),
    nullif(trim(coalesce(p_special_requests, '')), ''),
    'ai_voice',
    'confirmed',
    v_confirmation_code,
    nullif(trim(coalesce(p_vapi_call_id, '')), '')
  )
  returning id into v_reservation_id;

  return jsonb_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'confirmation_code', v_confirmation_code,
    'assigned_table', v_table.table_code,
    'seating_area', v_table.area
  );
end;
$$;

revoke all on function public.create_lumiere_reservation(
  uuid, uuid, text, text, date, time, integer, text, text, text, text, text
) from public;

grant execute on function public.create_lumiere_reservation(
  uuid, uuid, text, text, date, time, integer, text, text, text, text, text
) to service_role;

-- Helpful dashboard indexes.
create index if not exists reservations_vapi_call_id_idx
on public.reservations(vapi_call_id)
where vapi_call_id is not null;

create index if not exists reservations_date_status_idx
on public.reservations(location_id, reservation_date, reservation_status);

-- Verify installation.
select
  'Phase 2 installed successfully' as result,
  proname as function_name
from pg_proc
where proname = 'create_lumiere_reservation';
