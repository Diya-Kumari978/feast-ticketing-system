"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/admin/stats", { cache: "no-store" });
        const payload: unknown = await response.json().catch(() => null);
        if (!active) return;
        setStats(normalizeStats(payload));
        setLoadError(response.ok ? "" : "Dashboard data is unavailable. Check Supabase configuration.");
      } catch {
        if (!active) return;
        setStats(normalizeStats(null));
        setLoadError("Dashboard data is unavailable. Check your connection and Supabase configuration.");
      }
    };
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const cards: Array<[string, keyof Omit<Stats, "recentScans">]> = [
    ["Valid Tickets", "valid"],
    ["Used / Checked-in", "used"],
    ["Pending Payments", "pending"],
    ["Invalid / Attempted", "invalid"],
    ["Total Registered", "total"],
  ];
  const recentScans = stats?.recentScans ?? [];

  return <>
    <div className="eyebrow">{EVENT_CONFIG.name} operations · {EVENT_CONFIG.date}</div>
    <h1>Dashboard</h1>
    <p className="muted">Live ticket and entrance activity · auto refreshes every 10 seconds</p>
    {loadError && <p className="error" role="alert">{loadError}</p>}
    <div className="grid-cards">
      {cards.map(([label, key]) => <div className="stat" key={key}>
        <strong>{stats ? stats[key] : "—"}</strong><span>{label}</span>
      </div>)}
    </div>
    <div className="card" style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Recent Scans</h2>
        <Link className="btn light small" href="/admin/invalid">View attempts</Link>
      </div>
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="table"><thead><tr><th>Time</th><th>Name</th><th>Status</th><th>Admin</th></tr></thead>
          <tbody>
            {recentScans.map((scan, index) => <tr key={scan.id ?? `scan-${index}`}>
              <td>{scan.scanned_at ? new Date(scan.scanned_at).toLocaleString() : "—"}</td>
              <td>{scan.tickets?.name || "Unknown / invalid code"}</td>
              <td>{scan.result || "—"}</td>
              <td>{scan.scanned_by || "—"}</td>
            </tr>)}
            {stats && recentScans.length === 0 && <tr><td colSpan={4}>No scans recorded yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
    <div className="card" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <Link className="btn" href="/admin/scan">Scan Ticket →</Link>
      <Link className="btn light" href="/admin/pending">Review Pending Payments</Link>
    </div>
  </>;
}
