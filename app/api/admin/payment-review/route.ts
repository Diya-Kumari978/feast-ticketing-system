import {NextResponse} from "next/server";
import {requireAdmin} from "@/lib/auth";
import {paymentReviewSchema} from "@/lib/validation";
import {db} from "@/lib/supabase";
import {sendTicketEmail,sendPaymentRejectedEmail} from "@/lib/email";
export async function POST(req:Request){
  const started=performance.now();
  const json=(body:unknown,status=200)=>{const response=NextResponse.json(body,{status});response.headers.set("Server-Timing",`approve;dur=${(performance.now()-started).toFixed(1)}`);return response;};
  try{
    const admin=await requireAdmin(),parsed=paymentReviewSchema.safeParse(await req.json());
    if(!parsed.success)return json({error:"Choose approve or reject and enter a reason."},400);
    const {ticketId,decision,reason}=parsed.data;
    const {data,error}=await db().rpc("review_payment",{p_ticket_id:ticketId,p_admin:admin,p_decision:decision,p_reason:reason});
    if(error)throw error;
    if(!data?.ok)return json({error:"This request is no longer pending or has no payment proof."},409);
    if(decision==="approved"){
      try{const sent=await sendTicketEmail(data.ticket);if(sent)await db().from("tickets").update({email_sent_at:new Date().toISOString()}).eq("id",ticketId).is("email_sent_at",null);}
      catch(e){console.error("Approved ticket email delivery failed",e instanceof Error?e.message:"unknown error");}
    }else{
      try{await sendPaymentRejectedEmail(data.ticket,reason);}
      catch(e){console.error("Payment rejection email delivery failed",e instanceof Error?e.message:"unknown error");}
    }
    return json({ok:true,status:data.ticket.payment_status});
  }catch(e){if(e instanceof Error&&e.message==="UNAUTHORIZED")return json({error:"Unauthorized"},401);console.error("Payment review failed");return json({error:"Could not save payment review"},500);}
}
