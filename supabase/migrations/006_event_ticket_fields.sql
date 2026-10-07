alter table public.tickets
  alter column ticket_type drop not null,
  alter column ticket_type drop default,
  alter column amount_due set default 250;
