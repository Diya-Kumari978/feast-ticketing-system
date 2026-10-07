import { redirect } from "next/navigation";

export default async function PaymentSuccessRedirect({ params }: { params: Promise<{ access: string }> }) {
  const { access } = await params;
  redirect(`/ticket/${encodeURIComponent(access)}`);
}
