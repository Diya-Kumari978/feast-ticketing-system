import { randomBytes } from "node:crypto";
import { db } from "@/lib/supabase";
export function newQrToken() { return randomBytes(24).toString("base64url"); }
export async function makeQrDataUrl(token:string) { const QRCode=(await import("qrcode")).default; return QRCode.toDataURL(token,{errorCorrectionLevel:"M",margin:2,width:360}); }
export async function byAccess(access:string) { return db().from("tickets").select("*").eq("access_token",access).maybeSingle(); }
