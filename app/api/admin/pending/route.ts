import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";

const PAGE_SIZE = 25;

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const params = new URL(req.url).searchParams;
    const requestedPage = Number(params.get("page") || 1);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const s = db();
    const { data, error } = await s.from("tickets").select("id,name,email,phone,roll_number,amount_due,payment_screenshot_path,created_at")
      .eq("payment_status", "pending").not("payment_screenshot_path", "is", null)
      .order("created_at", { ascending: true }).order("id", { ascending: true })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    if (error) throw error;
    const rows = data || [];
    const hasMore = rows.length > PAGE_SIZE;
    const requests = rows.slice(0, PAGE_SIZE).map((ticket: any) => ({ ...ticket, payment_screenshot_path: undefined, hasScreenshot: Boolean(ticket.payment_screenshot_path) }));
    return NextResponse.json({ requests, page, hasMore }, { headers: { "Cache-Control": "private, max-age=3, stale-while-revalidate=10" } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Could not load payment requests" }, { status: 500 });
  }
}
