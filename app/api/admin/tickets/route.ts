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
      let query = db().from("tickets").select("id,name,email,phone,ticket_type,amount_due,payment_status,payment_method,status,created_at,used_at,checked_in_by").order("created_at", { ascending: false }).order("id", { ascending: true }).range(from, from + 999);
      if (filter === "pending") query = query.eq("payment_status", "pending");
      if (filter === "valid") query = query.eq("payment_status", "confirmed").eq("status", "valid");
      if (filter === "used") query = query.eq("status", "used");
      if (filter === "confirmed") query = query.eq("payment_status", "confirmed");
      if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
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
