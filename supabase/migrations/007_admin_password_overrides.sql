-- Password changes from the admin profile page are stored as salted hashes.
create table if not exists public.admin_password_overrides (
  email text primary key check (email = lower(btrim(email))),
  full_name text not null,
  salt text not null,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.admin_password_overrides enable row level security;
revoke all on table public.admin_password_overrides from public, anon, authenticated;
grant select, insert, update on table public.admin_password_overrides to service_role;
