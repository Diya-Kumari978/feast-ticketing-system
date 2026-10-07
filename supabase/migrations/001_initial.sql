create extension if not exists pgcrypto;

create table public.tickets (
  id uuid primary key default gen_random_uuid(), name text not null, email text not null unique,
  phone text not null unique check (phone ~ '^\+923[0-9]{9}$'), organization text,
  payment_status text not null default 'pending' check (payment_status in ('pending','confirmed','failed')),
  payment_method text check (payment_method in ('gateway','manual')),
  qr_token text unique, access_token text not null unique default encode(gen_random_bytes(32),'hex'),
  status text not null default 'valid' check (status in ('valid','used')), used_at timestamptz, checked_in_by text,
  created_at timestamptz not null default now(), email_sent_at timestamptz
);
alter table public.tickets add constraint tickets_email_normalized check (email = lower(btrim(email)));
create table public.scan_logs (
  id uuid primary key default gen_random_uuid(), scanned_token text not null, ticket_id uuid references public.tickets(id),
  result text not null check (result in ('valid','already_used','invalid')), scanned_by text not null, scanned_at timestamptz not null default now()
);
create table public.manual_approvals (
  id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.tickets(id),
  approved_by text not null, reason text not null, created_at timestamptz not null default now()
);
alter table public.tickets enable row level security;
alter table public.scan_logs enable row level security;
alter table public.manual_approvals enable row level security;

-- One database operation decides and records every scan, including concurrent attempts.
create or replace function public.scan_ticket(p_token text, p_admin text, p_scanned text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare t public.tickets%rowtype; outcome text := 'invalid';
begin
  update tickets set status='used', used_at=now(), checked_in_by=p_admin
  where qr_token=p_token and payment_status='confirmed' and status='valid' returning * into t;
  if found then outcome := 'valid';
  else
    select * into t from tickets where qr_token=p_token;
    if found and t.status='used' then outcome := 'already_used'; end if;
  end if;
  insert into scan_logs(scanned_token,ticket_id,result,scanned_by)
  values(left(coalesce(p_scanned,p_token),120),case when t.id is null then null else t.id end,outcome,p_admin);
  return jsonb_build_object('result',outcome,'ticket',case when t.id is null then null else to_jsonb(t) end);
end $$;
revoke all on function public.scan_ticket(text,text,text) from public, anon, authenticated;
grant execute on function public.scan_ticket(text,text,text) to service_role;

create or replace function public.log_invalid_scan(p_scanned text,p_admin text)
returns void language sql security definer set search_path = public, extensions as $$
  insert into scan_logs(scanned_token,ticket_id,result,scanned_by) values(left(coalesce(p_scanned,''),120),null,'invalid',p_admin);
$$;
revoke all on function public.log_invalid_scan(text,text) from public, anon, authenticated;
grant execute on function public.log_invalid_scan(text,text) to service_role;

create or replace function public.create_manual_ticket(p_name text,p_email text,p_phone text,p_organization text,p_admin text,p_reason text)
returns public.tickets language plpgsql security definer set search_path = public, extensions as $$
declare t public.tickets%rowtype;
begin
  insert into tickets(name,email,phone,organization,payment_status,payment_method,qr_token)
  values(p_name,p_email,p_phone,nullif(p_organization,''),'confirmed','manual',encode(gen_random_bytes(24),'hex')) returning * into t;
  insert into manual_approvals(ticket_id,approved_by,reason) values(t.id,p_admin,p_reason);
  return t;
end $$;
revoke all on function public.create_manual_ticket(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.create_manual_ticket(text,text,text,text,text,text) to service_role;

create index tickets_created_at_idx on public.tickets(created_at desc);
create index scan_logs_scanned_at_idx on public.scan_logs(scanned_at desc);
