"use client";

import { FormEvent, useEffect, useState } from "react";
import EVENT_CONFIG from "@/lib/event-config";
import { safeAdminNext } from "@/lib/admin-next";
import FeastMark from "@/components/feast-mark";

export default function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const next = safeAdminNext(new URLSearchParams(location.search).get("next"));
    fetch("/api/admin/session", { cache: "no-store" })
      .then(response => response.json())
      .then(result => { if (active && result.authenticated) location.replace(next); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const next = safeAdminNext(new URLSearchParams(location.search).get("next"));
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password"), next }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Sign-in failed.");
      location.replace(safeAdminNext(result.next));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign-in failed."); setBusy(false); }
  }

  return <main className="login-page">
    <a className="mobile-back btn light small" href="/">← Back to event</a>
    <section className="login-brand"><div className="login-brand-content"><div className="login-brand-lockup"><span className="brandmark"><FeastMark/></span><span>{EVENT_CONFIG.name}</span></div><p className="login-brand-kicker">FEAST · EVENT OPERATIONS</p><h1>Admin Panel</h1><small>Secure access for authorized staff.</small></div></section>
    <section className="login-form-side"><a className="back-link" href="/">← Back to event</a><div className="login-form-box card">
    <a className="login-brandmark" href="/" aria-label={`${EVENT_CONFIG.name} home`}><span className="brandmark"><FeastMark/></span></a>
    <div className="eyebrow">Secure access</div><h2>Admin sign in</h2>
    <form className="form" onSubmit={submit}>
      <div className="field"><label htmlFor="admin-email">Email</label><input id="admin-email" type="email" name="email" autoComplete="username" required/></div>
      <div className="field"><label htmlFor="admin-password">Password</label><input id="admin-password" type="password" name="password" autoComplete="current-password" required/></div>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="btn full" disabled={busy}>{busy ? <><span className="spinner"/> Signing in…</> : "Sign in"}</button>
    </form>
  </div></section></main>;
}
