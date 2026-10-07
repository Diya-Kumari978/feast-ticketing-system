import { Resend } from "resend";
import EVENT_CONFIG from "@/lib/event-config";

export async function sendTicketEmail(ticket: { name: string; email: string; access_token: string }) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return false;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({ from: process.env.EMAIL_FROM, to: ticket.email, subject: `${EVENT_CONFIG.name} ticket`, html: `<h1>${EVENT_CONFIG.name} ticket</h1><p>Hello ${escapeHtml(ticket.name)}, your payment is confirmed.</p><p>Your QR ticket is ready. Open it here:</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/ticket/${encodeURIComponent(ticket.access_token)}">View your ticket and QR code</a></p>` });
  if (result.error) throw new Error("Ticket email could not be delivered");
  return true;
}

export async function sendPaymentRejectedEmail(ticket: { name: string; email: string; access_token: string }, reason: string) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return false;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({ from: process.env.EMAIL_FROM, to: ticket.email, subject: `Update on your ${EVENT_CONFIG.name} payment`, html: `<h1>Payment not approved</h1><p>Hello ${escapeHtml(ticket.name)},</p><p>We could not confirm your ${EVENT_CONFIG.name} payment.</p><p><b>Organizer reason:</b> ${escapeHtml(reason)}</p><p>Check the payment details and submit a corrected receipt at <a href="${process.env.NEXT_PUBLIC_SITE_URL}">the registration page</a>.</p><p>Your status page: <a href="${process.env.NEXT_PUBLIC_SITE_URL}/ticket/${encodeURIComponent(ticket.access_token)}">view payment status</a>.</p>` });
  if (result.error) throw new Error("Payment rejection email could not be delivered");
  return true;
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }
