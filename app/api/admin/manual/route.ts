import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { registrationSchema, reasonSchema } from "@/lib/validation";
import { sendTicketEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = await req.json() as { mode?: string; ticketId?: string; reason?: string; ticket?: unknown };
    const reason = reasonSchema.safeParse(body.reason);
    if (!reason.success) return NextResponse.json({ error: "Provide a reason (at least 5 characters)." }, { status: 400 });
    const s = db();

    if (body.mode === "create") {
      const parsed = registrationSchema.safeParse(body.ticket);
      if (!parsed.success) return NextResponse.json({ error: "Check the ticket details." }, { status: 400 });
      const v = parsed.data;
      const { data, error } = await s.rpc("create_manual_ticket", { p_name: v.name, p_email: v.email, p_phone: v.phone, p_organization: v.organization || "", p_admin: admin, p_reason: reason.data });
      if (error) {
        if (error.code === "23505") return NextResponse.json({ error: "Already registered" }, { status: 409 });
        throw error;
      }
      try { const sent=await sendTicketEmail(data); if(sent)await s.from("tickets").update({ email_sent_at: new Date().toISOString() }).eq("id", data.id); }
      catch { console.error("Manual ticket email delivery failed"); }
      return NextResponse.json({ ok: true });
    }

    if (body.mode === "resend" && body.ticketId) {
      const { data, error } = await s.from("tickets").select("*").eq("id", body.ticketId).eq("payment_status", "confirmed").single();
      if (error || !data) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      const {error:auditError}=await s.from("manual_approvals").insert({ticket_id:data.id,approved_by:admin,reason:`Resend ticket email: ${reason.data}`});
      if(auditError)throw auditError;
      await sendTicketEmail(data);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Manual action failed");
    return NextResponse.json({ error: "Manual action failed" }, { status: 500 });
  }
}
