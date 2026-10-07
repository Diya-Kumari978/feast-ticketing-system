import { NextResponse } from "next/server";
import { byAccess, makeQrDataUrl } from "@/lib/tickets";
import EVENT_CONFIG from "@/lib/event-config";

export async function GET(_req: Request, { params }: { params: Promise<{ access: string }> }) {
  const started = performance.now();
  const json = (body: unknown, status = 200) => {
    const response = NextResponse.json(body, { status });
    response.headers.set("Server-Timing", `ticket;dur=${(performance.now() - started).toFixed(1)}`);
    return response;
  };

  try {
    const { access } = await params;
    if (!/^[a-f0-9]{64}$/.test(access)) return json({ error: "Not found" }, 404);
    const { data, error } = await byAccess(access);
    if (error || !data) return json({ error: "Not found" }, 404);

    const base = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      ticketType: data.ticket_type || "General Admission",
      amountDue: data.amount_due || EVENT_CONFIG.price,
      paymentMethod: data.payment_method,
      orderId: `${EVENT_CONFIG.ticketPrefix}-${String(data.id).slice(0, 8).toUpperCase()}`,
      rejectionReason: data.payment_rejection_reason || null,
    };
    if (data.payment_status === "confirmed" && data.status === "used") {
      return json({ status: "used", ...base, usedAt: data.used_at });
    }
    if (data.payment_status !== "confirmed" || !data.qr_token) {
      return json({ status: data.payment_status, ...base });
    }

    // The QR image is generated on demand. The QR token itself is created atomically by review_payment.
    return json({ status: "confirmed", ...base, qr: await makeQrDataUrl(data.qr_token) });
  } catch {
    return json({ error: "Could not load ticket" }, 500);
  }
}
