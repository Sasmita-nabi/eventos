-- Optional persistent storage for a serverless deployment.
-- Run in the Supabase SQL editor. DO NOT expose your service role key.
-- The MVP stores the normalized entity collections in one transactional JSONB
-- state document. The revision column supplies optimistic concurrency control.

create table if not exists public.eventos_state (
  id text primary key,
  revision bigint not null default 0 check (revision >= 0),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.eventos_state enable row level security;
revoke all on public.eventos_state from anon, authenticated;
grant select, insert, update on public.eventos_state to service_role;

-- No anonymous or authenticated-user RLS policies are created intentionally.
-- All access is through the server-only service role adapter in lib/store.ts.
-- The server initializes id='main' with seed data on its first request.
