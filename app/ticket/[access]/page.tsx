"use client";

import { useEffect, useState } from "react";
import EVENT_CONFIG from "@/lib/event-config";

type Ticket = { status: string; name?: string; qr?: string; rejectionReason?: string | null; usedAt?: string; ticketType?: string; orderId?: string };

export default function TicketPage({ params }: { params: Promise<{ access: string }> }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    void params.then(async ({ access }) => {
      try {
        const response = await fetch(`/api/ticket/${access}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Ticket could not be loaded.");
        if (active) setTicket(result);
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "Ticket could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [params]);

  return <main className="site-wrap"><nav className="top-nav"><a className="brand" href="/"><span className="brandmark">✦</span> {EVENT_CONFIG.name}</a><a className="btn light small" href="/">← Back</a></nav><section className="card" style={{ maxWidth: 560, margin: "24px auto", textAlign: "center", padding: 26 }}>
    {loading ? <p className="muted" role="status">Loading ticket details…</p> : loadError ? <><h1>Ticket unavailable</h1><p className="error">{loadError}</p></> : !ticket ? <h1>Ticket unavailable</h1> : ticket.status === "pending" ? <><div className="result-icon" style={{ background: "#e8effd", color: "#4e70b5" }}>◷</div><span className="eyebrow">Payment received</span><h1>Pending verification</h1><p className="muted">Your payment proof is being reviewed. This page does not refresh automatically.</p><p className="fine">No QR code is created until your payment is approved.</p></> : ticket.status === "failed" ? <><div className="result-icon" style={{ background: "#fff0f0", color: "#ca3d4b" }}>!</div><h1>Payment not approved</h1><p className="error">{ticket.rejectionReason || "Contact the Feast team for details."}</p><a className="btn light" href="/">Back to registration</a></> : ticket.status === "used" ? <><div className="result-icon">✓</div><h1>Checked In!</h1><p className="muted">You have successfully entered the event.</p><div className="request-details" style={{ textAlign: "left" }}><div><small>Name</small><b>{ticket.name}</b></div><div><small>Ticket Type</small><b>{ticket.ticketType}</b></div><div><small>Check-in Time</small><b>{ticket.usedAt ? new Date(ticket.usedAt).toLocaleString() : "Recorded"}</b></div></div><p className="success-note">This ticket has been used. You cannot enter again.</p><a className="btn light" href="/">⌂ Back to Home</a></> : ticket.qr ? <><div className="ticket-head"><span>◆</span><div><b>{EVENT_CONFIG.name}</b><small>Digital Ticket</small></div></div><img className="large-qr" src={ticket.qr} alt={`${EVENT_CONFIG.name} entry QR code`}/><div className="request-details" style={{ textAlign: "left" }}><div><small>Name</small><b>{ticket.name}</b></div><div><small>Ticket Type</small><b>{ticket.ticketType}</b></div><div><small>Order ID</small><b>{ticket.orderId}</b></div><div><small>Valid For</small><b>1 Entry Only</b></div></div><p className="success-note">● Active · Show this QR code at the entrance</p><a className="btn" href={ticket.qr} download="feast-ticket.png">↓ Download Ticket</a></> : <><h1>Ticket unavailable</h1><p>Please contact the Feast team.</p></>}
  </section></main>;
}
