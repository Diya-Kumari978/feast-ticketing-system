import { after, NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth";
import { paymentReviewSchema } from "@/lib/validation";
import { db } from "@/lib/supabase";
import { notifyAdminsOfReviewedPayment, notifyParticipantApproved, notifyParticipantRejected } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const started = performance.now();
  const json = (body: unknown, status = 200) => {
    const response = NextResponse.json(body, { status });
    response.headers.set("Server-Timing", `approve;dur=${(performance.now() - started).toFixed(1)}`);
    return response;
  };
  try {
    const admin = await getAdmin();
    if (!admin) return json({ error: "Unauthorized" }, 401);
    const parsed = paymentReviewSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Choose approve or reject and enter a reason." }, 400);

    const { ticketId, decision, reason } = parsed.data;
    // This RPC commits the status transition and (on approval) QR token in one atomic DB call.
    const { data, error } = await db().rpc("review_payment", {
      p_ticket_id: ticketId,
      p_admin: admin.name,
      p_decision: decision,
      p_reason: reason,
    });
    if (error) throw error;
    if (!data?.ok || !data.ticket) return json({ error: "This request is no longer pending or has no payment proof." }, 409);

    const ticket = data.ticket;
    // The database review has committed. Deliver notices after responding so provider delays cannot block approval.
    after(async () => {
      try {
        if (decision === "approved") {
          const emailSent = await notifyParticipantApproved(ticket);
          if (emailSent) {
            const { error: markError } = await db().from("tickets").update({ email_sent_at: new Date().toISOString() }).eq("id", ticketId).is("email_sent_at", null);
            if (markError) console.error("Could not record ticket email delivery status", markError.message);
          }
        } else {
          await notifyParticipantRejected(ticket, reason);
        }
        await notifyAdminsOfReviewedPayment(ticket, decision, admin.email, reason);
      } catch (error) {
        console.error("Post-review notifications failed", error instanceof Error ? error.message : "unknown error");
      }
    });
    return json({ ok: true, status: ticket.payment_status });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ error: "Unauthorized" }, 401);
    console.error("Payment review failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Could not save payment review" }, 500);
  }
}
