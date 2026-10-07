"use client";
import { useCallback, useEffect, useState } from "react";

type Row = { id: string; name: string; email: string; phone: string; roll_number: string; amount_due: number; created_at: string; hasScreenshot: boolean };
function successSound() { try { const c = new AudioContext(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 760; g.gain.setValueAtTime(.12, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .4); o.start(); o.stop(c.currentTime + .4); } catch {} }

export default function PendingPayments() {
  const [rows, setRows] = useState<Row[]>([]), [selected, setSelected] = useState<Row | null>(null);
  const [reason, setReason] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [verified, setVerified] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const load = useCallback(async (page = 1, append = false) => {
    setLoading(true);
    try { const r = await fetch(`/api/admin/pending?page=${page}`), j = await r.json(); if (!r.ok) throw Error(j.error); const requests = (j.requests || []) as Row[]; setRows(current => append ? [...current, ...requests] : current.length > 25 ? [...requests, ...current.slice(25)] : requests); setSelected(s => s ? requests.find(x => x.id === s.id) || s : null); setHasMore(Boolean(j.hasMore)); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load payments"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const id = setInterval(() => load(1), 30000); return () => clearInterval(id); }, [load]);
  async function review(decision: "approved" | "rejected") {
    if (!selected) return;
    if (decision === "rejected" && reason.trim().length < 5) { setError("A rejection reason is required (at least 5 characters)."); return; }
    setBusy(true); setError("");
    try {
      const reviewId = selected.id;
      const started = performance.now();
      const r = await fetch("/api/admin/payment-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId: reviewId, decision, reason: reason.trim() || "Payment verified against the account history." }) });
      const elapsed = Math.round(performance.now() - started);
      console.info(`[payment review] POST /api/admin/payment-review ${elapsed}ms (HTTP ${r.status})`);
      const j = await r.json();
      if (!r.ok) throw Error(j.error || "Review failed");
      if (decision === "approved") { successSound(); setVerified(true); setTimeout(() => setVerified(false), 2400); setNotice("Payment Verified · QR created and saved."); }
      else setNotice("Payment rejected. The reason is available to the participant.");
      setRows(current => current.filter(row => row.id !== reviewId));
      setSelected(null); setReason("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not review payment"); }
    finally { setBusy(false); }
  }
  return <>
    {verified && <div className="result-screen"><div><div className="result-icon">✓</div><h1>Payment Verified</h1><p>The unique QR has been created and linked to the registration.</p></div></div>}
    <div className="eyebrow">Payment review</div><h1>Pending Payments</h1>
    <p className="muted">Verify each payment using your payment account history. Oldest requests appear first.</p>
    <div className="toolbar"><button className="btn light" onClick={() => void load()} disabled={loading}>{loading ? <><span className="spinner"/> Loading…</> : "↻ Refresh"}</button><span className="pending-label">◌ Pending verification · {rows.length}</span></div>
    {notice && <p className="notice">{notice}</p>}{error && <p className="error">{error}</p>}
    <div className="pending-grid">
      <section className="card pending-list"><b>Waiting for review</b>
        {loading && !rows.length ? <p className="muted">Loading requests…</p> : !rows.length ? <div className="empty-state"><span>✓</span><b>All caught up</b><small>No payment proofs are waiting for review.</small></div> : rows.map(row => <button className={`request-row ${selected?.id === row.id ? "selected" : ""}`} key={row.id} onClick={() => { setSelected(row); setReason(""); setError(""); }}><span className="request-avatar">{row.name.slice(0, 1).toUpperCase()}</span><span><b>{row.name}</b><small>{row.roll_number || "—"} · {row.phone} · PKR {row.amount_due}</small></span><span className="pending-label">Pending</span></button>)}
      </section>
      <section className="card">{!selected ? <div className="empty-state"><span>⌕</span><b>Select a payment request</b><small>Open the screenshot and confirm payment in your real account history.</small></div> : <>
        <div className="eyebrow">Participant details</div><h2>{selected.name}</h2>
        <div className="request-details"><div><small>Roll number</small><b>{selected.roll_number || "—"}</b></div><div><small>Phone</small><b>{selected.phone}</b></div><div><small>Email</small><b>{selected.email}</b></div><div><small>Required ticket fee</small><b>PKR {selected.amount_due}</b></div><div><small>Submitted</small><b>{new Date(selected.created_at).toLocaleString()}</b></div></div>
        <p className="review-warning">Check the amount, transaction reference, and completed status on the uploaded screenshot against the JazzCash account history before deciding.</p>
        <div className="proof-frame">{selected.hasScreenshot ? <a className="proof-open-link" href={`/api/admin/pending/${selected.id}/proof`} target="_blank" rel="noreferrer"><img src={`/api/admin/pending/${selected.id}/proof`} alt={`Payment screenshot for ${selected.name}`}/><span>Open full screenshot</span></a> : <p className="muted">Screenshot preview unavailable</p>}</div>
        <div className="field" style={{ marginTop: 14 }}><label htmlFor="reason">Rejection reason (required to reject)</label><textarea id="reason" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain what the participant should correct"/></div>
        <div className="review-actions"><button className="btn danger" disabled={busy} onClick={() => review("rejected")}>{busy ? "Saving..." : "Reject"}</button><button className="btn" disabled={busy} onClick={() => review("approved")}>{busy ? <><span className="spinner"/> Approving...</> : "✓ Approve"}</button></div>
      </>}</section>
    </div>
    {hasMore && <div className="pending-load-more"><button type="button" className="btn light" disabled={loading} onClick={() => void load(Math.floor(rows.length / 25) + 1, true)}>{loading ? <><span className="spinner"/> Loading…</> : "Load more pending payments"}</button></div>}
  </>;
}
