-- =====================================================
-- LUMIÈRE AI RESERVATION SYSTEM — COMPLETE SCHEMA SETUP
-- Run this script in Supabase SQL Editor:
-- (Supabase Dashboard -> SQL Editor -> New Query -> Run)
-- =====================================================

-- 1. Enable pgcrypto for UUID & random bytes generation
create extension if not exists "pgcrypto";

-- 2. Organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- 3. Restaurant Locations
create table if not exists public.restaurant_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  timezone text not null default 'Asia/Dubai',
  default_reservation_duration integer not null default 120,
  booking_interval_minutes integer not null default 15,
  max_online_party_size integer not null default 8,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- 4. Business Hours (day_of_week: 0=Sunday, 1=Monday ... 6=Saturday)
create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.restaurant_locations(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  open_time time not null,
  close_time time not null,
  is_closed boolean not null default false,
  unique (location_id, day_of_week)
);

-- 5. Restaurant Tables
create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.restaurant_locations(id) on delete cascade,
  table_code text not null,
  area text not null check (area in ('indoor', 'terrace')),
  capacity integer not null,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- 6. Customers
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  phone text,
  preferred_seating text,
  total_reservations integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 7. Reservations
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.restaurant_locations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  guest_name text not null,
  customer_phone text,
  reservation_date date not null,
  reservation_time time not null,
  duration_minutes integer not null default 120,
  party_size integer not null,
  seating_preference text not null default 'no_preference',
  assigned_table_id uuid references public.restaurant_tables(id) on delete set null,
  occasion text,
  dietary_requirements text,
  special_requests text,
  booking_source text not null default 'ai_voice',
  reservation_status text not null default 'confirmed',
  confirmation_code text not null unique,
  vapi_call_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 8. AI Calls (Logged by Vapi events)
create table if not exists public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.restaurant_locations(id) on delete set null,
  reservation_id uuid references public.reservations(id) on delete set null,
  vapi_call_id text not null unique,
  caller_phone text,
  call_status text not null default 'completed',
  call_outcome text,
  duration_seconds integer,
  transcript text,
  ai_summary text,
  customer_sentiment text,
  recording_url text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists reservations_vapi_call_id_idx on public.reservations(vapi_call_id);
create index if not exists reservations_date_status_idx on public.reservations(location_id, reservation_date, reservation_status);
create index if not exists ai_calls_org_idx on public.ai_calls(organization_id, created_at desc);

-- 9. Seed Default Organization & Location (Matches .env demo IDs)
insert into public.organizations (id, name)
values ('11111111-1111-1111-1111-111111111111', 'Lumière Hospitality')
on conflict (id) do nothing;

insert into public.restaurant_locations (
  id, organization_id, name, timezone, default_reservation_duration, booking_interval_minutes, max_online_party_size, is_active
)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Lumière Dubai Downtown',
  'Asia/Dubai',
  120,
  15,
  8,
  true
)
on conflict (id) do nothing;

-- 10. Seed Business Hours (Daily 12:00 PM to 11:30 PM)
insert into public.business_hours (location_id, day_of_week, open_time, close_time, is_closed)
values
  ('22222222-2222-2222-2222-222222222222', 0, '12:00:00', '23:30:00', false),
  ('22222222-2222-2222-2222-222222222222', 1, '12:00:00', '23:30:00', false),
  ('22222222-2222-2222-2222-222222222222', 2, '12:00:00', '23:30:00', false),
  ('22222222-2222-2222-2222-222222222222', 3, '12:00:00', '23:30:00', false),
  ('22222222-2222-2222-2222-222222222222', 4, '12:00:00', '23:30:00', false),
  ('22222222-2222-2222-2222-222222222222', 5, '12:00:00', '23:30:00', false),
  ('22222222-2222-2222-2222-222222222222', 6, '12:00:00', '23:30:00', false)
on conflict (location_id, day_of_week) do nothing;

-- 11. Seed Tables (Indoor & Terrace)
insert into public.restaurant_tables (location_id, table_code, area, capacity, is_active)
values
  ('22222222-2222-2222-2222-222222222222', 'IN-01', 'indoor', 2, true),
  ('22222222-2222-2222-2222-222222222222', 'IN-02', 'indoor', 2, true),
  ('22222222-2222-2222-2222-222222222222', 'IN-03', 'indoor', 4, true),
  ('22222222-2222-2222-2222-222222222222', 'IN-04', 'indoor', 4, true),
  ('22222222-2222-2222-2222-222222222222', 'IN-05', 'indoor', 6, true),
  ('22222222-2222-2222-2222-222222222222', 'IN-06', 'indoor', 8, true),
  ('22222222-2222-2222-2222-222222222222', 'TR-01', 'terrace', 2, true),
  ('22222222-2222-2222-2222-222222222222', 'TR-02', 'terrace', 4, true),
  ('22222222-2222-2222-2222-222222222222', 'TR-03', 'terrace', 4, true),
  ('22222222-2222-2222-2222-222222222222', 'TR-04', 'terrace', 6, true)
on conflict do nothing;

-- 12. Stored Procedure for Atomic Reservation Creation
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
