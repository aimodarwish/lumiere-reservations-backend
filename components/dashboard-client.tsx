"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Reservation = {
  id: string;
  guest_name: string;
  customer_phone: string | null;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  seating_preference: "indoor" | "terrace" | "no_preference";
  occasion: string | null;
  dietary_requirements: string | null;
  special_requests: string | null;
  booking_source: string;
  reservation_status: string;
  confirmation_code: string;
  created_at: string;
  restaurant_tables: { table_code: string; area: string } | { table_code: string; area: string }[] | null;
};

type Call = {
  id: string;
  vapi_call_id: string | null;
  caller_phone: string | null;
  call_status: string | null;
  call_outcome: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  ai_summary: string | null;
  customer_sentiment: string | null;
  recording_url: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  reservation_id: string | null;
};

type RestaurantTable = {
  id: string;
  table_code: string;
  area: "indoor" | "terrace";
  capacity: number;
  is_active: boolean;
};

type Snapshot = {
  generatedAt: string;
  today: string;
  stats: {
    reservationsToday: number;
    upcomingReservations: number;
    expectedGuestsToday: number;
    callsToday: number;
  };
  reservations: Reservation[];
  calls: Call[];
  tables: RestaurantTable[];
};

type Tab = "overview" | "reservations" | "calls" | "tables";
type TimelineRange = "today" | "tomorrow" | "next7";

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    reservations: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="m8 15 2 2 5-5"/></>,
    calls: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.62a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.28-1.28a2 2 0 0 1 2.11-.45c.84.29 1.72.5 2.62.62A2 2 0 0 1 22 16.92z"/></>,
    tables: <><path d="M4 10h16M6 10v9M18 10v9M8 5h8a2 2 0 0 1 2 2v3H6V7a2 2 0 0 1 2-2z"/></>,
    refresh: <><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/></>,
    search: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>,
    spark: <><path d="m12 3-1.8 4.8L5 10l5.2 2.2L12 17l1.8-4.8L19 10l-5.2-2.2L12 3z"/><path d="m5 3-.7 1.8L2.5 5.5l1.8.7L5 8l.7-1.8 1.8-.7-1.8-.7L5 3z"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(
    new Date(2026, 0, 1, hour, minute),
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${value}T12:00:00Z`),
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(
    new Date(`${value}T12:00:00Z`),
  );
}

function addDays(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}m ${String(sec).padStart(2, "0")}s`;
}

function tableInfo(value: Reservation["restaurant_tables"]) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${status}`}>{status.replace("_", " ")}</span>;
}

function StatCard({ label, value, meta, icon }: { label: string; value: string | number; meta: string; icon: string }) {
  return (
    <article className="stat-card">
      <div className="stat-head"><span>{label}</span><div className="stat-icon"><Icon name={icon}/></div></div>
      <strong>{value}</strong>
      <small>{meta}</small>
    </article>
  );
}

export default function DashboardClient() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [timelineRange, setTimelineRange] = useState<TimelineRange>("today");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/dashboard/data", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Unable to load dashboard.");
      } else {
        setSnapshot(payload.data);
        setError("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect to live dashboard.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(() => load(true), 4000);
    return () => window.clearInterval(interval);
  }, [load]);

  const filteredReservations = useMemo(() => {
    const rows = snapshot?.reservations ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => [row.guest_name, row.customer_phone, row.confirmation_code, row.occasion]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term)));
  }, [search, snapshot]);

  async function changeStatus(id: string, status: string) {
    const response = await fetch("/api/dashboard/reservation-status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (response.ok) await load(true);
  }

  const timelineRows = useMemo(() => {
    if (!snapshot) return [];

    const activeStatuses = new Set(["pending", "confirmed", "seated"]);
    const tomorrow = addDays(snapshot.today, 1);
    const nextSevenDaysEnd = addDays(snapshot.today, 6);

    return snapshot.reservations.filter((row) => {
      if (!activeStatuses.has(row.reservation_status)) return false;

      if (timelineRange === "today") {
        return row.reservation_date === snapshot.today;
      }

      if (timelineRange === "tomorrow") {
        return row.reservation_date === tomorrow;
      }

      return row.reservation_date >= snapshot.today && row.reservation_date <= nextSevenDaysEnd;
    });
  }, [snapshot, timelineRange]);

  const latestRows = [...(snapshot?.reservations ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);
  const latestCalls = snapshot?.calls.slice(0, 5) ?? [];

  const timelineEmptyMessage =
    timelineRange === "today"
      ? "No active reservations for today yet."
      : timelineRange === "tomorrow"
        ? "No active reservations for tomorrow yet."
        : "No active reservations in the next seven days yet.";

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark small">L</div>
          <div><strong>Lumière</strong><span>AI Reservations</span></div>
        </div>

        <div className="sidebar-developer">
          <div className="dev-avatar">MD</div>
          <div>
            <span className="dev-label">System Engineer</span>
            <strong className="dev-name">Mohamad Darwish</strong>
            <span className="dev-sub">Voice AI & Real-Time Cloud</span>
          </div>
        </div>

        <nav>
          {([
            ["overview", "Overview"],
            ["reservations", "Reservations"],
            ["calls", "AI Calls"],
            ["tables", "Tables & Capacity"],
          ] as [Tab, string][]).map(([key, label]) => (
            <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
              <Icon name={key}/><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="agent-card">
          <div className="agent-pulse"><span/></div>
          <div><strong>Claire is online</strong><span>Accepting phone reservations</span></div>
        </div>
        <div className="sidebar-contact-pill">
          <span style={{ fontSize: "11px", color: "var(--gold)", fontWeight: 700, display: "block", marginBottom: "3px" }}>📞 Live Test Line</span>
          <a href="tel:+14436379042" style={{ color: "#fff", textDecoration: "none", fontSize: "12px", fontWeight: 750, fontFamily: "monospace" }}>+1 (443) 637 9042</a>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="topbar">
          <div>
            <span className="page-kicker">Lumière Dubai · Production System</span>
            <h1>{tab === "overview" ? "Lumière AI Command Center" : tab === "calls" ? "AI call intelligence" : tab === "tables" ? "Dining room capacity" : "Reservations"}</h1>
            <p>{tab === "overview" ? "Autonomous voice concierge handling reservations with atomic table allocation in real time." : "Live operational data from your AI reservation system."}</p>
          </div>
          <div className="topbar-actions">
            <a href="tel:+14436379042" className="topbar-call-pill" title="Click to call live AI assistant">
              <span className="call-pulse"></span>
              <span><strong>Call AI:</strong> +1 (443) 637 9042</span>
            </a>
            <div className="live-pill"><span/>Live Sync</div>
            <button className="icon-button" onClick={() => load()} aria-label="Refresh"><Icon name="refresh"/></button>
          </div>
        </header>

        {/* Featured Showcase & Live Call Testing Banner */}
        <section className="showcase-banner">
          <div className="showcase-main">
            <div className="showcase-tags">
              <span className="showcase-badge">
                <span className="pulse-dot"></span>
                Live Interactive System
              </span>
              <span className="engineer-pill">
                <span className="crown-icon">★</span>
                تمت برمجة وهندسة النظام بواسطة: <strong>Mohamad Darwish</strong>
              </span>
            </div>
            
            <h2 className="showcase-title">
              Autonomous Voice AI Reservation & Table Orchestration
            </h2>
            <p className="showcase-desc">
              نظام متكامل لمعالجة الحجوزات الهاتفية ذاتياً عبر الذكاء الاصطناعي الصوتي، مرتبط بقاعدة بيانات Supabase بدوال تخزينية لمنع التضارب، وتحديث فوري للمكالمات والتسجيلات والتفريغ الصوتي على لوحة التحكم.
            </p>

            <div className="showcase-meta">
              <div className="meta-item">
                <span className="meta-label">Lead Engineer</span>
                <strong className="meta-val">Mohamad Darwish</strong>
              </div>
              <div className="meta-divider"></div>
              <div className="meta-item">
                <span className="meta-label">Voice Agent</span>
                <strong className="meta-val">Claire (Vapi Real-Time Voice)</strong>
              </div>
              <div className="meta-divider"></div>
              <div className="meta-item">
                <span className="meta-label">Architecture</span>
                <strong className="meta-val">Next.js + Supabase + Vapi</strong>
              </div>
              <div className="meta-divider"></div>
              <div className="meta-item">
                <span className="meta-label">Concurrency</span>
                <strong className="meta-val">PostgreSQL Advisory Locks</strong>
              </div>
            </div>
          </div>

          <div className="call-tester-card">
            <div className="call-tester-header">
              <div className="phone-beacon">
                <span className="beacon-ring"></span>
                <span className="beacon-core">📞</span>
              </div>
              <div>
                <span className="call-kicker">Live Interactive Demo</span>
                <h3 className="call-title">يمكنك الاتصال لتجربة النظام مباشرة</h3>
              </div>
            </div>

            <a href="tel:+14436379042" className="call-number-btn" title="Call directly">
              <span className="call-btn-icon">📞</span>
              <span className="call-btn-num">+1 (443) 637 9042</span>
              <span className="call-btn-badge">Tap to Call</span>
            </a>

            <div className="call-instruction">
              <span className="bullet">●</span>
              <span>اتصل الآن واطلب حجز طاولة لأي موعد؛ ستقوم Claire بالتحقق وتثبيت الحجز وعرضه على هذه الشاشة فوراً مع تسجيل المكالمة.</span>
            </div>

            <button 
              type="button"
              className="copy-number-btn"
              onClick={() => {
                navigator.clipboard.writeText("+14436379042");
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              }}
            >
              {copied ? "✓ تم نسخ الرقم بنجاح!" : "📋 نسخ الرقم (+1 443 637 9042)"}
            </button>
          </div>
        </section>

        {error ? <div className="dashboard-error">{error}</div> : null}
        {loading && !snapshot ? <div className="loading-state">Loading Lumière dashboard…</div> : null}

        {snapshot && tab === "overview" ? (
          <>
            <section className="stats-grid">
              <StatCard label="Reservations today" value={snapshot.stats.reservationsToday} meta="Confirmed and active" icon="reservations"/>
              <StatCard label="Upcoming reservations" value={snapshot.stats.upcomingReservations} meta="Tomorrow and beyond" icon="spark"/>
              <StatCard label="Expected guests today" value={snapshot.stats.expectedGuestsToday} meta="Total covers today" icon="overview"/>
              <StatCard label="AI calls today" value={snapshot.stats.callsToday} meta="Handled by Claire" icon="calls"/>
            </section>

            <section className="content-grid">
              <article className="panel panel-wide">
                <div className="panel-head timeline-panel-head">
                  <div><span className="panel-kicker">Schedule</span><h2>Reservation timeline</h2></div>
                  <div className="panel-head-actions">
                    <div className="timeline-tabs" role="tablist" aria-label="Reservation timeline range">
                      {([
                        ["today", "Today"],
                        ["tomorrow", "Tomorrow"],
                        ["next7", "Next 7 days"],
                      ] as [TimelineRange, string][]).map(([range, label]) => (
                        <button
                          key={range}
                          type="button"
                          role="tab"
                          aria-selected={timelineRange === range}
                          className={timelineRange === range ? "active" : ""}
                          onClick={() => setTimelineRange(range)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <button className="view-all-button" onClick={() => setTab("reservations")}>View all</button>
                  </div>
                </div>
                <div className="timeline-list">
                  {timelineRows.length ? timelineRows.map((row) => {
                    const table = tableInfo(row.restaurant_tables);
                    const showDate = timelineRange === "next7";
                    return <div className="timeline-row" key={row.id}>
                      <div className="time-block">
                        <strong>{showDate ? formatShortDate(row.reservation_date) : formatTime(row.reservation_time)}</strong>
                        <span>{showDate ? `${formatTime(row.reservation_time)} · ${row.party_size} guests` : `${row.party_size} guests`}</span>
                      </div>
                      <div className="guest-avatar">{row.guest_name.charAt(0)}</div>
                      <div className="guest-main"><strong>{row.guest_name}</strong><span>{row.occasion || "Dining reservation"} · {row.seating_preference.replace("_", " ")}</span></div>
                      <div className="table-pill">{table?.table_code ?? "Unassigned"}</div>
                      <StatusBadge status={row.reservation_status}/>
                    </div>;
                  }) : <div className="empty-state">{timelineEmptyMessage}</div>}
                </div>
              </article>

              <article className="panel activity-panel">
                <div className="panel-head"><div><span className="panel-kicker">Live feed</span><h2>AI activity</h2></div></div>
                <div className="activity-list">
                  {latestRows.slice(0, 4).map((row) => <div className="activity-item" key={row.id}>
                    <div className="activity-icon"><Icon name="spark"/></div>
                    <div><strong>Reservation confirmed</strong><span>{row.guest_name} · {row.party_size} guests</span><small>{new Date(row.created_at).toLocaleTimeString([], {hour:"numeric", minute:"2-digit"})}</small></div>
                  </div>)}
                  {latestCalls.slice(0, 2).map((call) => <div className="activity-item" key={call.id}>
                    <div className="activity-icon"><Icon name="calls"/></div>
                    <div><strong>AI call completed</strong><span>{call.ai_summary || call.caller_phone || "Guest conversation"}</span><small>{formatDuration(call.duration_seconds)}</small></div>
                  </div>)}
                  {!latestRows.length && !latestCalls.length ? <div className="empty-state">New activity will appear here automatically.</div> : null}
                </div>
              </article>
            </section>
          </>
        ) : null}

        {snapshot && tab === "reservations" ? (
          <section className="panel table-panel">
            <div className="panel-head table-toolbar">
              <div><span className="panel-kicker">Guest book</span><h2>All reservations</h2></div>
              <div className="search-box"><Icon name="search"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search guest, phone, code…"/></div>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Guest</th><th>Date & time</th><th>Party</th><th>Area / table</th><th>Details</th><th>Status</th></tr></thead>
                <tbody>
                  {filteredReservations.map((row) => {
                    const table = tableInfo(row.restaurant_tables);
                    return <tr key={row.id}>
                      <td><div className="table-person"><div className="guest-avatar mini">{row.guest_name.charAt(0)}</div><div><strong>{row.guest_name}</strong><span>{row.customer_phone || row.confirmation_code}</span></div></div></td>
                      <td><strong>{formatDate(row.reservation_date)}</strong><span>{formatTime(row.reservation_time)}</span></td>
                      <td><strong>{row.party_size}</strong><span>guests</span></td>
                      <td><strong className="capitalize">{row.seating_preference.replace("_", " ")}</strong><span>{table?.table_code ?? "Unassigned"}</span></td>
                      <td><strong>{row.occasion || "Standard dining"}</strong><span>{row.dietary_requirements || row.special_requests || "No special notes"}</span></td>
                      <td><select className={`status-select status-${row.reservation_status}`} value={row.reservation_status} onChange={(event) => changeStatus(row.id, event.target.value)}>
                        {['pending','confirmed','seated','completed','cancelled','no_show'].map((status) => <option key={status} value={status}>{status.replace('_',' ')}</option>)}
                      </select></td>
                    </tr>;
                  })}
                </tbody>
              </table>
              {!filteredReservations.length ? <div className="empty-state">No reservations match your search.</div> : null}
            </div>
          </section>
        ) : null}

        {snapshot && tab === "calls" ? (
          <section className="calls-layout">
            <article className="panel calls-list-panel">
              <div className="panel-head"><div><span className="panel-kicker">Conversation history</span><h2>Recent AI calls</h2></div></div>
              <div className="call-list">
                {snapshot.calls.map((call) => <button key={call.id} className={`call-row ${selectedCall?.id === call.id ? "selected" : ""}`} onClick={() => setSelectedCall(call)}>
                  <div className="activity-icon"><Icon name="calls"/></div>
                  <div><strong>{call.caller_phone || "Web caller"}</strong><span>{call.ai_summary || call.call_outcome || "AI reservation conversation"}</span><small>{formatDuration(call.duration_seconds)} · {new Date(call.created_at).toLocaleString()}</small></div>
                  <StatusBadge status={call.reservation_id ? "confirmed" : (call.call_status || "completed")}/>
                </button>)}
                {!snapshot.calls.length ? <div className="empty-state">End-of-call reports will appear here after you connect the Vapi webhook.</div> : null}
              </div>
            </article>
            <article className="panel call-detail-panel">
              {selectedCall ? <>
                <div className="call-detail-top"><div><span className="panel-kicker">Call intelligence</span><h2>{selectedCall.caller_phone || "Web caller"}</h2></div><StatusBadge status={selectedCall.reservation_id ? "confirmed" : "completed"}/></div>
                <div className="call-metrics"><div><span>Duration</span><strong>{formatDuration(selectedCall.duration_seconds)}</strong></div><div><span>Sentiment</span><strong>{selectedCall.customer_sentiment || "Not analyzed"}</strong></div><div><span>Outcome</span><strong>{selectedCall.call_outcome || "Completed"}</strong></div></div>
                {selectedCall.recording_url ? <audio controls src={selectedCall.recording_url} className="audio-player"/> : null}
                <div className="detail-section"><h3>AI summary</h3><p>{selectedCall.ai_summary || "No summary was returned by Vapi for this call."}</p></div>
                <div className="detail-section"><h3>Transcript</h3><div className="transcript-box">{selectedCall.transcript || "No transcript available yet."}</div></div>
              </> : <div className="empty-detail"><div className="activity-icon large"><Icon name="calls"/></div><h2>Select a call</h2><p>Open a conversation to review its summary, transcript, recording, sentiment, and booking outcome.</p></div>}
            </article>
          </section>
        ) : null}

        {snapshot && tab === "tables" ? (
          <section className="panel table-map-panel">
            <div className="panel-head"><div><span className="panel-kicker">Floor capacity</span><h2>Restaurant tables</h2></div><div className="capacity-summary">{snapshot.tables.reduce((sum, row) => sum + row.capacity, 0)} total seats</div></div>
            {(["terrace", "indoor"] as const).map((area) => <div className="area-section" key={area}>
              <div className="area-head"><h3>{area === "terrace" ? "Terrace dining" : "Indoor dining"}</h3><span>{snapshot.tables.filter((row) => row.area === area).length} tables</span></div>
              <div className="table-map">
                {snapshot.tables.filter((row) => row.area === area).map((row) => <article className="restaurant-table-card" key={row.id}>
                  <div className="table-visual"><span>{row.table_code}</span></div>
                  <div><strong>{row.table_code}</strong><span>Up to {row.capacity} guests</span></div>
                  <i className={row.is_active ? "active" : ""}/>
                </article>)}
              </div>
            </div>)}
          </section>
        ) : null}
      </main>
    </div>
  );
}
