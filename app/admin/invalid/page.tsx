"use client";

import { useEffect, useState } from "react";

type Log = { id: string; scanned_token: string; result: string; scanned_by: string; scanned_at: string; tickets?: { name: string; roll_number: string | null; phone: string } | null };

export default function Invalid() {
  const [logs, setLogs] = useState<Log[]>([]), [query, setQuery] = useState(""), [error, setError] = useState("");
  useEffect(() => { let live = true; fetch("/api/admin/logs?result=invalid", { cache: "no-store" }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not load scan logs."); return data; }).then(data => { if (live) setLogs(Array.isArray(data.logs) ? data.logs : []); }).catch(reason => { if (live) setError(reason instanceof Error ? reason.message : "Could not load scan logs."); }); return () => { live = false; }; }, []);
  const rows = logs.filter(row => `${row.tickets?.name || ""} ${row.tickets?.roll_number || ""} ${row.tickets?.phone || ""} ${row.scanned_token} ${row.scanned_by}`.toLowerCase().includes(query.toLowerCase()));
  return <><div className="eyebrow">Security & scan history</div><h1>Invalid / Attempted</h1><p className="muted">All rejected and unrecognized scan attempts.</p><div className="toolbar"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, roll number or phone"/></div>{error && <p className="error">{error}</p>}<div className="table-wrap"><table className="table"><thead><tr><th>Scanned value</th><th>Name</th><th>Roll number</th><th>Phone</th><th>Result</th><th>Admin</th><th>Time</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.scanned_token.slice(0, 12)}…</td><td>{row.tickets?.name || "Unknown"}</td><td>{row.tickets?.roll_number || "—"}</td><td>{row.tickets?.phone || "—"}</td><td>{row.result}</td><td>{row.scanned_by}</td><td>{new Date(row.scanned_at).toLocaleString()}</td></tr>)}{!rows.length && <tr><td colSpan={7}>No attempts found</td></tr>}</tbody></table></div></>;
}
