"use client";

import { FormEvent, useState } from "react";

type Profile = { name: string; email: string; isCurrent: boolean };

export default function AdminProfiles({ accounts }: { accounts: Profile[] }) {
  const [editing, setEditing] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function openEditor(email: string) {
    setEditing(editing === email ? "" : email);
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setMessage(""); setError("");
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    if (newPassword !== confirmPassword) { setError("The new password and confirmation do not match."); return; }
    if (newPassword.length < 10) { setError("Choose a password with at least 10 characters."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetEmail: editing, currentPassword, newPassword }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Password update failed.");
      setMessage("Password updated. The new password will be used on the next sign-in.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Password update failed."); }
    finally { setBusy(false); }
  }

  if (!accounts.length) return <section className="card"><p className="error">Admin profiles are not configured in ADMIN_ACCOUNTS.</p></section>;
  return <div className="admin-profile-grid">
    {accounts.map(profile => <section className="card admin-profile-card" key={profile.email}>
      <div className="admin-profile-heading"><span className="admin-profile-avatar">{profile.name.split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase()}</span><div><span className="eyebrow">{profile.isCurrent ? "Signed in" : "Administrator"}</span><h2>{profile.name}</h2><p>{profile.email}</p></div></div>
      <button className="btn light full admin-password-toggle" type="button" onClick={() => openEditor(profile.email)}>{editing === profile.email ? "Close password form" : `Change ${profile.isCurrent ? "my" : "this admin’s"} password`}</button>
      {editing === profile.email && <form className="form admin-password-form" onSubmit={changePassword}>
        <p className="fine">Confirm your current signed-in admin password to authorize this change.</p>
        <div className="field"><label htmlFor={`current-${profile.email}`}>Your current password</label><input id={`current-${profile.email}`} type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required/></div>
        <div className="field"><label htmlFor={`new-${profile.email}`}>New password for {profile.name.split(" ")[0]}</label><input id={`new-${profile.email}`} type="password" autoComplete="new-password" minLength={10} value={newPassword} onChange={event => setNewPassword(event.target.value)} required/><small className="fine">Use at least 10 characters.</small></div>
        <div className="field"><label htmlFor={`confirm-${profile.email}`}>Confirm new password</label><input id={`confirm-${profile.email}`} type="password" autoComplete="new-password" minLength={10} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required/></div>
        {error && <p className="error" role="alert">{error}</p>}{message && <p className="success-note" role="status">{message}</p>}
        <button className="btn full" type="submit" disabled={busy}>{busy ? "Updating password..." : "Save password"}</button>
      </form>}
    </section>)}
  </div>;
}
