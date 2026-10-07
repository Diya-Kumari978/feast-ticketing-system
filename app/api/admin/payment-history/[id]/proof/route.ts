import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const { data: ticket, error } = await db().from("tickets")
      .select("payment_screenshot_path").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!ticket?.payment_screenshot_path) return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
    const { data, error: storageError } = await db().storage.from("payment-proofs")
      .createSignedUrl(ticket.payment_screenshot_path, 300);
    if (storageError || !data?.signedUrl) throw storageError || new Error("Could not open screenshot");
    return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Payment history proof could not be opened", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Could not open screenshot" }, { status: 500 });
  }
}
