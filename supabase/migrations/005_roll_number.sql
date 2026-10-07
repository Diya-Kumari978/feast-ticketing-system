alter table public.tickets
  add column if not exists roll_number text;

create unique index if not exists tickets_roll_number_unique
  on public.tickets (roll_number)
  where roll_number is not null;
