import { notFound, redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import RequestReview from "@/components/admin-request-review";

export const dynamic = "force-dynamic";

export default async function AdminPaymentRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getAdmin();
  if (!admin) redirect(`/admin/login?next=${encodeURIComponent(`/admin/requests/${id}`)}`);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) notFound();

  const { data: ticket, error } = await db().from("tickets")
    .select("id,name,roll_number,phone,email,amount_due,payment_status,status,payment_screenshot_path,payment_rejection_reason,created_at")
    .eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load this payment request.");
  if (!ticket) notFound();

  let screenshotUrl: string | null = null;
  if (ticket.payment_screenshot_path) {
    const { data } = await db().storage.from("payment-proofs").createSignedUrl(ticket.payment_screenshot_path, 600);
    screenshotUrl = data?.signedUrl || null;
  }
  return <RequestReview ticket={{ ...ticket, screenshotUrl }} />;
}
