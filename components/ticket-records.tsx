"use client";

import { useEffect, useState } from "react";

type Row = { id: string; name: string; email: string; phone: string; roll_number: string | null; amount_due: number; payment_status: string; status: string; reviewed_by: string | null; review_reason: string | null; screenshot_url: string | null; created_at: string; used_at: string | null; checked_in_by: string | null };

export default function TicketRecords({ status, title }: { status: string; title: string }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const response = await fetch(`/api/admin/tickets?status=${status}&q=${encodeURIComponent(query)}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load records.");
        if (active) setRows(Array.isArray(result.tickets) ? result.tickets : []);
      } catch (cause) {
        if (active && !(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Could not load records.");
      } finally {
        if (active) setLoading(false);
      }
    }, 180);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [query, status]);

  return <>
    <div className="eyebrow">Feast records</div><h1>{title}</h1>
    <div className="toolbar"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, roll number or phone"/><a className="btn light" href={`/api/admin/tickets?status=${status}&format=csv`}>Export CSV</a></div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Roll number</th><th>Phone</th><th>Amount</th><th>Status</th><th>Reviewed by</th><th>Reason</th><th>Date / time</th><th>Screenshot</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={9}><div className="table-skeleton" aria-label="Loading ticket records">{Array.from({length:4},(_,index)=><div className="skeleton skeleton-row" key={index}/>)}</div></td></tr> : rows.length ? rows.map(ticket => <tr key={ticket.id}><td>{ticket.name}</td><td>{ticket.roll_number || "—"}</td><td>{ticket.phone}</td><td>PKR {ticket.amount_due}</td><td>{ticket.status === "used" ? "used / checked-in" : ticket.payment_status}</td><td>{ticket.reviewed_by || "—"}</td><td>{ticket.review_reason || "—"}</td><td>{new Date(ticket.used_at || ticket.created_at).toLocaleString()}</td><td>{ticket.screenshot_url ? <a href={ticket.screenshot_url} target="_blank" rel="noreferrer">View screenshot</a> : "—"}</td></tr>) : <tr><td colSpan={9}>No records found</td></tr>}
    </tbody></table></div>
  </>;
}
