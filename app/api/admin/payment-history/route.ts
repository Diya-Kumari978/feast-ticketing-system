import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const params = new URL(req.url).searchParams;
    const q = params.get("q")?.trim().replace(/[,%()]/g, " ");
    const filter = params.get("status");
    const s = db();
    const tickets: any[] = [];
    for (let from = 0; ; from += 1000) {
      let query = s.from("tickets").select(
        "id,name,email,phone,amount_due,payment_status,status,payment_screenshot_path,payment_rejection_reason,created_at,used_at,checked_in_by",
      ).order("created_at", { ascending: false }).order("id", { ascending: true }).range(from, from + 999);
      if (filter === "pending") query = query.eq("payment_status", "pending");
      if (filter === "approved") query = query.eq("payment_status", "confirmed");
      if (filter === "rejected") query = query.eq("payment_status", "failed");
      if (filter === "used") query = query.eq("status", "used");
      if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      tickets.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    const ids = tickets.map(ticket => ticket.id);
    if (!ids.length) return NextResponse.json({ payments: [] });

    const reviewByTicket = new Map<string, { reviewed_by: string; reason: string; created_at: string }>();
    for (let i = 0; i < ids.length; i += 500) {
      const batch = ids.slice(i, i + 500);
      const [reviewsResult, manualResult] = await Promise.all([
        s.from("payment_reviews").select("ticket_id,reviewed_by,reason,created_at").in("ticket_id", batch).order("created_at", { ascending: false }),
        s.from("manual_approvals").select("ticket_id,approved_by,reason,created_at").in("ticket_id", batch).order("created_at", { ascending: false }),
      ]);
      if (reviewsResult.error) throw reviewsResult.error;
      if (manualResult.error) throw manualResult.error;
      for (const row of [...(reviewsResult.data || []), ...(manualResult.data || []).map((r: any) => ({ ...r, reviewed_by: r.approved_by }))]) {
        if (!reviewByTicket.has(row.ticket_id)) reviewByTicket.set(row.ticket_id, row);
      }
    }

    const payments = await Promise.all(tickets.map(async (ticket: any) => {
      const { data: reviewProof } = ticket.payment_screenshot_path
        ? await s.storage.from("payment-proofs").createSignedUrl(ticket.payment_screenshot_path, 300)
        : { data: null };
      const review = reviewByTicket.get(ticket.id);
      const status = ticket.status === "used" ? "approved / used"
        : ticket.payment_status === "confirmed" ? "approved"
        : ticket.payment_status === "failed" ? "rejected" : "pending";
      return {
        id: ticket.id, name: ticket.name, phone: ticket.phone, amount: ticket.amount_due,
        status, screenshotUrl: reviewProof?.signedUrl || null,
        reviewedBy: review?.reviewed_by || null,
        reason: review?.reason || ticket.payment_rejection_reason || null,
        createdAt: ticket.created_at, reviewedAt: review?.created_at || null,
        usedAt: ticket.used_at, checkedInBy: ticket.checked_in_by,
      };
    }));
    return NextResponse.json({ payments });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Payment history failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Could not load payment history" }, { status: 500 });
  }
}
