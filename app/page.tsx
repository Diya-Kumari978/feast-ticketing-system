"use client";
import { useEffect, useRef, useState, FormEvent } from "react";
import PublicNavbar from "@/components/public-navbar";
import EVENT_CONFIG from "@/lib/event-config";

const choices = [
  { id: "jazzcash", name: "JazzCash", title: process.env.NEXT_PUBLIC_JAZZCASH_TITLE, account: process.env.NEXT_PUBLIC_JAZZCASH_ACCOUNT },
  { id: "easypaisa", name: "Easypaisa", title: process.env.NEXT_PUBLIC_EASYPAISA_TITLE, account: process.env.NEXT_PUBLIC_EASYPAISA_ACCOUNT },
  { id: "bank_transfer", name: "Bank Transfer", title: process.env.NEXT_PUBLIC_BANK_TITLE, account: process.env.NEXT_PUBLIC_BANK_ACCOUNT },
];
const REGISTRATION_STORAGE_KEY = "feastRegistration";
type SavedRegistration = {
  accessToken: string;
  ticketId?: string;
  name: string;
  email: string;
  phone: string;
  ticketType: string;
  paymentMethod: string;
  screenshotFileName: string;
};

function chime() {
  try {
    const context = new AudioContext(), oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.connect(gain); gain.connect(context.destination); oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(.12, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .35);
    oscillator.start(); oscillator.stop(context.currentTime + .35);
  } catch {}
}

export default function Home() {
  const [method, setMethod] = useState("jazzcash"), [busy, setBusy] = useState(false), [uploadStep, setUploadStep] = useState<"compressing" | "uploading" | "submitting" | null>(null), [error, setError] = useState("");
  const [status, setStatus] = useState(""), [access, setAccess] = useState(""), [fileName, setFileName] = useState("");
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [phone, setPhone] = useState("");
  const [ticketType, setTicketType] = useState("General Admission"), [screenshot, setScreenshot] = useState<File | null>(null);
  const [savedRegistration, setSavedRegistration] = useState<SavedRegistration | null>(null), [restoreReady, setRestoreReady] = useState(false);
  const [approved, setApproved] = useState(false);
  const screenshotInput = useRef<HTMLInputElement>(null);
  const selected = choices.find(option => option.id === method)!;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REGISTRATION_STORAGE_KEY);
      if (saved) {
        const registration = JSON.parse(saved) as Partial<SavedRegistration>;
        if (typeof registration.accessToken === "string" && /^[a-f0-9]{64}$/.test(registration.accessToken)) {
          const restored: SavedRegistration = {
            accessToken: registration.accessToken,
            ticketId: registration.ticketId,
            name: typeof registration.name === "string" ? registration.name : "",
            email: typeof registration.email === "string" ? registration.email : "",
            phone: typeof registration.phone === "string" ? registration.phone : "",
            ticketType: typeof registration.ticketType === "string" ? registration.ticketType : "General Admission",
            paymentMethod: choices.some(choice => choice.id === registration.paymentMethod) ? registration.paymentMethod! : "jazzcash",
            screenshotFileName: typeof registration.screenshotFileName === "string" ? registration.screenshotFileName : "",
          };
          setSavedRegistration(restored);
          setAccess(restored.accessToken);
          setName(restored.name);
          setEmail(restored.email);
          setPhone(restored.phone);
          setTicketType(restored.ticketType);
          setMethod(restored.paymentMethod);
          setFileName(restored.screenshotFileName);
        }
      }
    } catch {
      setError("Saved registration could not be read in this browser.");
    } finally {
      setRestoreReady(true);
    }
  }, []);

  useEffect(() => {
    if (!access) return;
    let active = true;
    let terminal = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;
    const checkStatus = async () => {
      if (!active || terminal || inFlight) return;
      inFlight = true;
      let shouldContinue = true;
      try {
        const started = performance.now();
        const response = await fetch(`/api/ticket/${access}`, { cache: "no-store" });
        console.info(`[ticket status] GET /api/ticket ${Math.round(performance.now() - started)}ms`);
        if (!response.ok) return;
        const ticket = await response.json();
        if (!active) return;
        if (ticket.status === "pending") {
          setStatus("Payment submitted. Pending verification.");
        } else if (ticket.status === "confirmed" || ticket.status === "approved") {
          terminal = true;
          shouldContinue = false;
          setStatus("");
          setApproved(true);
          chime();
          navigator.vibrate?.([120, 50, 120]);
          redirectTimer = setTimeout(() => { location.href = `/payment-success/${access}`; }, 1200);
        } else if (ticket.status === "failed" || ticket.status === "rejected") {
          terminal = true;
          shouldContinue = false;
          setStatus(`Payment rejected: ${ticket.rejectionReason || "Contact the Feast team."}`);
        } else if (ticket.status === "used") {
          terminal = true;
          shouldContinue = false;
          setStatus("Checked In");
        }
      } catch { /* Retry transient network errors while the registration remains pending. */ }
      finally {
        inFlight = false;
        if (active && shouldContinue && !terminal) timer = setTimeout(checkStatus, 3000);
      }
    };
    void checkStatus();
    const onVisibility = () => {
      if (document.visibilityState !== "visible" || terminal) return;
      if (timer) clearTimeout(timer);
      if (!inFlight) void checkStatus();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { active = false; terminal = true; if (timer) clearTimeout(timer); if (redirectTimer) clearTimeout(redirectTimer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [access]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setUploadStep("compressing"); setError(""); setStatus("");
    try {
      if (!screenshot) throw new Error("Choose your payment screenshot first.");
      const bitmap = await createImageBitmap(screenshot);
      const scale = Math.min(1, 1600 / bitmap.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not prepare the payment screenshot.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const compressedBlob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not compress the screenshot.")), "image/jpeg", 0.8));
      const compressed = new File([compressedBlob], screenshot.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.set("name", name);
      formData.set("email", email);
      formData.set("phone", phone);
      formData.set("ticketType", ticketType);
      formData.set("paymentMethod", method);
      formData.set("screenshot", compressed);
      setUploadStep("uploading");
      const response = await fetch("/api/register", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Registration failed");
      setUploadStep("submitting");
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const accessToken = typeof result.accessToken === "string" ? result.accessToken : "";
      if (!/^[a-f0-9]{64}$/.test(accessToken)) throw new Error("Registration was saved but the ticket access token was missing.");
      const registration: SavedRegistration = {
        accessToken,
        ticketId: typeof result.id === "string" ? result.id : undefined,
        name,
        email,
        phone,
        ticketType,
        paymentMethod: method,
        screenshotFileName: screenshot?.name || fileName,
      };
      localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(registration));
      setSavedRegistration(registration);
      setAccess(accessToken);
      setStatus("Payment submitted. Pending verification.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setBusy(false);
      setUploadStep(null);
    }
  }

  function registerAnotherPerson() {
    localStorage.removeItem(REGISTRATION_STORAGE_KEY);
    setSavedRegistration(null);
    setAccess("");
    setStatus("");
    setError("");
    setName("");
    setEmail("");
    setPhone("");
    setTicketType("General Admission");
    setMethod("jazzcash");
    setFileName("");
    setScreenshot(null);
    setApproved(false);
    if (screenshotInput.current) screenshotInput.current.value = "";
  }

  return <main className="site-wrap">
    {approved && <div className="result-screen"><div><div className="result-icon">✓</div><h1>Payment Verified</h1><p>Your Feast ticket is ready.</p></div></div>}
    <PublicNavbar />
    <section className="hero-band" id="about"><div className="hero-copy"><span className="eyebrow">One campus · One celebration</span><h1>{EVENT_CONFIG.name}</h1></div></section>
    <section className="register-layout" id="events">
      <div className="card form-card">
        <div className="section-heading"><span>Get Your Ticket</span></div>
        <form className="form" method="post" action="/api/register" encType="multipart/form-data" onSubmit={submit}>
          <div className="field"><label htmlFor="name">Full Name</label><input id="name" name="name" value={name} onChange={event => setName(event.target.value)} placeholder="Enter your full name" required minLength={2} maxLength={120}/></div>
          <div className="field"><label htmlFor="email">Email Address</label><input id="email" name="email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Enter your email" required/></div>
          <div className="field"><label htmlFor="phone">Phone Number</label><input id="phone" name="phone" value={phone} onChange={event => setPhone(event.target.value)} inputMode="tel" placeholder="Enter your phone number" required/></div>
          <div className="field"><label htmlFor="ticketType">Ticket Fee</label><select id="ticketType" name="ticketType" value={ticketType} onChange={event => setTicketType(event.target.value)}><option value="General Admission">PKR {EVENT_CONFIG.price}</option></select></div>
          <div className="field"><label>Payment Method</label><div className="payment-options">{choices.map(option => <label className={`payment-choice ${method === option.id ? "chosen" : ""}`} key={option.id}><input type="radio" name="paymentMethod" value={option.id} checked={method === option.id} onChange={() => setMethod(option.id)}/><span className="method-icon">{option.id === "bank_transfer" ? "▤" : "◉"}</span>{option.name}</label>)}</div></div>
          <div className="account-box"><div><b>Send PKR {EVENT_CONFIG.price}</b><span>{selected.title || selected.name}</span>{selected.account && <strong>{selected.account}</strong>}</div></div>
          <div className="field"><label htmlFor="screenshot">Payment Screenshot</label><input ref={screenshotInput} id="screenshot" name="screenshot" type="file" accept="image/png,image/jpeg,image/webp" required={!savedRegistration} disabled={!!savedRegistration} onChange={event => { const file = event.target.files?.[0] || null; setScreenshot(file); setFileName(file?.name || ""); }}/><small className="fine">PNG, JPG or WebP · Max 4 MB{fileName ? ` · ${fileName}` : ""}</small></div>
          <button className="btn full" disabled={busy || !!access || !restoreReady}>{busy ? <><span className="spinner"/> {uploadStep === "compressing" ? "Compressing..." : uploadStep === "uploading" ? "Uploading..." : "Submitting..."}</> : "Proceed to Payment →"}</button>
        </form>
        {error && <div className="error form-feedback" role="alert">{error}</div>}
        {status && <div className={status.startsWith("Payment rejected") ? "error form-feedback" : "success-note form-feedback"} role="status">{status}</div>}
        {savedRegistration && <button type="button" className="btn light full" onClick={registerAnotherPerson}>Register another person</button>}
      </div>
      <aside className="event-side">
        <div className="event-fact"><b>⌖</b><div><small>Venue</small><strong>{EVENT_CONFIG.venue}</strong></div></div>
        <div className="event-fact"><b>▣</b><div><small>Date</small><strong>{EVENT_CONFIG.date}</strong></div></div>
      </aside>
    </section>

  </main>;
}
