import {NextResponse} from "next/server";import {adminCookieName,requireAdmin} from "@/lib/auth";
export async function POST(){try{await requireAdmin();const r=NextResponse.json({ok:true});r.cookies.set(adminCookieName,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:0});return r;}catch{return NextResponse.json({error:"Unauthorized"},{status:401});}}
