"use client";

import { useEffect, useState } from "react";

type Row = { id: string; name: string; email: string; phone: string; ticket_type: string; amount_due: number; payment_status: string; status: string; payment_method: string; created_at: string; used_at: string | null; checked_in_by: string | null };

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
    <div className="toolbar"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, email or phone"/><a className="btn light" href={`/api/admin/tickets?status=${status}&format=csv`}>Export CSV</a></div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Ticket Type</th><th>Amount</th><th>Status</th><th>Check-in</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={7}><span className="spinner"/> Loading records…</td></tr> : rows.length ? rows.map(ticket => <tr key={ticket.id}><td>{ticket.name}</td><td>{ticket.phone}</td><td>{ticket.email}</td><td>{ticket.ticket_type}</td><td>PKR {ticket.amount_due}</td><td>{ticket.status}</td><td>{ticket.used_at ? `${new Date(ticket.used_at).toLocaleString()} · ${ticket.checked_in_by || ""}` : "—"}</td></tr>) : <tr><td colSpan={7}>No records found</td></tr>}
    </tbody></table></div>
  </>;
}
