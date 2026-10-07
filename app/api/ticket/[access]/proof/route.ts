import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { byAccess } from "@/lib/tickets";
import { db } from "@/lib/supabase";
import { after } from "next/server";
import { notifyAdminsOfPendingPayment } from "@/lib/notifications";

function imageType(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ access: string }> }) {
  let path: string | null = null;
  try {
    const { access } = await params;
    if (!/^[a-f0-9]{64}$/.test(access)) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    const { data: ticket, error: lookupError } = await byAccess(access);
    if (lookupError) throw lookupError;
    if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    if (ticket.payment_status !== "failed") return NextResponse.json({ error: "A new proof can only be submitted after a rejection." }, { status: 409 });

    const form = await request.formData();
    const file = form.get("screenshot");
    if (!(file instanceof File) || file.size < 1 || file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Choose a screenshot smaller than 4 MB." }, { status: 400 });
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return NextResponse.json({ error: "Screenshot must be JPEG, PNG, or WebP." }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer()), mime = imageType(bytes);
    if (!mime || mime !== file.type) return NextResponse.json({ error: "Upload a genuine JPEG, PNG, or WebP screenshot." }, { status: 400 });

    const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
    path = `${ticket.id}/${randomUUID()}.${ext}`;
    const storage = db().storage.from("payment-proofs");
    const { error: uploadError } = await storage.upload(path, bytes, { contentType: mime, upsert: false });
    if (uploadError) throw uploadError;

    const { data: updated, error: updateError } = await db().from("tickets").update({ payment_status: "pending", payment_screenshot_path: path, payment_rejection_reason: null, qr_token: null }).eq("id", ticket.id).eq("payment_status", "failed").select("id").maybeSingle();
    if (updateError) throw updateError;
    if (!updated) {
      await storage.remove([path]);
      return NextResponse.json({ error: "This ticket was already updated. Refresh its status." }, { status: 409 });
    }
    after(async () => {
      try { await notifyAdminsOfPendingPayment({ id: ticket.id, name: ticket.name, roll_number: ticket.roll_number || "", email: ticket.email, phone: ticket.phone, amount_due: ticket.amount_due, access_token: ticket.access_token }); }
      catch (error) { console.error("Replacement proof notifications failed", error instanceof Error ? error.message : "unknown error"); }
    });
    return NextResponse.json({ ok: true, status: "pending" });
  } catch (error) {
    if (path) await db().storage.from("payment-proofs").remove([path]).catch(() => undefined);
    console.error("Replacement proof submission failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Could not save the new proof." }, { status: 500 });
  }
}
