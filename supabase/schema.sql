create table if not exists public.travel_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.travel_backups enable row level security;

drop policy if exists "Users can read own travel backup" on public.travel_backups;
create policy "Users can read own travel backup"
on public.travel_backups for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own travel backup" on public.travel_backups;
create policy "Users can insert own travel backup"
on public.travel_backups for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own travel backup" on public.travel_backups;
create policy "Users can update own travel backup"
on public.travel_backups for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own travel backup" on public.travel_backups;
create policy "Users can delete own travel backup"
on public.travel_backups for delete
using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'travel_backups'
  ) then
    alter publication supabase_realtime add table public.travel_backups;
  end if;
end $$;
