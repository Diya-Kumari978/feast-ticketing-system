create or replace function public.admin_dashboard_stats()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'valid', (select count(*) from public.tickets where payment_status = 'confirmed' and status = 'valid'),
    'used', (select count(*) from public.tickets where status = 'used'),
    'pending', (select count(*) from public.tickets where payment_status = 'pending'),
    'invalid', (select count(*) from public.scan_logs where result in ('invalid', 'already_used')),
    'total', (select count(*) from public.tickets),
    'recentScans', coalesce((
      select jsonb_agg(jsonb_build_object(
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
      ) order by recent.scanned_at desc)
      from (
        select l.id, l.ticket_id, l.scanned_token, l.result, l.scanned_by, l.scanned_at,
               t.name as ticket_name, t.roll_number, t.phone
        from public.scan_logs l
        left join public.tickets t on t.id = l.ticket_id
        order by l.scanned_at desc
        limit 20
      ) recent
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.admin_dashboard_stats() from public, anon, authenticated;
grant execute on function public.admin_dashboard_stats() to service_role;
