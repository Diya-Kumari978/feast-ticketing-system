"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import EVENT_CONFIG from "@/lib/event-config";
import FeastMark from "@/components/feast-mark";
import UserFooter from "@/components/user-footer";

type Ticket = { status: string; name?: string; rollNumber?: string; qr?: string | null; rejectionReason?: string | null; usedAt?: string; checkedInBy?: string; orderId?: string; amountDue?: number };
const confetti = Array.from({ length: 24 }, (_, i) => i);

function playSuccess() {
  try { const ctx = new AudioContext(), osc = ctx.createOscillator(), gain = ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value = 840; gain.gain.setValueAtTime(.12, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .35); osc.start(); osc.stop(ctx.currentTime + .35); } catch {}
}

export default function TicketPage({ params }: { params: Promise<{ access: string }> }) {
  const [access, setAccess] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [checking, setChecking] = useState(false);
  const [proof, setProof] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [popup, setPopup] = useState(false);
  const statusRef = useRef("");

  const load = useCallback(async (quiet = false) => {
    if (!access) return;
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/ticket/${access}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load your ticket.");
      setTicket(result); setLoadError("");
      statusRef.current = result.status;
      if (["confirmed", "used"].includes(result.status) && !sessionStorage.getItem(`feastVerified-${access}`)) {
        sessionStorage.setItem(`feastVerified-${access}`, "1");
        setPopup(true); playSuccess(); navigator.vibrate?.([100, 40, 100]);
        window.setTimeout(() => setPopup(false), 1300);
      }
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Could not load your ticket."); }
    finally { setLoading(false); setChecking(false); }
  }, [access]);

  useEffect(() => { void params.then(({ access: value }) => setAccess(value)); }, [params]);

  useEffect(() => {
    if (!access) return;
    let active = true, inFlight = false, timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/ticket/${access}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load your ticket.");
        if (!active) return;
        setTicket(previous => {
          statusRef.current = result.status;
          if (result.status === "confirmed" && previous?.status !== "confirmed" && !sessionStorage.getItem(`feastVerified-${access}`)) {
            sessionStorage.setItem(`feastVerified-${access}`, "1"); setPopup(true); playSuccess(); navigator.vibrate?.([100, 40, 100]); window.setTimeout(() => setPopup(false), 1300);
          }
          return result;
        });
        setLoadError("");
        if (!["pending"].includes(result.status)) return;
      } catch (error) { if (active) setLoadError(error instanceof Error ? error.message : "Could not load your ticket."); }
      finally { inFlight = false; setLoading(false); }
      if (active && !document.hidden) timer = setTimeout(poll, 2000);
    };
    void poll();
    const visibility = () => { if (document.visibilityState === "visible" && statusRef.current === "pending") { if (timer) clearTimeout(timer); void poll(); } };
    document.addEventListener("visibilitychange", visibility);
    return () => { active = false; if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", visibility); };
  // Current status is held in a ref so visibility changes can poll without rebuilding the timer.
  }, [access]);

  useEffect(() => {
    if (!proof) { setProofPreview(""); return; }
    const url = URL.createObjectURL(proof); setProofPreview(url); return () => URL.revokeObjectURL(url);
  }, [proof]);

  async function replaceProof(event: ChangeEvent<HTMLFormElement>) {
    event.preventDefault(); if (!access || !proof || uploading) return;
    setUploading(true); setNotice(""); setLoadError("");
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(proof);
      const scale = Math.min(1, 1600 / bitmap.width), canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d"); if (!context) throw new Error("Could not prepare the screenshot.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close(); bitmap = null;
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not compress the screenshot.")), "image/jpeg", .8));
      if (blob.size > 4 * 1024 * 1024) throw new Error("Compressed screenshot must be smaller than 4 MB.");
      const body = new FormData(); body.set("screenshot", new File([blob], "payment-proof.jpg", { type: "image/jpeg" }));
      const response = await fetch(`/api/ticket/${access}/proof`, { method: "POST", body }); const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not submit new proof.");
      const storageKey = "feastRegistration", old = localStorage.getItem(storageKey);
      if (old) { try { localStorage.setItem(storageKey, JSON.stringify({ ...JSON.parse(old), screenshotFileName: proof.name })); } catch {} }
      setProof(null); statusRef.current = "pending"; setTicket(current => current ? { ...current, status: "pending", rejectionReason: null, qr: null } : current);
      setNotice("New proof submitted. Please wait for payment verification.");
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Could not submit new proof."); }
    finally { bitmap?.close(); setUploading(false); }
  }

  return <main className="site-wrap">
    <nav className="top-nav"><a className="brand" href="/"><span className="brandmark"><FeastMark/></span>{EVENT_CONFIG.name}</a><a className="btn light small" href="/">← Back</a></nav>
    {popup && <div className="result-screen"><div><svg className="checkmark" viewBox="0 0 68 68" aria-hidden="true"><circle cx="34" cy="34" r="30"/><path d="m19 35 10 10 21-23"/></svg><h1>Payment Verified</h1></div></div>}
    <section className="card ticket-page-card">
      {loading && !ticket ? <p className="muted" role="status">Loading ticket…</p> : loadError && !ticket ? <><h1>Ticket unavailable</h1><p className="error">{loadError}</p><button className="btn" type="button" onClick={() => { setChecking(true); void load(); }}>{checking ? "Checking..." : "Retry"}</button></> : !ticket ? <h1>Ticket unavailable</h1> : ticket.status === "pending" ? <>
        <div className="pending-heading"><span className="pending-ring"/><div><span className="eyebrow">Payment submitted</span><h1>Pending verification</h1></div></div>
        <p className="muted">Your payment is awaiting review. This page checks for updates automatically.</p>
      </> : ticket.status === "rejected" ? <>
        <div className="result-icon" style={{ background: "#FFE4E9", color: "#8A1235" }}>!</div><h1>Payment not approved</h1>
        <p className="error">{ticket.rejectionReason || "Please submit a new payment proof."}</p>
        <form className="form resubmit-form" onSubmit={replaceProof}><div className="field"><label htmlFor="replacement-proof">Submit new proof</label><input id="replacement-proof" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setProof(event.target.files?.[0] || null)} required/><small className="fine">JPG, PNG or WebP · Max 4 MB</small></div>{proofPreview && <img className="replacement-preview" src={proofPreview} alt="New payment proof preview"/>}{loadError && <p className="error">{loadError}</p>}{notice && <p className="success-note">{notice}</p>}<button className="btn full" disabled={!proof || uploading}>{uploading ? <><span className="spinner"/> Uploading...</> : "Submit new proof"}</button></form>
      </> : ticket.status === "used" ? <>
        <div className="result-icon">✓</div><h1>Checked In</h1><p className="muted">You have successfully entered the event.</p><p className="success-note">Check-in time: {ticket.usedAt ? new Date(ticket.usedAt).toLocaleString() : "Recorded"}{ticket.checkedInBy ? ` · Checked by ${ticket.checkedInBy}` : ""}</p>{ticket.qr && <img className="large-qr qr-used" src={ticket.qr} alt="Used entry QR code"/>}
      </> : ticket.qr ? <>
        <div className="ticket-head"><span>❄</span><div><b>{EVENT_CONFIG.name}</b><small>Entry Ticket</small></div></div>
        <div className="qr-stage"><div className="confetti-burst" aria-hidden="true">{confetti.map(i => <span key={i} style={{ "--confetti-x": `${Math.cos(i * Math.PI / 12) * (35 + i % 4 * 12)}px`, "--confetti-y": `${Math.sin(i * Math.PI / 12) * (35 + i % 4 * 12)}px`, "--confetti-color": ["#7C3AED", "#22D3EE", "#F43F9D", "#FBBF24"][i % 4] } as CSSProperties}/>)}</div><img className="large-qr qr-reveal" src={ticket.qr} alt={`${EVENT_CONFIG.name} entry QR code`}/></div>
        <div className="ticket-info"><div><small>Name</small><b>{ticket.name}</b></div><div><small>Roll number</small><b>{ticket.rollNumber}</b></div><div><small>Order code</small><b>{ticket.orderId}</b></div><div><small>Date</small><b>{EVENT_CONFIG.date}</b></div><div><small>Entry fee</small><b>PKR {ticket.amountDue ?? EVENT_CONFIG.price}</b></div></div>
        <p className="success-note">Active · Show this QR at the entrance.</p><a className="btn" href={ticket.qr} download={`${ticket.orderId || "FEAST-ticket"}.png`}>Save QR</a>
      </> : <><h1>Ticket unavailable</h1><p className="error">We could not find the approved QR for this ticket.</p><button className="btn light" onClick={() => { setChecking(true); void load(); }}>Retry</button></>}
      {notice && ticket?.status !== "rejected" && <p className="success-note form-feedback">{notice}</p>}{loadError && ticket && ticket.status !== "rejected" && <p className="error form-feedback">{loadError}</p>}
      <button type="button" className="btn light full register-another-ticket" onClick={() => { localStorage.removeItem("feastRegistration"); sessionStorage.removeItem("feastDetails"); location.href = "/"; }}>Register another person</button>
    </section>
    <UserFooter />
  </main>;
}
