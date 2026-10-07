import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ticketRegistrationSchema } from "@/lib/validation";
import { db } from "@/lib/supabase";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {submissionDecision} from "@/lib/domain";
import EVENT_CONFIG from "@/lib/event-config";
import { after } from "next/server";
import { notifyAdminsOfPendingPayment } from "@/lib/notifications";
export const runtime="nodejs";

function imageType(bytes:Buffer):"image/png"|"image/jpeg"|"image/webp"|null {
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return "image/png";
  if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return "image/jpeg";
  if(bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP")return "image/webp";
  return null;
}

export async function POST(req:Request){
  const gate=rateLimit(`register:${clientIp(req)}`,5,60*60*1000);
  if(!gate.allowed)return NextResponse.json({error:"Too many attempts. Try again later."},{status:429});
  try{
    const form=await req.formData();
    const participant=ticketRegistrationSchema.safeParse({name:form.get("name"),email:form.get("email"),rollNumber:form.get("rollNumber"),phone:form.get("phone")});
    const file=form.get("screenshot");
    if(!participant.success||!(file instanceof File))return NextResponse.json({error:"Complete all required fields and attach your payment screenshot."},{status:400});
    if(file.size<1||file.size>4*1024*1024)return NextResponse.json({error:"Screenshot must be smaller than 4 MB."},{status:400});
    if(!["image/jpeg","image/png","image/webp"].includes(file.type))return NextResponse.json({error:"Screenshot must be a JPEG, PNG, or WebP image."},{status:400});
    const bytes=Buffer.from(await file.arrayBuffer()), mime=imageType(bytes);
    if(!mime||mime!==file.type)return NextResponse.json({error:"Upload a genuine JPEG, PNG, or WebP screenshot."},{status:400});

    const s=db(), v=participant.data;
    const [emailMatch,phoneMatch,rollMatch]=await Promise.all([
      s.from("tickets").select("id,email,phone,roll_number,payment_status,payment_screenshot_path,access_token").eq("email",v.email).maybeSingle(),
      s.from("tickets").select("id,email,phone,roll_number,payment_status,payment_screenshot_path,access_token").eq("phone",v.phone).maybeSingle(),
      s.from("tickets").select("id,email,phone,roll_number,payment_status,payment_screenshot_path,access_token").eq("roll_number",v.rollNumber).maybeSingle()
    ]);
    if(emailMatch.error)throw emailMatch.error;if(phoneMatch.error)throw phoneMatch.error;if(rollMatch.error)throw rollMatch.error;
    const matches=[emailMatch.data,phoneMatch.data,rollMatch.data].filter((x,i,a)=>x&&a.findIndex(v=>v?.id===x.id)===i);
    if(matches.length>1)return NextResponse.json({error:"Already registered"},{status:409});
    const existing=matches[0];
    const decision=submissionDecision(existing);
    if(decision==="reject")return NextResponse.json({error:"Already registered"},{status:409});

    const ticketId=existing?.id||randomUUID(), accessToken=existing?.access_token;
    const suffix=mime==="image/jpeg"?"jpg":mime==="image/png"?"png":"webp";
    const path=`${ticketId}/${randomUUID()}.${suffix}`;
    const storage=s.storage.from("payment-proofs");
    const {error:uploadError}=await storage.upload(path,bytes,{contentType:mime,upsert:false});
    if(uploadError)throw uploadError;
    const amountDue=EVENT_CONFIG.price;
    const patch={name:v.name,email:v.email,phone:v.phone,roll_number:v.rollNumber,organization:null,ticket_type:null,amount_due:amountDue,payment_status:"pending",payment_method:null,payment_screenshot_path:path,payment_rejection_reason:null,qr_token:null};
    let ticket:any,writeError:any;
    if(decision==="reuse"&&existing){
      let update=s.from("tickets").update(patch).eq("id",ticketId);
      if(existing.payment_status==="failed")update=update.eq("payment_status","failed");
      else update=update.eq("payment_status","pending").is("payment_screenshot_path",null);
      const {data,error}=await update.select("id,access_token").maybeSingle();ticket=data;writeError=error;
    }else{
      const {data,error}=await s.from("tickets").insert({...patch,id:ticketId}).select("id,access_token").single();ticket=data;writeError=error;
    }
    if(writeError||!ticket){await storage.remove([path]);if(writeError?.code==="23505")return NextResponse.json({error:"Already registered"},{status:409});if(writeError)throw writeError;return NextResponse.json({error:"Registration changed while submitting. Please reload and try again."},{status:409});}
    after(async () => {
      try { await notifyAdminsOfPendingPayment({ id: ticket.id, name: v.name, roll_number: v.rollNumber, email: v.email, phone: v.phone, amount_due: amountDue, access_token: ticket.access_token || accessToken }); }
      catch (error) { console.error("Pending payment notifications failed", error instanceof Error ? error.message : "unknown error"); }
    });
    return NextResponse.json({id:ticket.id,accessToken:ticket.access_token||accessToken,status:"pending"});
  }catch(e){
    const diagnostic = e && typeof e === "object" ? e as { message?: unknown; code?: unknown; column?: unknown; details?: unknown; hint?: unknown } : null;
    if (diagnostic?.code === "42703" && String(diagnostic.message || diagnostic.details || "").includes("roll_number")) {
      return NextResponse.json({ error: "The registration database is missing the roll number column. Apply supabase/migrations/005_roll_number.sql in Supabase, then try again." }, { status: 503 });
    }
    if (diagnostic?.code === "23502" && String(diagnostic.column || diagnostic.message || diagnostic.details || "").includes("ticket_type")) {
      return NextResponse.json({ error: "The registration database needs supabase/migrations/006_event_ticket_fields.sql before payments can be saved." }, { status: 503 });
    }
    console.error("Payment proof submission failed", {
      message: e instanceof Error ? e.message : String(diagnostic?.message ?? "unknown error"),
      code: typeof diagnostic?.code === "string" ? diagnostic.code : undefined,
      details: typeof diagnostic?.details === "string" ? diagnostic.details : undefined,
      hint: typeof diagnostic?.hint === "string" ? diagnostic.hint : undefined,
    });
    return NextResponse.json({error:"Payment proof was not saved. Please try again."},{status:500});
  }
}
