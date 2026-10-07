import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";

const emptyStats = {
  valid: 0,
  used: 0,
  pending: 0,
  invalid: 0,
  total: 0,
  recentScans: [] as unknown[],
};

export async function GET() {
  try {
    await requireAdmin();
    const s = db();
    const fast = await s.rpc("admin_dashboard_stats");
    if (!fast.error && fast.data && typeof fast.data === "object") {
      const value = fast.data as Record<string, unknown>;
      return NextResponse.json({
        valid: Number(value.valid) || 0, used: Number(value.used) || 0,
        pending: Number(value.pending) || 0, invalid: Number(value.invalid) || 0,
        total: Number(value.total) || 0, recentScans: Array.isArray(value.recentScans) ? value.recentScans : [],
      }, { headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=10" } });
    }
    const functionMissing = fast.error && (fast.error.code === "PGRST202" || fast.error.code === "42883");
    if (fast.error && !functionMissing) throw fast.error;

    // Keep the dashboard usable until migration 008 has been applied.
    const [all, valid, pending, used, invalid, scans] = await Promise.all([
      s.from("tickets").select("id", { count: "exact", head: true }),
      s.from("tickets").select("id", { count: "exact", head: true }).eq("payment_status", "confirmed").eq("status", "valid"),
      s.from("tickets").select("id", { count: "exact", head: true }).eq("payment_status", "pending"),
      s.from("tickets").select("id", { count: "exact", head: true }).eq("status", "used"),
      s.from("scan_logs").select("id", { count: "exact", head: true }).in("result", ["invalid", "already_used"]),
      s.from("scan_logs").select("id,scanned_token,result,scanned_by,scanned_at,tickets(name,roll_number,phone)").order("scanned_at", { ascending: false }).limit(20),
    ]);
    const queryResults = [
      ["total tickets", all], ["valid tickets", valid], ["pending tickets", pending],
      ["used tickets", used], ["invalid scans", invalid], ["recent scans", scans],
    ] as const;
    const failed = queryResults.filter(([, result]) => result.error);
    if (failed.length) {
      const informativeError = failed.find(([, result]) =>
        typeof (result.error as { message?: unknown } | null)?.message === "string" &&
        Boolean((result.error as { message: string }).message),
      )?.[1].error;
      throw informativeError ?? failed[0][1].error;
    }
    return NextResponse.json({
      valid: valid.count ?? 0,
      used: used.count ?? 0,
      pending: pending.count ?? 0,
      invalid: invalid.count ?? 0,
      total: all.count ?? 0,
      recentScans: Array.isArray(scans.data) ? scans.data : [],
    }, { headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=10" } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(emptyStats, { status: 401 });
    }
    const detail = error && typeof error === "object"
      ? error as { name?: unknown; message?: unknown; code?: unknown; details?: unknown; hint?: unknown; cause?: unknown }
      : null;
    console.error("Admin stats request failed", {
      message: error instanceof Error ? error.message : String(detail?.message ?? "unknown error"),
      code: typeof detail?.code === "string" ? detail.code : undefined,
      details: typeof detail?.details === "string" ? detail.details : undefined,
      hint: typeof detail?.hint === "string" ? detail.hint : undefined,
    });
    return NextResponse.json(emptyStats, { status: 500 });
  }
}
