# 🌟 Lumière Autonomous AI Voice Reservation & Orchestration Engine

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Voice AI](https://img.shields.io/badge/Voice%20AI-Real--Time%20Telephony-6366F1)](https://github.com/aimodarwish/lumiere-reservations-backend)
[![Vercel](https://img.shields.io/badge/Vercel-Production%20Deployment-000000?logo=vercel&logoColor=white)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](https://opensource.org/licenses/MIT)

> **Architected & Engineered by [Mohamad Darwish](https://github.com/aimodarwish)**  
> *Full-Stack Voice AI & Real-Time Distributed Cloud Systems Engineer*

---

## 🚀 Live Interactive Demonstrations

| Target | URL / Details |
| :--- | :--- |
| **🌐 Production Dashboard Showcase** | [https://lumiere-reservations-backend.vercel.app/](https://lumiere-reservations-backend.vercel.app/) |
| **📞 Live Voice AI Phone Line** | **`+1 (443) 637 9042`** *(Call 24/7 to speak with AI Hostess Claire)* |
| **⚡ Live Webhook Endpoint** | `https://lumiere-reservations-backend.vercel.app/api/vapi/events` |
| **📦 GitHub Repository** | [https://github.com/aimodarwish/lumiere-reservations-backend](https://github.com/aimodarwish/lumiere-reservations-backend) |

---

## 🏛️ Executive Summary

**Lumière AI Reservation System** is an enterprise-grade, real-time autonomous voice reservation platform designed for luxury hospitality. Powered by **Autonomous Real-Time Voice AI**, **Next.js 16 (Turbopack)**, and **Supabase (PostgreSQL with custom atomic stored procedures)**, the system manages inbound phone inquiries, verifies dining capacity, executes zero-conflict atomic table allocation, and streams live conversation telemetry, transcripts, and audio recordings directly into an executive dashboard in real-time.

```
                                  ┌─────────────────────────────────────────┐
                                  │           INBOUND TELEPHONE CALL        │
                                  │            +1 (443) 637 9042            │
                                  └────────────────────┬────────────────────┘
                                                       │
                                                       ▼
                                  ┌─────────────────────────────────────────┐
                                  │          REAL-TIME VOICE AI             │
                                  │         Real-Time Hostess (Claire)      │
                                  └───────┬─────────────────────────┬───────┘
                                          │                         │
                   Tool Call: Availability│                         │Webhook: End of Call
                   Tool Call: Reservation │                         │(Transcript, Audio, Sentiment)
                                          ▼                         ▼
             ┌────────────────────────────────────────────────────────────────────────┐
             │                      NEXT.JS 16 SERVERLESS ENGINE                      │
             │           Route Handlers · Zod Validation · Webhook Security          │
             └────────────────────────────────────┬───────────────────────────────────┘
                                                  │
                                                  ▼
             ┌────────────────────────────────────────────────────────────────────────┐
             │                     SUPABASE POSTGRESQL DATABASE                       │
             │  • Atomic Advisory Locking (`pg_advisory_xact_lock`)                   │
             │  • Concurrency-Safe Stored Procedure (`create_lumiere_reservation`)   │
             │  • Automatic Customer Profile CRM Tracking                             │
             └────────────────────────────────────┬───────────────────────────────────┘
                                                  │
                                                  ▼
             ┌────────────────────────────────────────────────────────────────────────┐
             │                    REAL-TIME EXECUTIVE DASHBOARD                       │
             │     Live Reservations · Table Capacity · Audio Player · Transcripts    │
             └────────────────────────────────────────────────────────────────────────┘
```

---

## 💎 Key Engineering Highlights

### 1. Zero-Conflict Concurrency Architecture
High-demand restaurants frequently face race conditions when multiple callers or online systems request the same table simultaneously. Lumière solves this at the database engine level:
- **Transactional Advisory Locks**: Uses `pg_advisory_xact_lock(hashtextextended(location_id || ':' || reservation_date, 0))` to serialize reservation attempts for the requested dining window without locking the whole database.
- **Atomic Execution**: All operations—table selection, capacity validation, customer profile upsert, and reservation creation—execute within a single atomic PostgreSQL transaction. If any condition fails, the entire transaction is rolled back cleanly.

### 2. Sub-500ms Conversational Voice Latency
- Low-latency tool-call orchestration built on Next.js 16 Edge & Serverless route handlers.
- Instant tool response schemas return structured conversational directives for the AI voice hostess to respond naturally without awkward pauses.

### 3. Automatic Customer Intelligence & CRM
- Automatically identifies repeat callers via normalized phone number indexing (`E.164`).
- Increments guest loyalty counters (`total_reservations`), saves seating preferences, and tracks guest history.

### 4. Telemetry & Media Pipeline
- Captures end-of-call webhooks containing complete transcripts, AI summaries, customer sentiment classification, and Cloudflare R2 audio recording URLs.
- Decoupled duration parsing with fallback math between timestamp boundaries.

### 5. Luxury Dashboard Experience
- Built with a tailored **Dark Obsidian & Champagne Gold** aesthetic.
- Zero-friction public recruitment showcase mode: allows hiring teams and stakeholders to review live data, play audio recordings, inspect transcripts, and monitor table capacity without login roadblocks.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack, Serverless API Routes)
- **Language**: [TypeScript 5.9](https://www.typescriptlang.org/) (Strict mode, zero `any` policy for business entities)
- **Database & Storage**: [Supabase](https://supabase.com/) (PostgreSQL 15+, PL/pgSQL Stored Procedures, RLS)
- **Voice AI Telephony Engine**: Real-time WebRTC/SIP low-latency conversational pipeline with function calling
- **Schema Validation**: [Zod](https://zod.dev/) (Runtime validation of incoming LLM tool calls)
- **Styling**: Vanilla Custom CSS Design Tokens (Responsive, Glassmorphism, CSS Grid)
- **Hosting & CI/CD**: [Vercel](https://vercel.com/)

---

## 📋 API Architecture & Endpoints

### 1. Check Table Availability
```http
POST /api/vapi/check-availability
Header: x-vapi-secret: <VAPI_WEBHOOK_SECRET>
```
**Payload:**
```json
{
  "message": {
    "toolCallList": [{
      "id": "call-avail-1",
      "name": "check_availability",
      "arguments": {
        "reservation_date": "2026-09-05",
        "preferred_time": "19:00",
        "party_size": 2,
        "seating_preference": "indoor"
      }
    }]
  }
}
```
**Response:**
```json
{
  "results": [{
    "toolCallId": "call-avail-1",
    "result": "The requested reservation is available at 19:00 for 2 guests in the indoor dining area. You may continue collecting the guest details..."
  }]
}
```

---

### 2. Create Confirmed Reservation
```http
POST /api/vapi/create-reservation
Header: x-vapi-secret: <VAPI_WEBHOOK_SECRET>
```
**Payload:**
```json
{
  "message": {
    "toolCallList": [{
      "id": "call-res-1",
      "name": "create_reservation",
      "arguments": {
        "guest_name": "Mohamad Darwish",
        "reservation_date": "2026-09-05",
        "reservation_time": "19:00",
        "party_size": 2,
        "seating_preference": "indoor",
        "occasion": "Anniversary",
        "dietary_requirements": "None",
        "special_requests": "Window table"
      }
    }]
  }
}
```
**Response:**
```json
{
  "results": [{
    "toolCallId": "call-res-1",
    "result": "Reservation created successfully. The confirmation reference is LUM-6E4BF6. The assigned dining area is indoor..."
  }]
}
```

---

### 3. Telemetry & Call Ingestion Webhook
```http
POST /api/vapi/events
Header: x-vapi-secret: <VAPI_WEBHOOK_SECRET>
```
Ingests `end-of-call-report` payloads containing transcripts, durations, recording links, and customer sentiment, associating them with the reservation reference.

---

## 🗄️ Database Schema & Data Model

The system utilizes 7 relational tables in PostgreSQL:

1. **`organizations`**: Multi-tenant isolation hierarchy.
2. **`restaurant_locations`**: Operating entities with customizable timezones, default dining durations, and booking intervals.
3. **`business_hours`**: Daily open/close schedules and holiday closures.
4. **`restaurant_tables`**: Real-time floor plan modeling with capacity limits and spatial categories (`indoor`, `terrace`).
5. **`customers`**: Guest profile registry with aggregate reservation metrics and historical preferences.
6. **`reservations`**: Central booking ledger with deterministic status tracking (`pending`, `confirmed`, `seated`, `cancelled`, `completed`).
7. **`ai_calls`**: Voice telemetry logs with full transcripts, AI analysis, audio recordings, and sentiment scoring.

---

## 💻 Local Setup & Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/aimodarwish/lumiere-reservations-backend.git
cd lumiere-reservations-backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env.local` file based on `.env.example`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-supabase-service-role-key
LUMIERE_ORGANIZATION_ID=11111111-1111-1111-1111-111111111111
LUMIERE_LOCATION_ID=22222222-2222-2222-2222-222222222222
VAPI_WEBHOOK_SECRET=your-webhook-secret
DASHBOARD_PASSWORD=your-dashboard-password
```

### 4. Apply Database Migrations
Execute [`sql/full-schema-setup.sql`](./sql/full-schema-setup.sql) in your Supabase SQL Editor to provision tables, indexes, demo seed data, and the atomic stored procedure.

### 5. Launch the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the live dashboard.

---

## 👤 Author & System Architect

**Mohamad Darwish**  
- **GitHub:** [@aimodarwish](https://github.com/aimodarwish)  
- **Role:** Full-Stack Voice AI & Real-Time Cloud Architect  
- **Specialization:** Real-Time Voice Agents, Next.js, PostgreSQL Concurrency Control, Serverless Orchestration.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE) file for details.
