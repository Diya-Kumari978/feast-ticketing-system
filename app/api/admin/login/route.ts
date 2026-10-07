import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/validation";
import { sessionToken, adminCookieName } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { safeAdminNext } from "@/lib/admin-next";
import { adminAccounts, verifyAdminPassword } from "@/lib/admin-accounts";

export async function POST(request: Request) {
  const gate = rateLimit(`login:${clientIp(request)}`, 6, 15 * 60 * 1000);
  if (!gate.allowed) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid login" }, { status: 400 });
    const account = adminAccounts().find(value => value.email.trim().toLowerCase() === parsed.data.email.trim().toLowerCase());
    const passwordMatches = account ? await verifyAdminPassword(account.email, parsed.data.password) : false;
    if (!account || !passwordMatches) return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
    const response = NextResponse.json({ ok: true, next: safeAdminNext(typeof body.next === "string" ? body.next : null) });
    response.cookies.set(adminCookieName, await sessionToken(account.name, account.email.trim().toLowerCase()), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 12 * 60 * 60 });
    return response;
  } catch {
    return NextResponse.json({ error: "Admin login is not configured correctly." }, { status: 500 });
  }
}
