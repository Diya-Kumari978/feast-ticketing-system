"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import EVENT_CONFIG from "@/lib/event-config";

type TicketMatch = { id: string; name: string; email: string; phone: string; status: string; qr_token: string };
type Outcome = { result: string; ticket?: { name: string; ticket_type: string; id: string; used_at: string; checked_in_by: string } };

export default function Scanner() {
  const scanner = useRef<any>(null);
  const [active, setActive] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<TicketMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [checking, setChecking] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [cameraMessage, setCameraMessage] = useState("");

  const submitToken = useCallback(async (token: string) => {
    setChecking(true);
    try {
      const response = await fetch("/api/admin/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Scan failed");
      setOutcome(result);
      const context = new AudioContext(), oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.connect(gain); gain.connect(context.destination); oscillator.frequency.value = result.result === "valid" ? 880 : 260;
      gain.gain.setValueAtTime(.12, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .3);
      oscillator.start(); oscillator.stop(context.currentTime + .3);
      navigator.vibrate?.(result.result === "valid" ? 120 : [100, 70, 100]);
    } catch (error) {
      setCameraMessage(error instanceof Error ? error.message : "Scan failed.");
    } finally {
      setChecking(false);
    }
  }, []);

  const stopCamera = useCallback(async () => {
    const current = scanner.current;
    scanner.current = null;
    try { if (current?.isScanning) await current.stop(); } catch {}
    try { await current?.clear(); } catch {}
    setActive(false);
  }, []);

  async function startCamera() {
    setCameraMessage(""); setOutcome(null);
    if (!window.isSecureContext) {
      setCameraMessage("Camera needs a secure (https) connection or permission. (InsecureContextError)");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage("Camera needs a secure (https) connection or permission. (NotSupportedError)");
      return;
    }
    try {
      // Request camera access directly from the user tap, preferring the rear lens.
      const permissionStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      const deviceId = permissionStream.getVideoTracks()[0]?.getSettings().deviceId;
      permissionStream.getTracks().forEach(track => track.stop());
      const { Html5Qrcode } = await import("html5-qrcode");
      const reader = new Html5Qrcode("feast-reader");
      scanner.current = reader;
      await reader.start(deviceId || { facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, (text: string) => {
        void stopCamera().then(() => submitToken(text));
      }, () => {});
      setActive(true);
    } catch (error) {
      await stopCamera();
      const detail = error instanceof Error ? `${error.name} ${error.message}` : String(error);
      const match = detail.match(/NotAllowedError|NotFoundError|NotReadableError|OverconstrainedError|SecurityError/i);
      const name = match?.[0] || (window.isSecureContext ? "CameraError" : "InsecureContextError");
      setCameraMessage(`Camera needs a secure (https) connection or permission. (${name})`);
    }
  }

  useEffect(() => () => { void stopCamera(); }, [stopCamera]);

  async function scanPhoto(file?: File) {
    if (!file) return;
    await stopCamera();
    setCameraMessage("Checking QR photo…"); setOutcome(null);
    let imageScanner: any;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      imageScanner = new Html5Qrcode("feast-photo-reader");
      const token = await imageScanner.scanFile(file, false);
      await imageScanner.clear();
      setCameraMessage("");
      await submitToken(token);
    } catch {
      try { await imageScanner?.clear(); } catch {}
      setCameraMessage("No QR code could be read from that photo.");
    }
  }

  async function searchNow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    if (!query) { setMatches([]); setSearchMessage("Enter a name, email, or phone number."); return; }
    setSearching(true); setSearchMessage(""); setMatches([]);
    try {
      const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Search failed.");
      const tickets = Array.isArray(result.tickets) ? result.tickets as TicketMatch[] : [];
      setMatches(tickets);
      if (!tickets.length) setSearchMessage("No confirmed ticket found.");
    } catch (error) {
      setSearchMessage(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function manualCheck(ticket: TicketMatch) {
    await stopCamera(); setOutcome(null); await submitToken(ticket.qr_token);
  }

  return <>
    <h1 style={{ marginTop: 0 }}>Scan Ticket</h1>
    <p className="muted">Scan a {EVENT_CONFIG.name} QR using the rear camera. One QR allows one entry.</p>
    <div className="card scanner-box">
      <div className="camera-view"><div id="feast-reader" className="camera-reader"/><div id="feast-photo-reader" className="visually-hidden"/>{!active && <div className="camera-placeholder">Allow camera access to scan.</div>}</div>
      <div className="camera-actions">{!active ? <button type="button" className="btn" onClick={startCamera}>Start camera</button> : <button type="button" className="btn light" onClick={() => void stopCamera()}>Stop camera</button>}</div>
      <div className="field photo-scan"><label htmlFor="qr-photo">Scan a QR from a photo</label><input id="qr-photo" type="file" accept="image/*" capture="environment" onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ""; void scanPhoto(file); }}/></div>
      {cameraMessage && <p className="error" role="alert">{cameraMessage}</p>}
      {checking && <p className="muted" role="status">Checking ticket...</p>}
      <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "22px 0" }}/>
      <h2>Manual search</h2>
      <form className="toolbar" onSubmit={searchNow}>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, email, or phone" aria-label="Search name, email, or phone" />
        <button type="submit" className="btn" disabled={searching}>{searching ? <><span className="spinner"/> Searching...</> : "Search"}</button>
      </form>
      {searchMessage && <p className={searchMessage.startsWith("No confirmed") ? "muted" : "error"} role="status">{searchMessage}</p>}
      {matches.map(ticket => <div className="scanner-match" key={ticket.id}>
        <span><b>{ticket.name}</b><br/><small className="muted">{ticket.email} · {ticket.phone} · {ticket.status}</small></span>
        {ticket.status === "valid" && <button type="button" className="btn" onClick={() => void manualCheck(ticket)}>Check in</button>}
      </div>)}
    </div>
    {outcome && <div className={`result-screen ${outcome.result === "valid" ? "" : outcome.result === "already_used" ? "bad" : "invalid"}`}>
      <div><div style={{ fontSize: 64 }}>{outcome.result === "valid" ? "✓" : "×"}</div>
        <h1>{outcome.result === "valid" ? "VALID TICKET" : outcome.result === "already_used" ? "REJECTED — Already Used" : "INVALID TICKET — Not issued by our system"}</h1>
        {outcome.result !== "invalid" && <div><p>{outcome.ticket?.name}</p><p>Ticket Type: {outcome.ticket?.ticket_type}</p><p>Order ID: {EVENT_CONFIG.ticketPrefix}-{outcome.ticket?.id.slice(0, 8).toUpperCase()}</p><p>{outcome.result === "valid" ? "Check-in time" : "First check-in"}: {outcome.ticket?.used_at ? new Date(outcome.ticket.used_at).toLocaleString() : ""}</p><p>{outcome.result === "valid" ? "Marked as Used" : `Scanned by ${outcome.ticket?.checked_in_by}`}</p></div>}
        <button className="btn light" onClick={() => { setOutcome(null); setCameraMessage(""); void startCamera(); }}>Scan next</button>
      </div>
    </div>}
  </>;
}
