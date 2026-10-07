"use client";

import { useEffect, useState } from "react";

type Payment = {
  id: string; name: string; rollNumber: string | null; phone: string; amount: number; status: string;
  hasScreenshot: boolean; reviewedBy: string | null; reason: string | null;
  createdAt: string; reviewedAt: string | null; usedAt: string | null; checkedInBy: string | null;
};

export default function PaymentHistory() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ page: String(page) });
        if (search.trim()) params.set("q", search.trim());
        if (status) params.set("status", status);
        const response = await fetch(`/api/admin/payment-history?${params}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load payment history");
        if (active) {
          setPayments(Array.isArray(result.payments) ? result.payments : []);
          setHasMore(Boolean(result.hasMore));
        }
      } catch (e) {
        if (active && !(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : "Could not load payment history");
      } finally {
        if (active) setLoading(false);
      }
    };
    const timer = setTimeout(load, search.trim() ? 180 : 0);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [search, status, page]);

  return <>
    <div className="eyebrow">Payment records</div>
    <h1>Payment History</h1>
    <p className="muted">Complete payment review history. Records and uploaded proofs are retained.</p>
    <div className="toolbar">
      <input aria-label="Search payment history" placeholder="Search name, roll number or phone" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      <select aria-label="Filter by payment status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
        <option value="">All statuses</option><option value="pending">Pending</option>
        <option value="approved">Approved</option><option value="rejected">Rejected</option>
        <option value="used">Used / Checked-in</option>
      </select>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="table-wrap"><table className="table">
      <thead><tr><th>Name</th><th>Roll number</th><th>Phone</th><th>Amount</th><th>Status</th><th>Screenshot</th><th>Reviewed by</th><th>Reason</th><th>Date / time</th></tr></thead>
      <tbody>{loading ? Array.from({ length: 6 }, (_, index) => <tr key={`skeleton-${index}`} aria-hidden="true"><td colSpan={9}><div className="skeleton skeleton-row" /></td></tr>) : payments.length ? payments.map(payment => <tr key={payment.id}>
        <td>{payment.name}</td><td>{payment.rollNumber || "—"}</td><td>{payment.phone}</td><td>PKR {payment.amount}</td><td>{payment.status}</td>
        <td>{payment.hasScreenshot ? <a href={`/api/admin/payment-history/${payment.id}/proof`} target="_blank" rel="noreferrer">View screenshot</a> : "—"}</td>
        <td>{payment.reviewedBy || (payment.checkedInBy ? `Checked in by ${payment.checkedInBy}` : "—")}</td>
        <td>{payment.reason || "—"}</td>
        <td>{new Date(payment.reviewedAt || payment.usedAt || payment.createdAt).toLocaleString()}</td>
      </tr>) : <tr><td colSpan={9}>No payments found</td></tr>}</tbody>
    </table></div>
    <div className="pagination-controls" aria-label="Payment history pages">
      <span className="muted">Page {page}{hasMore ? " · More records" : " · Last page"}</span>
      <div><button className="btn light small" type="button" disabled={loading || page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button>
      <button className="btn light small" type="button" disabled={loading || !hasMore} onClick={() => setPage(value => value + 1)}>Next</button></div>
    </div>
  </>;
}
