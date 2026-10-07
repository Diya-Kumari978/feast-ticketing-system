"use client";

import Link from "next/link";
import EVENT_CONFIG from "@/lib/event-config";

export default function PublicNavbar() {
  return (
    <nav className="top-nav">
      <Link className="brand" href="/" aria-label={`${EVENT_CONFIG.name} home`}><span className="brandmark">✦</span> {EVENT_CONFIG.name}</Link>
      <Link className="btn small" href="/admin/login">Admin</Link>
    </nav>
  );
}
