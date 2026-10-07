-- Keep dashboard counts and paged payment history queries index-backed.
create index if not exists tickets_payment_status_created_id_idx
  on public.tickets (payment_status, created_at desc, id);
create index if not exists tickets_status_created_id_idx
  on public.tickets (status, created_at desc, id);
create index if not exists scan_logs_result_idx
  on public.scan_logs (result);
create index if not exists payment_reviews_ticket_created_idx
  on public.payment_reviews (ticket_id, created_at desc);
create index if not exists manual_approvals_ticket_created_idx
  on public.manual_approvals (ticket_id, created_at desc);
