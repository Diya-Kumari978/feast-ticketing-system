"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReviewTicket = {
  id: string; name: string; roll_number: string | null; phone: string; email: string;
  amount_due: number; payment_status: string; status: string; payment_rejection_reason: string | null;
  created_at: string; screenshotUrl: string | null;
};

export default function RequestReview({ ticket }: { ticket: ReviewTicket }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function review(decision: "approved" | "rejected") {
    if (busy) return;
    if (decision === "rejected" && reason.trim().length < 5) { setError("Enter a rejection reason (at least 5 characters)."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/payment-review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: ticket.id, decision, reason: reason.trim() || "Payment verified against the account history." }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not review this request.");
      setNotice(decision === "approved" ? "Payment approved. The QR was created and the notifications were queued." : "Payment rejected. The participant was notified where delivery is configured.");
      window.setTimeout(() => router.replace("/admin/pending"), 900);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not review this request.");
      setBusy(false);
    }
  }

  const pending = ticket.payment_status === "pending";
  return <section className="card admin-request-review" style={{ maxWidth: 920, margin: "0 auto" }}>
    <div className="toolbar" style={{ justifyContent: "space-between" }}><a className="btn light" href="/admin/pending">← Pending payments</a><span className={`status-pill ${pending ? "pending" : ""}`}>{ticket.payment_status}</span></div>
    <div className="eyebrow">Payment request</div><h1>{ticket.name}</h1>
    <div className="request-details">
      <div><small>Roll number</small><b>{ticket.roll_number || "—"}</b></div>
      <div><small>Phone</small><b>{ticket.phone}</b></div>
      <div><small>Email</small><b>{ticket.email}</b></div>
      <div><small>Required ticket fee</small><b>PKR {ticket.amount_due}</b></div>
      <div><small>Submitted</small><b>{new Date(ticket.created_at).toLocaleString()}</b></div>
    </div>
    <h2>Uploaded payment screenshot</h2>
    <p className="review-warning">Compare the amount, transaction reference, and completed status on this screenshot with the JazzCash account history before deciding. The screenshot is not independently verified by the system.</p>
    <div className="proof-frame">{ticket.screenshotUrl ? <a href={ticket.screenshotUrl} target="_blank" rel="noreferrer"><img src={ticket.screenshotUrl} alt={`Payment proof from ${ticket.name}`}/></a> : <p className="muted">Payment screenshot is unavailable.</p>}</div>
    {!pending && <p className={ticket.payment_status === "confirmed" ? "success-note" : "error"}>{ticket.payment_status === "confirmed" ? "This request is already approved." : `This request is already rejected. ${ticket.payment_rejection_reason || ""}`}</p>}
    {pending && <>
      <div className="field" style={{ marginTop: 16 }}><label htmlFor="request-reason">Rejection reason (required to reject)</label><textarea id="request-reason" rows={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="Tell the participant what needs correction"/></div>
      {error && <p className="error" role="alert">{error}</p>}{notice && <p className="success-note" role="status">{notice}</p>}
      <div className="review-actions"><button type="button" className="btn danger" disabled={busy} onClick={() => void review("rejected")}>{busy ? "Saving..." : "Reject"}</button><button type="button" className="btn" disabled={busy} onClick={() => void review("approved")}>{busy ? "Approving..." : "Approve payment"}</button></div>
    </>}
  </section>;
}
