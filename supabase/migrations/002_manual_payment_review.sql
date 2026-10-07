-- User-submitted payment proofs are stored privately and never accepted automatically.
drop function if exists public.confirm_ticket_payment(uuid,text);
drop function if exists public.approve_manual_ticket(uuid,text,text);
alter table public.tickets drop column if exists payment_reference;
alter table public.tickets drop constraint if exists tickets_payment_method_check;
alter table public.tickets add constraint tickets_payment_method_check
  check (payment_method in ('gateway','manual','jazzcash','easypaisa','bank_transfer'));
alter table public.tickets
  add column if not exists payment_screenshot_path text,
  add column if not exists payment_rejection_reason text,
  add column if not exists ticket_type text not null default 'General Admission',
  add column if not exists amount_due integer not null default 1000;

create table if not exists public.payment_reviews (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id),
  reviewed_by text not null,
  decision text not null check (decision in ('approved','rejected')),
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.payment_reviews enable row level security;

-- Private bucket: only authenticated server routes using the service role can access proofs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create or replace function public.review_payment(p_ticket_id uuid,p_admin text,p_decision text,p_reason text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.tickets%rowtype;
begin
  if p_decision='approved' then
    update tickets set payment_status='confirmed',qr_token=coalesce(qr_token,encode(gen_random_bytes(24),'hex'))
    where id=p_ticket_id and payment_status='pending' and payment_screenshot_path is not null
    returning * into t;
  elsif p_decision='rejected' then
    update tickets set payment_status='failed',payment_rejection_reason=p_reason
    where id=p_ticket_id and payment_status='pending' and payment_screenshot_path is not null
    returning * into t;
  else
    return jsonb_build_object('ok',false);
  end if;
  if not found then return jsonb_build_object('ok',false); end if;
  insert into payment_reviews(ticket_id,reviewed_by,decision,reason)
  values(t.id,p_admin,p_decision,p_reason);
  if p_decision='approved' then
    insert into manual_approvals(ticket_id,approved_by,reason) values(t.id,p_admin,'Verified payment proof: '||p_reason);
  end if;
  return jsonb_build_object('ok',true,'ticket',to_jsonb(t));
end $$;
revoke all on function public.review_payment(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.review_payment(uuid,text,text,text) to service_role;
