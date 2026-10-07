"use client";

import { useEffect, useState } from "react";
import EVENT_CONFIG from "@/lib/event-config";

type Ticket = { status: string; name?: string; email?: string; ticketType?: string; amountDue?: number; paymentMethod?: string; orderId?: string; qr?: string; rejectionReason?: string | null };

export default function Success({ params }: { params: Promise<{ access: string }> }) {
  const [access, setAccess] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => { void params.then(value => setAccess(value.access)); }, [params]);
  useEffect(() => {
    if (!access) return;
    let active = true, firstLoad = true, terminal = false, inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      if (!active || terminal || inFlight) return;
      inFlight = true;
      let shouldContinue = true;
      try {
        const started = performance.now();
        const response = await fetch(`/api/ticket/${access}`, { cache: "no-store" });
        console.info(`[ticket status] GET /api/ticket ${Math.round(performance.now() - started)}ms (HTTP ${response.status})`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Ticket could not be loaded.");
        if (active) {
          setTicket(result); setLoadError("");
          if (["confirmed", "approved", "failed", "rejected", "used"].includes(result.status)) {
            terminal = true;
            shouldContinue = false;
          }
        }
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "Ticket could not be loaded.");
      } finally {
        if (active && firstLoad) { firstLoad = false; setLoading(false); }
        inFlight = false;
        if (active && shouldContinue && !terminal) timer = setTimeout(load, 3000);
      }
    };
    void load();
    const onVisibility = () => {
      if (document.visibilityState !== "visible" || terminal) return;
      if (timer) clearTimeout(timer);
      if (!inFlight) void load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { active = false; terminal = true; if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [access]);

  return <main className="site-wrap">
    <nav className="top-nav"><a className="brand" href="/"><span className="brandmark">✦</span> {EVENT_CONFIG.name}</a><a className="btn light small" href="/">← Back</a></nav>
    <section className="card success-page">
      {loading ? <p className="muted" role="status">Loading ticket details…</p> : loadError ? <><h1>Ticket unavailable</h1><p className="error">{loadError}</p></> : ticket?.status === "confirmed" || ticket?.status === "used" ? <>
        <div className="result-icon">✓</div><h1>Payment Successful!</h1><p>Your {EVENT_CONFIG.name} ticket has been confirmed.</p>
        <div className="summary-box"><div><small>Order ID</small><b>{ticket.orderId}</b></div><div><small>Name</small><b>{ticket.name}</b></div><div><small>Email</small><b>{ticket.email}</b></div><div><small>Ticket Type</small><b>{ticket.ticketType}</b></div><div><small>Amount Paid</small><b>PKR {ticket.amountDue}</b></div><div><small>Payment Method</small><b>{ticket.paymentMethod}</b></div></div>
        {ticket.qr && <img className="large-qr" src={ticket.qr} alt="Your Feast entry QR code"/>}<p className="success-note">▦ Your QR Code has been generated and is ready to use at the event entrance.</p><a className="btn full" href={`/ticket/${access}`}>View ticket →</a>
      </> : ticket?.status === "failed" ? <><h1>Payment not approved</h1><p className="error">{ticket.rejectionReason}</p><a className="btn" href="/">Back to registration</a></> : <>
        <div className="result-icon" style={{ background: "#e8effd", color: "#4e70b5" }}>◷</div><h1>Pending verification</h1><p>Payment submitted. We’ll update this page when your payment is reviewed.</p><div className="progress-track"><i/></div>
      </>}
      <button type="button" className="btn light full" onClick={() => { localStorage.removeItem("feastRegistration"); location.href = "/"; }}>Register another person</button>
    </section>
  </main>;
}
