"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PublicNavbar from "@/components/public-navbar";
import UserFooter from "@/components/user-footer";
import EVENT_CONFIG from "@/lib/event-config";

const DETAILS_KEY = "feastDetails";
type RegistrationDetails = { name: string; email: string; rollNumber: string; phone: string };

export default function Home() {
  const router = useRouter();
  const [details, setDetails] = useState<RegistrationDetails>({ name: "", email: "", rollNumber: "", phone: "" });
  const [error, setError] = useState("");
  const [savedAccess, setSavedAccess] = useState("");
  const [savedStatus, setSavedStatus] = useState("pending");
  const [savedReason, setSavedReason] = useState("");
  const savedStatusRef = useRef("pending");

  useEffect(() => {
    try {
      const existingTicket = localStorage.getItem("feastRegistration");
      if (existingTicket) {
        const registration = JSON.parse(existingTicket) as Partial<RegistrationDetails> & { accessToken?: unknown };
        if (typeof registration.accessToken === "string" && /^[a-f0-9]{64}$/.test(registration.accessToken)) {
          setSavedAccess(registration.accessToken);
          setDetails(current => ({ ...current, name: registration.name || "", email: registration.email || "", rollNumber: registration.rollNumber || "", phone: registration.phone || "" }));
          return;
        }
      }
      const saved = sessionStorage.getItem(DETAILS_KEY);
      if (saved) setDetails({ ...details, ...JSON.parse(saved) });
    } catch { setError("Saved details could not be restored. Please check the fields and try again."); }
  // Read once when the page opens; state changes should not overwrite the saved draft.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!savedAccess) return;
    let active = true, inFlight = false, timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/ticket/${savedAccess}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Ticket status is temporarily unavailable.");
        const ticket = await response.json();
        if (!active) return;
        savedStatusRef.current = ticket.status;
        setSavedStatus(ticket.status);
        setSavedReason(ticket.rejectionReason || "");
      } catch { /* Try again after the next polling interval. */ }
      finally {
        inFlight = false;
        if (active && savedStatusRef.current === "pending") timer = setTimeout(check, 3000);
      }
    };
    void check();
    const onVisibility = () => { if (document.visibilityState === "visible") { if (timer) clearTimeout(timer); void check(); } };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { active = false; if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [savedAccess]);

  function update(field: keyof RegistrationDetails, value: string) {
    setDetails(current => ({ ...current, [field]: value }));
    if (error) setError("");
  }

  function continueToPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = { name: details.name.trim(), email: details.email.trim().toLowerCase(), rollNumber: details.rollNumber.trim().toUpperCase(), phone: details.phone.trim() };
    if (clean.name.length < 2 || clean.name.length > 60) return setError("Enter a name between 2 and 60 characters.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) return setError("Enter a valid email address.");
    if (!/^[A-Z0-9/-]{3,20}$/.test(clean.rollNumber)) return setError("Roll number must be 3–20 letters, numbers, hyphens, or slashes.");
    if (!/^03\d{9}$/.test(clean.phone)) return setError("Enter your 11-digit phone number starting with 03.");
    sessionStorage.setItem(DETAILS_KEY, JSON.stringify(clean));
    setDetails(clean);
    setError("");
    router.push("/payment");
  }

  function registerAnother() {
    localStorage.removeItem("feastRegistration");
    sessionStorage.removeItem(DETAILS_KEY);
    savedStatusRef.current = "pending";
    setSavedAccess(""); setSavedStatus("pending"); setSavedReason(""); setDetails({ name: "", email: "", rollNumber: "", phone: "" });
  }

  return <main className="site-wrap">
    <PublicNavbar />
    <section className="hero-band">
      <div className="hero-copy">
        <span className="eyebrow" style={{ color: "#A5F3FC" }}>A winter evening of campus celebration</span>
        <h1>{EVENT_CONFIG.name}</h1>
        <p>{EVENT_CONFIG.heroTagline}</p>
        <div className="hero-chips"><span className="hero-chip">❄ {EVENT_CONFIG.date}</span></div>
      </div>
    </section>

    {savedAccess ? <section className="card saved-registration-card">
      <div className="saved-status-icon" aria-hidden="true">{savedStatus === "confirmed" ? "✓" : savedStatus === "used" ? "✓" : savedStatus === "rejected" || savedStatus === "failed" ? "!" : <span className="pending-ring"/>}</div>
      <h2>{savedStatus === "confirmed" ? "Payment Successful" : savedStatus === "used" ? "Checked In" : savedStatus === "rejected" || savedStatus === "failed" ? "Payment not approved" : "Pending verification"}</h2>
      {savedStatus === "pending" && <p className="success-note">Payment submitted. Please wait until the admin verifies and approves it.</p>}
      {(savedStatus === "rejected" || savedStatus === "failed") && <p className="error" role="alert">{savedReason || "Payment was not approved. Open your ticket to submit a new screenshot."}</p>}
      {savedStatus === "confirmed" || savedStatus === "used" ? <Link className="btn full" href={`/ticket/${savedAccess}`}>View ticket and QR</Link> : <Link className="btn light full" href={`/ticket/${savedAccess}`}>View payment status</Link>}
      <button className="btn full register-another-home" type="button" onClick={registerAnother}>Register another person</button>
    </section> : <section className="register-layout">
      <div className="card form-card">
        <div className="section-heading"><span>Your details</span><small>STEP 1 OF 2</small></div>
        <div className="step-indicator" aria-label="Step 1 of 2"><span className="step active"><b>1</b> Details</span><i/><span className="step"><b>2</b> Payment</span></div>
        <form className="form" onSubmit={continueToPayment} noValidate>
          <div className="field floating"><label htmlFor="name">Full name</label><input id="name" name="name" placeholder=" " value={details.name} onChange={event => update("name", event.target.value)} autoComplete="name" maxLength={60} required/></div>
          <div className="field floating"><label htmlFor="email">Email</label><input id="email" name="email" type="email" placeholder=" " value={details.email} onChange={event => update("email", event.target.value)} autoComplete="email" required/></div>
          <div className="field floating"><label htmlFor="rollNumber">Roll number</label><input id="rollNumber" name="rollNumber" placeholder=" " value={details.rollNumber} onChange={event => update("rollNumber", event.target.value)} autoComplete="off" maxLength={20} required/></div>
          <div className="field floating"><label htmlFor="phone">Phone number</label><input id="phone" name="phone" type="tel" inputMode="numeric" placeholder=" " value={details.phone} onChange={event => update("phone", event.target.value)} autoComplete="tel" maxLength={11} required/></div>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn full" type="submit">Continue to payment <span aria-hidden="true">→</span></button>
        </form>
      </div>
      <aside className="event-side">
        <div className="event-fact"><b>⌖</b><div><small>Venue</small><strong>{EVENT_CONFIG.venue}</strong></div></div>
        <div className="event-fact"><b>❄</b><div><small>Date</small><strong>{EVENT_CONFIG.date}</strong></div></div>
      </aside>
    </section>}
    <UserFooter />
  </main>;
}
