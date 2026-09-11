-- Run in your own Supabase project's SQL editor before enabling cloud sync.
create table if not exists public.geora_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.geora_progress enable row level security;
create policy "read own progress" on public.geora_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own progress" on public.geora_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own progress" on public.geora_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
