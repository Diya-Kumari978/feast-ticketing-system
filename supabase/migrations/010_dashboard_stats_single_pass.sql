create or replace function public.admin_dashboard_stats()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with ticket_counts as materialized (
  select
    count(*) filter (where payment_status = 'confirmed' and status = 'valid') as valid,
    count(*) filter (where status = 'used') as used,
    count(*) filter (where payment_status = 'pending') as pending,
    count(*) as total
  from public.tickets
), invalid_count as materialized (
  select count(*) as invalid
  from public.scan_logs
  where result in ('invalid', 'already_used')
), recent_scans as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', recent.id,
    'scanned_token', recent.scanned_token,
    'result', recent.result,
    'scanned_by', recent.scanned_by,
    'scanned_at', recent.scanned_at,
    'tickets', case when recent.ticket_id is null then null else jsonb_build_object(
      'name', recent.ticket_name,
      'roll_number', recent.roll_number,
      'phone', recent.phone
    ) end
  ) order by recent.scanned_at desc), '[]'::jsonb) as rows
  from (
    select l.id, l.ticket_id, l.scanned_token, l.result, l.scanned_by, l.scanned_at,
           t.name as ticket_name, t.roll_number, t.phone
    from public.scan_logs l
    left join public.tickets t on t.id = l.ticket_id
    order by l.scanned_at desc
    limit 20
  ) recent
)
select jsonb_build_object(
  'valid', ticket_counts.valid,
  'used', ticket_counts.used,
  'pending', ticket_counts.pending,
  'invalid', invalid_count.invalid,
  'total', ticket_counts.total,
  'recentScans', recent_scans.rows
)
from ticket_counts cross join invalid_count cross join recent_scans;
$$;

revoke all on function public.admin_dashboard_stats() from public, anon, authenticated;
grant execute on function public.admin_dashboard_stats() to service_role;
