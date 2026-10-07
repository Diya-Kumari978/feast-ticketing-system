"use client";

import Link from "next/link";
import { useState } from "react";
import EVENT_CONFIG from "@/lib/event-config";
import FeastMark from "@/components/feast-mark";

export default function PublicNavbar() {
  const [openingAdmin, setOpeningAdmin] = useState(false);
  return (
    <nav className="top-nav">
      <Link className="brand" href="/" aria-label={`${EVENT_CONFIG.name} home`}><span className="brandmark"><FeastMark/></span> {EVENT_CONFIG.name}</Link>
      <Link className={`btn small admin-entry-link${openingAdmin ? " is-opening" : ""}`} href="/admin/login" aria-label={openingAdmin ? "Opening admin sign in" : "Admin sign in"} onClick={() => setOpeningAdmin(true)}>{openingAdmin ? <><span className="spinner"/> Opening…</> : "Admin"}</Link>
    </nav>
  );
}
