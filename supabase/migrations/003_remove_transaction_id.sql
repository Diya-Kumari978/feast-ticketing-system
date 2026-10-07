-- The screenshot review flow does not collect or store transaction IDs.
drop index if exists public.tickets_payment_transaction_unique;
alter table public.tickets drop column if exists payment_transaction_id;
alter table public.payment_reviews drop column if exists payment_transaction_id;
alter table public.tickets add column if not exists ticket_type text not null default 'General Admission';
alter table public.tickets add column if not exists amount_due integer not null default 1000;
