export type ExistingRegistration={payment_status:string;payment_screenshot_path?:string|null;id:string;access_token:string};
export function submissionDecision(ticket:ExistingRegistration|undefined){
  if(!ticket)return "create" as const;
  if(ticket.payment_status==="confirmed")return "reject" as const;
  if(ticket.payment_status==="pending"&&ticket.payment_screenshot_path)return "reject" as const;
  if(ticket.payment_status==="pending"&&!ticket.payment_screenshot_path)return "reuse" as const;
  if(ticket.payment_status==="failed")return "reuse" as const;
  return "reject" as const;
}
