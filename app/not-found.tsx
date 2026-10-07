import Link from "next/link";
import EVENT_CONFIG from "@/lib/event-config";

export default function NotFound() {
  return <main className="error-page"><div className="error-card card">
    <span className="error-code">404 · LOST IN THE SNOW</span>
    <h1>That page isn’t here.</h1>
    <p>Let’s get you back to {EVENT_CONFIG.name}.</p>
    <Link className="btn" href="/">Back to the event</Link>
  </div></main>;
}
