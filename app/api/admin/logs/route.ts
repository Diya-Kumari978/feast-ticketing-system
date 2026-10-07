import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const result = new URL(req.url).searchParams.get("result");
    const logs: Record<string, unknown>[] = [];
    for (let from = 0; ; from += 1000) {
      let query = db().from("scan_logs").select("id,scanned_token,result,scanned_by,scanned_at,tickets(name)").order("scanned_at", { ascending: false }).order("id", { ascending: true }).range(from, from + 999);
      if (result === "attempted" || result === "invalid") query = query.in("result", ["invalid", "already_used"]);
      else if (result && ["valid", "already_used"].includes(result)) query = query.eq("result", result);
      const { data, error } = await query;
      if (error) throw error;
      logs.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json({ error: "Could not load logs" }, { status: 500 });
  }
}
