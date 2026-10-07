import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/auth";
import { adminAccounts, makeAdminPasswordHash, verifyAdminPassword } from "@/lib/admin-accounts";
import { db } from "@/lib/supabase";

const passwordChange = z.object({ targetEmail: z.string().email().transform(value => value.toLowerCase()), currentPassword: z.string().min(1).max(256), newPassword: z.string().min(10).max(128) });
const managedProfiles = new Set(["ch.zubair2006@gmail.com", "shahnawazaliperhiar@gmail.com"]);

export async function POST(request: Request) {
  const session = await getAdmin();
  if (!session) return NextResponse.json({ error: "Sign in again to change your password." }, { status: 401 });
  const parsed = passwordChange.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Use a new password with at least 10 characters." }, { status: 400 });

  try {
    const account = adminAccounts().find(value => value.email.trim().toLowerCase() === parsed.data.targetEmail && managedProfiles.has(parsed.data.targetEmail));
    if (!account) return NextResponse.json({ error: "This admin account is not configured." }, { status: 403 });
    if (!await verifyAdminPassword(session.email, parsed.data.currentPassword)) return NextResponse.json({ error: "Your current signed-in admin password is incorrect." }, { status: 400 });
    const { salt, passwordHash } = await makeAdminPasswordHash(parsed.data.newPassword);
    const { error } = await db().from("admin_password_overrides").upsert({
      email: account.email.trim().toLowerCase(), full_name: account.name, salt, password_hash: passwordHash, updated_at: new Date().toISOString(),
    }, { onConflict: "email" });
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") return NextResponse.json({ error: "Apply supabase/migrations/007_admin_password_overrides.sql in Supabase before changing admin passwords." }, { status: 503 });
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin password update failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Could not save the password change." }, { status: 500 });
  }
}
