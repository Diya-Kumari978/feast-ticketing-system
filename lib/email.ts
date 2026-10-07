import nodemailer from "nodemailer";
import EVENT_CONFIG from "@/lib/event-config";

type TicketMail = {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  roll_number?: string | null;
  amount_due?: number | null;
  access_token: string;
  qr_token?: string | null;
};

type MailAttachment = { filename: string; content: Buffer; cid: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function siteUrl() {
  const value = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!value) return null;
  try { return new URL(value).toString().replace(/\/$/, ""); }
  catch { console.error("Notification channel skipped: SITE_URL must be an absolute URL."); return null; }
}

function createMailer() {
  const user = process.env.EMAIL_USER || process.env.GMAIL_USER;
  const pass = process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.warn("Email notification skipped: set EMAIL_USER and EMAIL_PASS in .env.local.");
    return null;
  }
  return { user, transport: nodemailer.createTransport({ service: "gmail", auth: { user, pass: pass.replace(/\s/g, "") } }) };
}

export async function sendHtmlEmail(to: string, subject: string, html: string, attachments?: MailAttachment[], text?: string) {
  const mailer = createMailer();
  if (!mailer) return false;
  try {
    await mailer.transport.sendMail({ from: { name: EVENT_CONFIG.name, address: mailer.user }, to, subject, html, text, attachments });
    return true;
  } catch (error) {
    console.error("Email notification failed", error instanceof Error ? error.message : "unknown error");
    return false;
  }
}

export async function sendTicketEmail(ticket: TicketMail) {
  const base = siteUrl();
  if (!base) { console.warn("Ticket email skipped: SITE_URL is not configured."); return false; }
  if (!ticket.qr_token) { console.warn("Ticket email skipped: approved ticket has no QR token."); return false; }
  const QRCode = (await import("qrcode")).default;
  const qrImage = await QRCode.toBuffer(ticket.qr_token, { type: "png", errorCorrectionLevel: "M", margin: 2, width: 360 });
  const url = `${base}/ticket/${encodeURIComponent(ticket.access_token)}`;
  const html = `<div style="margin:0;background:#f3f6fb;padding:28px 12px;font-family:Arial,sans-serif;color:#172b4d"><div style="max-width:600px;margin:auto;background:#fff;border:1px solid #dbe4f0;border-radius:16px;overflow:hidden"><div style="background:#173b72;padding:24px 28px;color:#fff"><div style="font-size:12px;letter-spacing:1.5px;font-weight:bold;color:#c9dcff">FEAST 2026 · MUET JAMSHORO</div><h1 style="margin:10px 0 0;font-size:25px">Your ticket is confirmed</h1></div><div style="padding:26px 28px"><p style="font-size:16px">Hello ${escapeHtml(ticket.name)},</p><p>Your payment has been verified and your entry ticket is ready. Keep this QR code available when you arrive.</p><div style="text-align:center;margin:22px 0"><img src="cid:feast-ticket-qr" width="260" height="260" alt="Your Feast entry QR code" style="display:inline-block;background:#fff;padding:12px;border:1px solid #e3eaf3;border-radius:12px"/></div><p style="text-align:center;margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#245ac7;color:#fff;text-decoration:none;padding:13px 22px;border-radius:9px;font-weight:bold">Open my ticket</a></p><p style="color:#52627a;font-size:13px">${escapeHtml(EVENT_CONFIG.date)} · ${escapeHtml(EVENT_CONFIG.venue)}<br/>One ticket admits one person. Do not share your QR code.</p></div><div style="padding:16px 28px;background:#f7f9fc;color:#65748a;font-size:12px">This is an automated ticket confirmation from ${escapeHtml(EVENT_CONFIG.name)}.</div></div></div>`;
  const text = `Hello ${ticket.name}, your payment for ${EVENT_CONFIG.name} has been verified. View your ticket and QR code: ${url}. Event date: ${EVENT_CONFIG.date}. Venue: ${EVENT_CONFIG.venue}. One ticket admits one person. Do not share your QR code.`;
  return sendHtmlEmail(ticket.email, `${EVENT_CONFIG.name} | Payment confirmed and ticket ready`, html, [{ filename: "feast-ticket-qr.png", content: qrImage, cid: "feast-ticket-qr" }], text);
}

export async function sendPaymentRejectedEmail(ticket: TicketMail, reason: string) {
  const base = siteUrl();
  if (!base) { console.warn("Rejection email skipped: SITE_URL is not configured."); return false; }
  const safeReason = escapeHtml(reason.slice(0, 500));
  const url = `${base}/ticket/${encodeURIComponent(ticket.access_token)}`;
  const html = `<div style="margin:0;background:#f3f6fb;padding:28px 12px;font-family:Arial,sans-serif;color:#172b4d"><div style="max-width:600px;margin:auto;background:#fff;border:1px solid #dbe4f0;border-radius:16px;overflow:hidden"><div style="background:#173b72;padding:22px 28px;color:#fff"><div style="font-size:12px;letter-spacing:1.5px;font-weight:bold;color:#c9dcff">FEAST 2026 · MUET JAMSHORO</div><h1 style="margin:10px 0 0;font-size:24px">Payment proof needs attention</h1></div><div style="padding:26px 28px"><p>Hello ${escapeHtml(ticket.name)},</p><p>We could not approve the payment proof submitted for your Feast ticket.</p><div style="padding:15px 17px;border-left:4px solid #d97706;background:#fff8e8;border-radius:7px"><b>Review note</b><p style="margin:7px 0 0">${safeReason}</p></div><p>Update your proof using the secure ticket page below. Your registration details remain saved.</p><p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#245ac7;color:#fff;text-decoration:none;padding:13px 22px;border-radius:9px;font-weight:bold">Review payment status</a></p><p style="color:#65748a;font-size:12px">If you believe this decision is incorrect, please contact the Feast organizing team.</p></div><div style="padding:16px 28px;background:#f7f9fc;color:#65748a;font-size:12px">${escapeHtml(EVENT_CONFIG.name)} · ${escapeHtml(EVENT_CONFIG.venue)}</div></div></div>`;
  const text = `Hello ${ticket.name}, your Feast payment proof was not approved. Review note: ${reason}. View your payment status and submit corrected proof: ${url}`;
  return sendHtmlEmail(ticket.email, `${EVENT_CONFIG.name} | Payment proof update`, html, undefined, text);
}

export async function sendAdminNotice(emails: string[], subject: string, html: string, text?: string) {
  if (!emails.length) { console.warn("Admin email notification skipped: ADMIN_NOTIFY_EMAILS has no recipients."); return; }
  const mailer = createMailer();
  if (!mailer) return;
  try {
    const result = await mailer.transport.sendMail({
      from: { name: EVENT_CONFIG.name, address: mailer.user },
      to: mailer.user,
      bcc: emails,
      subject,
      html,
      text,
    });
    if (result.rejected?.length) console.error("Admin notification rejected by mail server", result.rejected);
  } catch (error) {
    console.error("Admin email notification failed", error instanceof Error ? error.message : "unknown error");
  } finally {
    mailer.transport.close();
  }
}

export function escapeNotificationHtml(value: string) { return escapeHtml(value); }
