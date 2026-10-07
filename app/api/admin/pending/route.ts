import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";

export async function GET() {
  try {
    await requireAdmin();
    const s = db();
    const data: any[] = [];
    for (let from = 0; ; from += 1000) {
      const page = await s.from("tickets").select("id,name,email,phone,ticket_type,amount_due,payment_method,payment_screenshot_path,created_at")
        .eq("payment_status", "pending").not("payment_screenshot_path", "is", null)
        .order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, from + 999);
      if (page.error) throw page.error;
      data.push(...(page.data || []));
      if (!page.data || page.data.length < 1000) break;
    }
    const requests = await Promise.all(data.map(async ticket => {
      const { data: link } = await s.storage.from("payment-proofs").createSignedUrl(ticket.payment_screenshot_path, 300);
      return { ...ticket, payment_screenshot_path: undefined, screenshotUrl: link?.signedUrl || null };
    }));
    return NextResponse.json({ requests });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Could not load payment requests" }, { status: 500 });
  }
}
