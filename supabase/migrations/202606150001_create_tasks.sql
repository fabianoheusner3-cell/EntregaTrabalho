drop table if exists public.tasks;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null check (char_length(trim(titulo)) > 0),
  descricao text,
  prioridade text not null default 'media'
    check (prioridade in ('alta', 'media', 'baixa')),
  concluida boolean not null default false,
  latitude double precision,
  longitude double precision,
  nome_local text,
  created_at timestamptz not null default now()
);

create index tasks_user_id_created_at_idx
on public.tasks (user_id, created_at desc);

create index tasks_user_id_status_priority_idx
on public.tasks (user_id, concluida, prioridade);

alter table public.tasks enable row level security;

grant select, insert, update, delete on table public.tasks to authenticated;

drop policy if exists "Users can view their own tasks" on public.tasks;
create policy "Users can view their own tasks"
on public.tasks
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own tasks" on public.tasks;
create policy "Users can insert their own tasks"
on public.tasks
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own tasks" on public.tasks;
create policy "Users can update their own tasks"
on public.tasks
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own tasks" on public.tasks;
create policy "Users can delete their own tasks"
on public.tasks
for delete
to authenticated
using ((select auth.uid()) = user_id);
