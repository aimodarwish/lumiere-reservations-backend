"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setError(data.error ?? "Unable to sign in.");
      setLoading(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">L</div>
        <div className="eyebrow">Lumière Dubai</div>
        <h1>Welcome back</h1>
        <p>Sign in to manage AI reservations, guest activity, and calls.</p>
        <form onSubmit={submit} className="login-form">
          <label htmlFor="password">Dashboard password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
          {error ? <div className="form-error">{error}</div> : null}
          <button type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Enter dashboard"}
          </button>
        </form>
        <div className="login-foot">AI Reservation System</div>
      </section>
    </main>
  );
}
