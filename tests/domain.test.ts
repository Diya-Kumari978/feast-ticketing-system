import {describe,it,expect} from "vitest";
import {normalizePhone,emailSchema,rollNumberSchema,ticketRegistrationSchema} from "@/lib/validation";
import {submissionDecision} from "@/lib/domain";

describe("identity normalization",()=>{
  it("canonicalizes supported Pakistani mobile formats",()=>{
    for(const input of ["0300 1234567","0300-1234567","(0300) 1234567","3001234567","0092 300 1234567","+92-300-1234567"])expect(normalizePhone(input)).toBe("+923001234567");
  });
  it("lowercases trimmed email",()=>expect(emailSchema.parse("  PERSON@Example.COM ")).toBe("person@example.com"));
  it("rejects unsupported phone number",()=>expect(()=>normalizePhone("02112345678")).toThrow());
});

describe("duplicate handling",()=>{
  const emptyPending={id:"1",access_token:"a",payment_status:"pending",payment_screenshot_path:null},submitted={...emptyPending,payment_screenshot_path:"proof.png"},confirmed={...emptyPending,payment_status:"confirmed"},rejected={...emptyPending,payment_status:"failed"};
  it("reuses an incomplete pending registration",()=>expect(submissionDecision(emptyPending)).toBe("reuse"));
  it("does not start another request while a payment is pending review",()=>expect(submissionDecision(submitted)).toBe("reject"));
  it("rejects confirmed registrations",()=>expect(submissionDecision(confirmed)).toBe("reject"));
  it("allows a rejected participant to submit a new proof",()=>expect(submissionDecision(rejected)).toBe("reuse"));
  it("creates when no registration exists",()=>expect(submissionDecision(undefined)).toBe("create"));
});

describe("ticket registration input",()=>{
	it("normalizes a valid roll number",()=>expect(rollNumberSchema.parse(" cs-123 ")).toBe("CS-123"));
	it("accepts the required phone format",()=>expect(ticketRegistrationSchema.safeParse({name:"Example Name",email:"person@example.com",rollNumber:"CS-123",phone:"03001234567"}).success).toBe(true));
});

describe("atomic scan contract model",()=>{
  type Ticket={status:"valid"|"used";payment_status:"confirmed"|"pending";used_at?:number};
  function scanner(tickets:Map<string,Ticket>){return async(token:string)=>{await Promise.resolve();const ticket=tickets.get(token);if(!ticket||ticket.payment_status!=="confirmed")return"invalid";if(ticket.status==="used")return"already_used";ticket.status="used";ticket.used_at=Date.now();return"valid";};}
  it("returns valid, then already_used; unknown token is invalid",async()=>{const scan=scanner(new Map([["known",{status:"valid",payment_status:"confirmed"}]]));expect(await scan("known")).toBe("valid");expect(await scan("known")).toBe("already_used");expect(await scan("unknown")).toBe("invalid");});
  it("admits exactly one of two simultaneous scans",async()=>{const scan=scanner(new Map([["known",{status:"valid",payment_status:"confirmed"}]]));const outcomes=await Promise.all([scan("known"),scan("known")]);expect(outcomes.filter(x=>x==="valid")).toHaveLength(1);expect(outcomes.filter(x=>x==="already_used")).toHaveLength(1);});
});
