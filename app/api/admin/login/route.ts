import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/validation";
import { sessionToken,adminCookieName } from "@/lib/auth";
import { ADMIN_EMAIL,ADMIN_PASSWORD } from "@/lib/admin-credentials";
import {timingSafeEqual} from "node:crypto";
import { clientIp,rateLimit } from "@/lib/rate-limit";
export async function POST(req:Request){
 const gate=rateLimit(`login:${clientIp(req)}`,6,15*60*1000);if(!gate.allowed)return NextResponse.json({error:"Too many attempts. Try again later."},{status:429});
 const p=loginSchema.safeParse(await req.json());if(!p.success)return NextResponse.json({error:"Invalid login"},{status:400});
 const email=Buffer.from(p.data.email),expectedEmail=Buffer.from(ADMIN_EMAIL),password=Buffer.from(p.data.password),expectedPassword=Buffer.from(ADMIN_PASSWORD);
 const emailOk=email.length===expectedEmail.length&&timingSafeEqual(email,expectedEmail),passwordOk=password.length===expectedPassword.length&&timingSafeEqual(password,expectedPassword);
 if(!emailOk||!passwordOk)return NextResponse.json({error:"Incorrect email or password"},{status:401});
 const res=NextResponse.json({ok:true});res.cookies.set(adminCookieName,await sessionToken(ADMIN_EMAIL),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:12*60*60});return res;
}
