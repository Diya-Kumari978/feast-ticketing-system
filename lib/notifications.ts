import EVENT_CONFIG from "@/lib/event-config";
import { escapeNotificationHtml, sendAdminNotice, sendHtmlEmail, sendTicketEmail, siteUrl } from "@/lib/email";
import { isExcludedAdminEmail } from "@/lib/admin-accounts";

type NoticeTicket = {
  id: string;
  name: string;
  roll_number?: string | null;
  email: string;
  phone: string;
  amount_due?: number | null;
  access_token: string;
  qr_token?: string | null;
  payment_rejection_reason?: string | null;
  created_at?: string;
};

function adminRecipients() {
  const emails = [...new Set((process.env.ADMIN_NOTIFY_EMAILS || "").split(",").map(value => value.trim().toLowerCase()).filter(value => Boolean(value) && !isExcludedAdminEmail(value)))];
  return { emails };
}

function requestLinks(id: string) {
  const base = siteUrl();
  if (!base) return null;
  const path = `/admin/requests/${encodeURIComponent(id)}`;
  return { review: `${base}/admin/login?next=${encodeURIComponent(path)}`, direct: `${base}${path}` };
}

function escaped(value: string) { return escapeNotificationHtml(value || "—"); }

function adminEmail(title: string, intro: string, rows: Array<[string, string]>, actionUrl: string, actionLabel: string) {
  const details = rows.map(([label, value]) => `<tr><td style="padding:10px 12px;border-bottom:1px solid #e8edf4;color:#66758b;width:38%">${escaped(label)}</td><td style="padding:10px 12px;border-bottom:1px solid #e8edf4;color:#172b4d;font-weight:600">${value}</td></tr>`).join("");
  return `<div style="margin:0;background:#f2f5fa;padding:28px 12px;font-family:Arial,sans-serif;color:#172b4d"><div style="max-width:640px;margin:auto;background:#fff;border:1px solid #dce4ef;border-radius:16px;overflow:hidden"><div style="background:#173b72;padding:22px 28px;color:#fff"><div style="font-size:12px;letter-spacing:1.5px;font-weight:bold;color:#c9dcff">FEAST 2026 · ADMIN NOTIFICATION</div><h1 style="margin:10px 0 0;font-size:24px">${escaped(title)}</h1></div><div style="padding:25px 28px"><p style="margin:0 0 18px;line-height:1.6">${escaped(intro)}</p><table role="presentation" style="width:100%;border-collapse:collapse;background:#fbfcfe;border:1px solid #e8edf4;border-radius:10px">${details}</table><p style="margin:24px 0"><a href="${escaped(actionUrl)}" style="display:inline-block;background:#245ac7;color:#fff;text-decoration:none;padding:13px 21px;border-radius:9px;font-weight:bold">${escaped(actionLabel)}</a></p><p style="font-size:13px;line-height:1.6;color:#52627a">Please verify the payment against the real account history before approving. A screenshot alone does not confirm payment.</p></div><div style="padding:15px 28px;background:#f7f9fc;color:#65748a;font-size:12px">Automated operational notice · ${escaped(EVENT_CONFIG.name)} · ${escaped(EVENT_CONFIG.venue)}</div></div></div>`;
}

export async function notifyAdminsOfPendingPayment(ticket: NoticeTicket) {
  const { emails } = adminRecipients();
  if (!emails.length) { console.warn("Pending payment notification skipped: configure ADMIN_NOTIFY_EMAILS."); return; }
  const links = requestLinks(ticket.id);
  if (!links) { console.warn("Pending payment notification skipped: set SITE_URL to an absolute app URL."); return; }
  const amount = ticket.amount_due ?? EVENT_CONFIG.price;
  const submitted = ticket.created_at ? new Date(ticket.created_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" }) : "Just received";
  const html = adminEmail("Payment review requested", `A participant uploaded a payment receipt. The required ticket fee is PKR ${amount}; this is not an amount read from the receipt. Open the secure review page to inspect the screenshot and compare its amount and transaction reference with the JazzCash account history before deciding.`, [
    ["Request reference", escaped(ticket.id.slice(0, 8).toUpperCase())], ["Participant", escaped(ticket.name)],
    ["Roll number", escaped(ticket.roll_number || "—")], ["Phone", escaped(ticket.phone)],
    ["Email", escaped(ticket.email)], ["Required ticket fee", `PKR ${amount}`],
    ["Payment proof", `<a href="${escaped(links.review)}" style="color:#245ac7;font-weight:bold">Open uploaded screenshot and review</a>`],
    ["Received", escaped(submitted)],
  ], links.review, "Review payment request");
  await sendAdminNotice(emails, `Action required | Payment review request ${ticket.id.slice(0, 8).toUpperCase()}`, html, `Payment review requested for ${ticket.name} (${ticket.roll_number || "no roll number"}), ${ticket.phone}, ${ticket.email}, PKR ${amount}. Verify the real account history, then review: ${links.review}`);
}

export async function notifyAdminsOfReviewedPayment(ticket: NoticeTicket, decision: "approved" | "rejected", reviewerEmail: string, reason: string) {
  const { emails } = adminRecipients();
  const otherAdmins = emails.filter(email => email !== reviewerEmail.trim().toLowerCase());
  if (!otherAdmins.length) { console.warn("Admin review notification skipped: no other configured admin recipients."); return; }
  const links = requestLinks(ticket.id);
  if (!links) { console.warn("Admin review notification skipped: set SITE_URL to an absolute app URL."); return; }
  const outcome = decision === "approved" ? "approved" : "rejected";
  const rows: Array<[string, string]> = [["Request reference", escaped(ticket.id.slice(0, 8).toUpperCase())], ["Participant", escaped(ticket.name)], ["Roll number", escaped(ticket.roll_number || "—")], ["Decision", escaped(outcome)], ["Reviewed by", escaped(reviewerEmail)]];
  if (decision === "rejected") rows.push(["Review note", escaped(reason)]);
  const html = adminEmail(`Request ${outcome}`, `This payment request has been ${outcome}. This notice keeps the review team aligned and helps prevent duplicate decisions.`, rows, links.direct, "View request record");
  await sendAdminNotice(otherAdmins, `Update | Payment request ${outcome} ${ticket.id.slice(0, 8).toUpperCase()}`, html, `${ticket.name} (${ticket.roll_number || "no roll number"}) was ${outcome} by ${reviewerEmail}.${decision === "rejected" ? ` Reason: ${reason}` : ""} Request record: ${links.direct}`);
}

export async function notifyParticipantApproved(ticket: NoticeTicket) {
  return sendTicketEmailSafely(ticket);
}

async function sendTicketEmailSafely(ticket: NoticeTicket) {
  try {
    return await sendTicketEmail(ticket);
  } catch (error) {
    console.error("Approved ticket email failed", error instanceof Error ? error.message : "unknown error");
    return false;
  }
}

export async function notifyParticipantRejected(ticket: NoticeTicket, reason: string) {
  const base = siteUrl();
  const reasonText = reason.trim().slice(0, 240) || "Please contact the Feast team for details.";
  const url = base ? `${base}/ticket/${encodeURIComponent(ticket.access_token)}` : "";
  const html = `<div style="margin:0;background:#f2f5fa;padding:28px 12px;font-family:Arial,sans-serif;color:#172b4d"><div style="max-width:600px;margin:auto;background:#fff;border:1px solid #dce4ef;border-radius:16px;overflow:hidden"><div style="background:#173b72;padding:22px 28px;color:#fff"><div style="font-size:12px;letter-spacing:1.5px;font-weight:bold;color:#c9dcff">FEAST 2026 · PAYMENT UPDATE</div><h1 style="margin:10px 0 0;font-size:24px">Please review your payment proof</h1></div><div style="padding:25px 28px"><p>Hello ${escaped(ticket.name)},</p><p>We could not approve the payment proof for your Feast ticket. Please review the note below and submit corrected proof from your ticket page.</p><div style="padding:15px 17px;border-left:4px solid #d97706;background:#fff8e8;border-radius:7px"><b>Review note</b><p style="margin:7px 0 0">${escaped(reasonText)}</p></div>${url ? `<p style="margin:24px 0"><a href="${escaped(url)}" style="display:inline-block;background:#245ac7;color:#fff;text-decoration:none;padding:13px 21px;border-radius:9px;font-weight:bold">Open payment status</a></p>` : ""}<p style="font-size:13px;line-height:1.6;color:#52627a">If you believe this decision is incorrect, please contact the Feast organizing team.</p></div><div style="padding:15px 28px;background:#f7f9fc;color:#65748a;font-size:12px">${escaped(EVENT_CONFIG.name)} · ${escaped(EVENT_CONFIG.venue)}</div></div></div>`;
  await sendHtmlEmail(ticket.email, `${EVENT_CONFIG.name} | Payment proof needs review`, html, undefined, `Hello ${ticket.name}, we could not approve the payment proof for your Feast ticket. Review note: ${reasonText}.${url ? ` Update your proof here: ${url}` : ""}`);
}
