import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
const COOKIE = "feast_admin";
function secret() { const s=process.env.SESSION_SECRET; if (!s || s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters"); return new TextEncoder().encode(s); }
export async function sessionToken(name:string,email:string) { return new SignJWT({name,email}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("12h").sign(secret()); }
export async function getAdmin() { const c=await cookies(), token=c.get(COOKIE)?.value; if(!token)return null; try {const {payload}=await jwtVerify(token,secret());return typeof payload.name==="string"&&typeof payload.email==="string"?{name:payload.name,email:payload.email}:null;}catch{return null;} }
export async function requireAdmin() { const admin=await getAdmin(); if(!admin) throw new Error("UNAUTHORIZED"); return admin.name; }
export const adminCookieName=COOKIE;
