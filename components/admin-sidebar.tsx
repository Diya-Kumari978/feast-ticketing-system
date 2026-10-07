"use client";

import Link from "next/link";
import { useState } from "react";
import Logout from "@/components/logout";

const nav: Array<[string, string]> = [
  ["Dashboard", "/admin"], ["Scan Ticket", "/admin/scan"],
  ["Pending Payments", "/admin/pending"], ["Valid Tickets", "/admin/valid"],
  ["Payment History", "/admin/payment-history"], ["Used Tickets", "/admin/used"],
  ["Invalid / Attempted", "/admin/invalid"], ["Settings", "/admin/settings"],
];

export default function AdminSidebar({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="admin-menu-toggle" aria-label={open ? "Close admin menu" : "Open admin menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
      <span aria-hidden="true">{open ? "×" : "☰"}</span>
    </button>
    {open && <button type="button" aria-label="Close admin menu" className="sidebar-scrim" onClick={() => setOpen(false)} />}
    <aside className={`sidebar${open ? " is-open" : ""}`}>
      <Link className="brand" href="/admin" onClick={() => setOpen(false)}><span className="brandmark">✦</span> FEAST</Link>
      {nav.map(([label, url]) => <Link className={path === url ? "active" : ""} key={url} href={url} onClick={() => setOpen(false)}>{label}</Link>)}
      <div className="sidebar-logout"><Logout /></div>
    </aside>
  </>;
}
