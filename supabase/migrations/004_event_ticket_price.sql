-- Keep database-created tickets aligned with lib/event-config.ts.
alter table public.tickets alter column amount_due set default 1000;
