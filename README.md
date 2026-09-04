# Lumière AI Reservation System

A complete Vapi + Supabase + Next.js reservation system for Lumière Dubai.

## Included

- Live table availability tool for Vapi
- Atomic reservation creation tool
- Automatic guest/customer storage
- Confirmation-code generation
- Vapi end-of-call webhook storage
- Luxury dashboard with overview, reservations, AI calls, transcripts, recordings, and table capacity
- Password-protected dashboard
- Reservation status management

## Required setup

### 1. Run the Phase 2 SQL migration

Open Supabase → SQL Editor → New query, paste `sql/phase-2-migration.sql`, then Run.

Expected result:

- `Phase 2 installed successfully`
- `create_lumiere_reservation`

### 2. Add environment variables in Vercel

Copy every variable from `.env.example` into Vercel → Project → Settings → Environment Variables.

Required:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `LUMIERE_ORGANIZATION_ID`
- `LUMIERE_LOCATION_ID`
- `VAPI_WEBHOOK_SECRET`
- `DASHBOARD_PASSWORD`

Then redeploy.

### 3. Vapi tool URLs

Availability:

`https://YOUR_DOMAIN/api/vapi/check-availability`

Create reservation:

`https://YOUR_DOMAIN/api/vapi/create-reservation`

For both tools add the header:

- Name: `x-vapi-secret`
- Value: the exact value of `VAPI_WEBHOOK_SECRET`

### 4. Vapi event webhook

Set the Assistant Server URL to:

`https://YOUR_DOMAIN/api/vapi/events`

Use the same `x-vapi-secret` credential and enable at least:

- `end-of-call-report`

### 5. Dashboard

Open:

`https://YOUR_DOMAIN/dashboard`

Sign in with `DASHBOARD_PASSWORD`.

## Test the create reservation endpoint

```bash
curl -X POST "https://YOUR_DOMAIN/api/vapi/create-reservation" \
-H "Content-Type: application/json" \
-H "x-vapi-secret: YOUR_SECRET" \
-d '{
  "message": {
    "toolCallList": [
      {
        "id": "test-create-001",
        "name": "create_reservation",
        "arguments": {
          "guest_name": "Mohamad Darwish",
          "reservation_date": "2026-07-13",
          "reservation_time": "20:30",
          "party_size": 4,
          "seating_preference": "terrace",
          "occasion": "Anniversary",
          "dietary_requirements": "One vegetarian guest",
          "special_requests": ""
        }
      }
    ]
  }
}'
```

## Security notes

- Never expose `SUPABASE_SECRET_KEY` in browser code.
- Rotate any secret pasted into chat or screenshots.
- The dashboard uses an HttpOnly cookie derived from `DASHBOARD_PASSWORD` and `VAPI_WEBHOOK_SECRET`.
- For a production multi-tenant SaaS, replace the single shared password with Supabase Auth and organization-scoped RLS policies.

## Dashboard v2 update

This build also includes:

- Decimal Vapi call durations are rounded before being saved to the integer `duration_seconds` column.
- Overview cards for Reservations today, Upcoming reservations, Expected guests today, and AI calls today.
- Reservation timeline filters for Today, Tomorrow, and Next 7 days.
- The full Reservations page continues to display all loaded reservations, including future dates.
