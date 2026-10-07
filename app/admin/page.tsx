"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import EVENT_CONFIG from "@/lib/event-config";

type Scan = {
  id?: string;
  scanned_at?: string;
  result?: string;
  scanned_by?: string;
  tickets?: { name?: string } | null;
};

type Stats = {
  valid: number;
  used: number;
  pending: number;
  invalid: number;
  total: number;
  recentScans: Scan[];
};

const numberOrZero = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;

function normalizeStats(value: unknown): Stats {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    valid: numberOrZero(data.valid),
    used: numberOrZero(data.used),
    pending: numberOrZero(data.pending),
    invalid: numberOrZero(data.invalid),
    total: numberOrZero(data.total),
    recentScans: Array.isArray(data.recentScans)
      ? data.recentScans.filter((row): row is Scan => !!row && typeof row === "object")
      : [],
  };
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadError, setLoadError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current || document.visibilityState === "hidden") return;
    inFlight.current = true;
    try {
      const response = await fetch("/api/admin/stats");
      if (response.status === 401) {
        window.location.replace("/admin/login?next=%2Fadmin");
        return;
      }
      if (!response.ok) {
        setLoadError("Dashboard data could not be loaded. It will retry automatically.");
        return;
      }
      const payload: unknown = await response.json().catch(() => null);
      const nextStats = normalizeStats(payload);
      setStats(nextStats);
      setLoadError("");
      setLastUpdated(new Date());
    } catch {
      setLoadError("Dashboard data could not be loaded. It will retry automatically.");
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30000);
    const onVisibility = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [load]);

  const cards: Array<[string, keyof Omit<Stats, "recentScans">, string]> = [
    ["Valid Tickets", "valid", "/admin/valid"],
    ["Used / Checked-in", "used", "/admin/used"],
    ["Pending Payments", "pending", "/admin/pending"],
    ["Invalid / Attempted", "invalid", "/admin/invalid"],
    ["Total Registered", "total", "/admin/tickets"],
  ];
  const recentScans = stats?.recentScans ?? [];

  return <div className="dashboard-page">
    <section className="dashboard-heading">
      <div><div className="eyebrow">{EVENT_CONFIG.name} operations · {EVENT_CONFIG.date}</div>
        <h1>Dashboard</h1>
        <p className="muted">Live ticket and entrance activity · auto refreshes every 30 seconds</p>
      </div>
      <div className="dashboard-tools">
        {lastUpdated && <span className="dashboard-updated">Updated {lastUpdated.toLocaleTimeString()}</span>}
      </div>
    </section>
    {loadError && <p className="error" role="alert">{loadError}</p>}
    {stats && stats.pending > 0 && <div className="pending-notice" role="status">
      <span>You have {stats.pending} pending payment{stats.pending === 1 ? "" : "s"} to review.</span>
      <Link className="pending-notice-link" href="/admin/pending">Review now</Link>
    </div>}
    <div className="grid-cards dashboard-stat-grid">
      {cards.map(([label, key, href]) => <Link className="stat dashboard-stat-link" href={href} key={key} aria-label={`${stats?.[key] ?? ""} ${label}`}>
        <strong className={stats ? "dashboard-count" : ""} style={stats ? { "--count-target": stats[key] } as CSSProperties : undefined}>{stats ? <span className="visually-hidden">{stats[key]}</span> : <span className="skeleton dashboard-stat-skeleton" aria-label="Loading"/>}</strong><span>{label}</span>
      </Link>)}
    </div>
    <div className="card dashboard-panel">
      <div className="dashboard-panel-heading">
        <h2 style={{ margin: 0 }}>Recent Scans</h2>
        <Link className="btn light small" href="/admin/invalid">View attempts</Link>
      </div>
      <div className="table-wrap dashboard-scan-table">
        <table className="table"><thead><tr><th>Time</th><th>Name</th><th>Status</th><th>Admin</th></tr></thead>
          <tbody>
            {recentScans.map((scan, index) => <tr key={scan.id ?? `scan-${index}`}>
              <td>{scan.scanned_at ? new Date(scan.scanned_at).toLocaleString() : "—"}</td>
              <td>{scan.tickets?.name || "Unknown / invalid code"}</td>
              <td>{scan.result || "—"}</td>
              <td>{scan.scanned_by || "—"}</td>
            </tr>)}
            {!stats && <tr><td colSpan={4} role="status">Loading recent scans…</td></tr>}
            {stats && recentScans.length === 0 && <tr><td colSpan={4}>No scans recorded yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
    <div className="card dashboard-actions">
      <Link className="btn" href="/admin/scan">Scan Ticket →</Link>
      <Link className="btn light" href="/admin/pending">Review Pending Payments</Link>
    </div>
  </div>;
}
