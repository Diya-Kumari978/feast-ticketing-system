import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const params = new URL(req.url).searchParams;
    const filter = params.get("status");
    const q = params.get("q")?.trim().replace(/[,%()]/g, " ");
    const rows: Record<string, unknown>[] = [];

    for (let from = 0; ; from += 1000) {
      let query = db().from("tickets").select("id,name,email,phone,roll_number,amount_due,payment_status,status,created_at,used_at,checked_in_by,payment_rejection_reason,payment_screenshot_path").order("created_at", { ascending: false }).order("id", { ascending: true }).range(from, from + 999);
      if (filter === "pending") query = query.eq("payment_status", "pending");
      if (filter === "valid") query = query.eq("payment_status", "confirmed").eq("status", "valid");
      if (filter === "used") query = query.eq("status", "used");
      if (filter === "confirmed") query = query.eq("payment_status", "confirmed");
      if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,roll_number.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }

    const s = db();
    const ticketIds = rows.map(row => row.id as string);
    const reviewByTicket = new Map<string, { reviewed_by: string; reason: string; created_at: string }>();
    for (let i = 0; i < ticketIds.length; i += 500) {
      const { data, error } = await s.from("payment_reviews").select("ticket_id,reviewed_by,reason,created_at").in("ticket_id", ticketIds.slice(i, i + 500)).order("created_at", { ascending: false });
      if (error) throw error;
      for (const review of data || []) if (!reviewByTicket.has(review.ticket_id)) reviewByTicket.set(review.ticket_id, review);
    }
    for (const row of rows) {
      const review = reviewByTicket.get(row.id as string);
      row.reviewed_by = review?.reviewed_by || row.checked_in_by || null;
      row.review_reason = review?.reason || row.payment_rejection_reason || null;
      if (row.payment_screenshot_path) {
        const { data } = await s.storage.from("payment-proofs").createSignedUrl(row.payment_screenshot_path as string, 300);
        row.screenshot_url = data?.signedUrl || null;
      } else row.screenshot_url = null;
      delete row.payment_screenshot_path;
    }

    if (params.get("format") === "csv") {
      const cols = ["name", "email", "phone", "payment_status", "payment_method", "status", "created_at"];
      const csv = [cols.join(","), ...rows.map(row => cols.map(key => `"${String(row[key] ?? "").replaceAll('"', '""')}"`).join(","))].join("\r\n");
      return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=tickets.csv" } });
    }
    return NextResponse.json({ tickets: rows });
  } catch {
    return NextResponse.json({ error: "Could not load tickets" }, { status: 500 });
  }
}
