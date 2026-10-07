import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";

const PAGE_SIZE = 25;

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const params = new URL(req.url).searchParams;
    const q = params.get("q")?.trim().replace(/[,%()]/g, " ");
    const filter = params.get("status");
    const requestedPage = Number(params.get("page") || 1);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const s = db();
    let query = s.from("tickets").select(
      "id,name,email,phone,roll_number,amount_due,payment_status,status,payment_screenshot_path,payment_rejection_reason,created_at,used_at,checked_in_by",
    ).order("created_at", { ascending: false }).order("id", { ascending: true }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    if (filter === "pending") query = query.eq("payment_status", "pending");
    if (filter === "approved") query = query.eq("payment_status", "confirmed");
    if (filter === "rejected") query = query.eq("payment_status", "failed");
    if (filter === "used") query = query.eq("status", "used");
    if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,roll_number.ilike.%${q}%`);
    const { data: tickets, error } = await query;
    if (error) throw error;
    const fetchedRows = tickets || [];
    const hasMore = fetchedRows.length > PAGE_SIZE;
    const rows = fetchedRows.slice(0, PAGE_SIZE);
    const ids = rows.map((ticket: any) => ticket.id);
    const [reviewsResult, manualResult] = ids.length ? await Promise.all([
      s.from("payment_reviews").select("ticket_id,reviewed_by,reason,created_at").in("ticket_id", ids).order("created_at", { ascending: false }),
      s.from("manual_approvals").select("ticket_id,approved_by,reason,created_at").in("ticket_id", ids).order("created_at", { ascending: false }),
    ]) : [{ data: [], error: null }, { data: [], error: null }];
    if (reviewsResult.error) throw reviewsResult.error;
    if (manualResult.error) throw manualResult.error;
    const reviewByTicket = new Map<string, { reviewed_by: string; reason: string; created_at: string }>();
    for (const row of [...(reviewsResult.data || []), ...(manualResult.data || []).map((r: any) => ({ ...r, reviewed_by: r.approved_by }))]) {
      if (!reviewByTicket.has(row.ticket_id)) reviewByTicket.set(row.ticket_id, row);
    }
    const payments = rows.map((ticket: any) => {
      const review = reviewByTicket.get(ticket.id);
      const status = ticket.status === "used" ? "approved / used"
        : ticket.payment_status === "confirmed" ? "approved"
        : ticket.payment_status === "failed" ? "rejected" : "pending";
      return {
        id: ticket.id, name: ticket.name, rollNumber: ticket.roll_number, phone: ticket.phone, amount: ticket.amount_due,
        status, hasScreenshot: Boolean(ticket.payment_screenshot_path), reviewedBy: review?.reviewed_by || null,
        reason: review?.reason || ticket.payment_rejection_reason || null,
        createdAt: ticket.created_at, reviewedAt: review?.created_at || null,
        usedAt: ticket.used_at, checkedInBy: ticket.checked_in_by,
      };
    });
    return NextResponse.json({ payments, page, pageSize: PAGE_SIZE, hasMore }, {
      headers: { "Cache-Control": "private, max-age=3, stale-while-revalidate=10" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Payment history failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Could not load payment history" }, { status: 500 });
  }
}
