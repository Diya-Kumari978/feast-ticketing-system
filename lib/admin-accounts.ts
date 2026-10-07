import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db } from "@/lib/supabase";

export type AdminAccount = { name: string; email: string; password: string };
const excludedAdminEmails = new Set(["diyakumari712@gmail.com"]);
export const isExcludedAdminEmail = (email: string) => excludedAdminEmails.has(email.trim().toLowerCase());
const scryptAsync = promisify(scrypt);

export function adminAccounts(): AdminAccount[] {
  const value = process.env.ADMIN_ACCOUNTS;
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is AdminAccount => !!entry && typeof entry === "object" && typeof entry.name === "string" && typeof entry.email === "string" && typeof entry.password === "string" && !isExcludedAdminEmail(entry.email));
  } catch { return []; }
}

function equal(candidate: string, expected: string) {
  const a = Buffer.from(candidate), b = Buffer.from(expected), width = Math.max(a.length, b.length, 1);
  const paddedA = Buffer.alloc(width), paddedB = Buffer.alloc(width);
  a.copy(paddedA); b.copy(paddedB);
  return timingSafeEqual(paddedA, paddedB) && a.length === b.length;
}

function isMissingOverridesTable(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.code === "PGRST205" || (error.message || "").includes("admin_password_overrides") && /does not exist|schema cache/i.test(error.message || "");
}

export async function verifyAdminPassword(email: string, candidate: string) {
  const account = adminAccounts().find(value => value.email.trim().toLowerCase() === email.trim().toLowerCase());
  if (!account) return false;
  const { data, error } = await db().from("admin_password_overrides").select("salt,password_hash").eq("email", account.email.trim().toLowerCase()).maybeSingle();
  if (error) {
    if (isMissingOverridesTable(error)) return equal(candidate, account.password);
    throw error;
  }
  if (!data) return equal(candidate, account.password);
  const salt = Buffer.from(String(data.salt), "hex"), expected = Buffer.from(String(data.password_hash), "hex");
  if (!salt.length || expected.length !== 64) return false;
  const actual = await scryptAsync(candidate, salt, expected.length) as Buffer;
  return timingSafeEqual(actual, expected);
}

export async function makeAdminPasswordHash(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64) as Buffer;
  return { salt: salt.toString("hex"), passwordHash: hash.toString("hex") };
}
