"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PublicNavbar from "@/components/public-navbar";
import UserFooter from "@/components/user-footer";
import EVENT_CONFIG from "@/lib/event-config";

const DETAILS_KEY = "feastDetails";
const REGISTRATION_KEY = "feastRegistration";
type Details = { name: string; email: string; rollNumber: string; phone: string };
type SavedRegistration = Details & { accessToken: string; ticketId: string; screenshotFileName: string };

export default function PaymentPage() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"compressing" | "uploading" | "submitting" | "">("");
  const [copied, setCopied] = useState("");
  const [saved, setSaved] = useState<SavedRegistration | null>(null);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DETAILS_KEY);
      if (!raw) { router.replace("/"); return; }
      setDetails(JSON.parse(raw) as Details);
      const previous = localStorage.getItem(REGISTRATION_KEY);
      if (previous) {
        const registration = JSON.parse(previous) as Partial<SavedRegistration>;
        if (typeof registration.accessToken === "string" && /^[a-f0-9]{64}$/.test(registration.accessToken)) {
          setSaved(registration as SavedRegistration);
          setMessage("Payment submitted. Please wait until the admin verifies and approves it.");
        }
      }
    } catch { setError("Your saved details could not be loaded. Return to the first step and try again."); }
  }, [router]);

  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const canUpload = useMemo(() => !saved, [saved]);

  useEffect(() => {
    if (!saved?.accessToken) return;
    let active = true, terminal = false, busyPoll = false, timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      if (!active || terminal || busyPoll) return;
      busyPoll = true;
      try {
        const response = await fetch(`/api/ticket/${saved.accessToken}`, { cache: "no-store" });
        if (!response.ok) return;
        const ticket = await response.json();
        if (!active) return;
        if (ticket.status === "pending") setMessage("Payment submitted. Please wait until the admin verifies and approves it.");
        else if (ticket.status === "confirmed" || ticket.status === "used") {
          terminal = true; setVerified(true);
          try { const context = new AudioContext(), oscillator = context.createOscillator(), gain = context.createGain(); oscillator.connect(gain); gain.connect(context.destination); oscillator.frequency.value = 840; gain.gain.setValueAtTime(.1, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .3); oscillator.start(); oscillator.stop(context.currentTime + .3); } catch {}
          navigator.vibrate?.([100, 40, 100]); window.setTimeout(() => router.push(`/ticket/${saved.accessToken}`), 1200);
        } else if (ticket.status === "rejected" || ticket.status === "failed") {
          terminal = true; setError(ticket.rejectionReason || "Payment was not approved."); setMessage("");
        }
      } catch { /* retry next interval */ }
      finally { busyPoll = false; if (active && !terminal) timer = setTimeout(check, 2000); }
    };
    void check();
    const visibility = () => { if (document.visibilityState === "visible" && !terminal) { if (timer) clearTimeout(timer); if (!busyPoll) void check(); } };
    document.addEventListener("visibilitychange", visibility);
    return () => { active = false; terminal = true; if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", visibility); };
  }, [saved?.accessToken, router]);

  async function copyAccount(number: string) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(number);
      else throw new Error("Clipboard API unavailable");
    } catch {
      const field = document.createElement("textarea");
      field.value = number; field.setAttribute("readonly", "");
      field.style.position = "fixed"; field.style.opacity = "0"; field.style.left = "-9999px";
      document.body.appendChild(field); field.select();
      const copied = document.execCommand("copy"); field.remove();
      if (!copied) { setError("Copy is unavailable on this browser. Press and hold the account number to copy it."); return; }
    }
    setCopied(number); window.setTimeout(() => setCopied(current => current === number ? "" : current), 2000);
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] || null;
    setFile(chosen); setError("");
  }

  function removeFile() {
    setFile(null); if (input.current) input.current.value = "";
  }

  async function submit() {
    if (!details || !file || busy || saved) return;
    setBusy(true); setError(""); setMessage("");
    let bitmap: ImageBitmap | null = null;
    try {
      setStep("compressing");
      bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / bitmap.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not prepare the screenshot.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close(); bitmap = null;
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not compress the screenshot.")), "image/jpeg", 0.8));
      if (blob.size > 4 * 1024 * 1024) throw new Error("Compressed screenshot must be smaller than 4 MB.");
      const compressed = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      const body = new FormData();
      body.set("name", details.name); body.set("email", details.email); body.set("rollNumber", details.rollNumber); body.set("phone", details.phone); body.set("screenshot", compressed);
      setStep("uploading");
      const response = await fetch("/api/register", { method: "POST", body });
      setStep("submitting");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Payment submission failed.");
      if (typeof result.accessToken !== "string" || !/^[a-f0-9]{64}$/.test(result.accessToken) || typeof result.id !== "string") throw new Error("The ticket was saved but its status link is missing.");
      const registration: SavedRegistration = { ...details, accessToken: result.accessToken, ticketId: result.id, screenshotFileName: file.name };
      localStorage.setItem(REGISTRATION_KEY, JSON.stringify(registration));
      setSaved(registration);
      setMessage("Payment submitted. Please wait until the admin verifies and approves it.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment submission failed. Please try again.");
    } finally {
      bitmap?.close(); setBusy(false); setStep("");
    }
  }

  function registerAnother() {
    localStorage.removeItem(REGISTRATION_KEY);
    sessionStorage.removeItem(DETAILS_KEY);
    setSaved(null); setMessage(""); setFile(null); setPreview(""); setDetails(null);
    router.replace("/");
  }

  if (!details) return <main className="site-wrap"><PublicNavbar/><p className="error form-feedback">{error || "Returning to your details…"}</p><UserFooter/></main>;

  return <main className="site-wrap">
    <PublicNavbar />
    <section className="hero-band payment-hero"><div className="hero-copy"><span className="eyebrow" style={{ color: "#A5F3FC" }}>Step 2 · Payment</span><h1>Complete your payment</h1><p>{EVENT_CONFIG.name}</p></div></section>
    <div className="step-indicator" aria-label="Step 2 of 2"><span className="step done"><b>✓</b> Details</span><i/><span className="step active"><b>2</b> Payment</span></div>
    <section className="payment-layout payment-single-layout">
      <div className="card form-card payment-form-card">
        <div className="payment-intro"><div className="payment-icon" aria-hidden="true">↗</div><div><h2>Payment details</h2><p>Send the exact amount to one of these accounts.</p></div><strong className="payment-total">PKR {EVENT_CONFIG.price}</strong></div>
        <div className="account-cards">{EVENT_CONFIG.accounts.map(account => <article className="account-card" key={account.number}><div><small>Payment method</small><strong>{account.provider}</strong></div><div><small>Account holder</small><strong>{account.holder}</strong></div><div className="account-number-row"><div><small>JazzCash number</small><strong className="account-number">{account.number}</strong></div><button className={`copy-icon-btn${copied === account.number ? " copied" : ""}`} type="button" aria-label={copied === account.number ? "JazzCash number copied" : "Copy JazzCash number"} title={copied === account.number ? "Copied" : "Copy number"} onClick={() => void copyAccount(account.number)}>{copied === account.number ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>}</button></div><span className="visually-hidden" aria-live="polite">{copied === account.number ? "JazzCash number copied" : ""}</span></article>)}</div>
        <div className="field screenshot-drop"><label htmlFor="screenshot">Upload payment screenshot</label><input ref={input} id="screenshot" type="file" accept="image/jpeg,image/png,image/webp" disabled={!canUpload || busy} onChange={chooseFile}/><small className="fine">JPG, PNG or WebP · Max 4 MB</small>
          {preview && <div className="screenshot-preview"><img src={preview} alt="Selected payment screenshot preview"/><div><span>{file?.name}</span>{canUpload && <button className="btn light small" type="button" onClick={removeFile}>Remove image</button>}</div></div>}
          {saved && !preview && <p className="fine saved-proof-name">Saved screenshot: {saved.screenshotFileName}</p>}
        </div>
    {verified && <div className="result-screen"><div><svg className="checkmark" viewBox="0 0 68 68" aria-hidden="true"><circle cx="34" cy="34" r="30"/><path d="m19 35 10 10 21-23"/></svg><h1>Payment Verified</h1></div></div>}
    {message && <div className="ticket-status pending" role="status"><span className="pending-ring"/><span>{message}</span></div>}
    {error && <p className="error" role="alert">{error} {saved && <a href={`/ticket/${saved.accessToken}`}>View ticket status</a>}</p>}
        {!saved ? <button className="btn full" type="button" disabled={!file || busy} onClick={() => void submit()}>{busy ? <><span className="spinner"/> {step === "compressing" ? "Compressing..." : step === "uploading" ? "Uploading..." : "Submitting..."}</> : "Submit payment"}</button> : <button className="btn light full" type="button" onClick={registerAnother}>Register another person</button>}
      </div>
    </section>
    <UserFooter />
  </main>;
}
