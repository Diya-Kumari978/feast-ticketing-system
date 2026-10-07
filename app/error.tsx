"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="error-page"><div className="error-card card">
    <span className="error-code">A LITTLE GLITCH</span>
    <h1>That didn’t load.</h1>
    <p>Your information is safe. Try this page again.</p>
    <button className="btn" type="button" onClick={reset}>Retry</button>
  </div></main>;
}
