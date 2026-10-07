import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ authenticated: !!(await getAdmin()) }, { headers: { "Cache-Control": "no-store" } });
}
