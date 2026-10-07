import { z } from "zod";
export const emailSchema = z.string().trim().email().max(254).transform(v => v.toLowerCase());
export function normalizePhone(input: string): string {
  let p = input.trim().replace(/[\s\-()[\].]/g, "");
  if (p.startsWith("0092")) p = "+92" + p.slice(4);
  else if (p.startsWith("92") && !p.startsWith("+")) p = "+" + p;
  else if (/^03\d{9}$/.test(p)) p = "+92" + p.slice(1);
  else if (/^3\d{9}$/.test(p)) p = "+92" + p;
  if (!/^\+923\d{9}$/.test(p)) throw new Error("Enter a valid Pakistani mobile number");
  return p;
}
const phoneSchema=z.string().min(10).max(30).transform((value,ctx)=>{try{return normalizePhone(value);}catch{ctx.addIssue({code:"custom",message:"Enter a valid Pakistani mobile number"});return z.NEVER;}});
export const registrationSchema = z.object({ name: z.string().trim().min(2).max(120), email: emailSchema, phone: phoneSchema, organization: z.string().trim().max(160).optional().or(z.literal("")) });
export const scanSchema = z.object({ token: z.string().trim().min(24).max(128).regex(/^[A-Za-z0-9_-]+$/) });
export const loginSchema = z.object({ email: z.string().trim().email().max(254).transform(v=>v.toLowerCase()), password: z.string().min(1).max(256) });
export const reasonSchema = z.string().trim().min(5).max(500);
export const paymentMethodSchema = z.enum(["jazzcash","easypaisa","bank_transfer"]);
export const ticketTypeSchema = z.enum(["General Admission"]);
export const paymentReviewSchema = z.object({ticketId:z.string().uuid(),decision:z.enum(["approved","rejected"]),reason:reasonSchema});
