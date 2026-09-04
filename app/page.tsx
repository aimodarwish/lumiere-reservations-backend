export default function Home() {
  return (
    <main className="public-home">
      <section className="public-card">
        <div className="eyebrow">Lumière Dubai</div>
        <h1>AI reservations, beautifully handled.</h1>
        <p>
          Claire answers every call, checks live availability, confirms the booking, and updates the restaurant dashboard automatically.
        </p>
        <div className="status"><span className="dot"/><strong>Reservation system online</strong></div>
        <div className="public-actions">
          <a href="/dashboard">Open dashboard</a>
          <a className="secondary" href="/api/health">API health</a>
        </div>
      </section>
    </main>
  );
}
