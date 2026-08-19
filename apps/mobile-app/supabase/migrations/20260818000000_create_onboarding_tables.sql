begin;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  province_territory text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,
  created_at timestamptz not null default now(),
  constraint user_cards_user_id_card_id_key unique (user_id, card_id)
);

create index user_cards_user_id_idx on public.user_cards (user_id);

alter table public.profiles enable row level security;
alter table public.user_cards enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.user_cards from anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, delete on table public.user_cards to authenticated;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can create their own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users can read their own cards"
on public.user_cards
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can add their own cards"
on public.user_cards
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can remove their own cards"
on public.user_cards
for delete
to authenticated
using ((select auth.uid()) = user_id);

commit;
