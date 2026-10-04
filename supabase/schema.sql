create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  role text not null default 'jogador',
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('organizador', 'jogador'));
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, active)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Jogador'
    ),
    'jogador',
    true
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.profile_role(user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = user_id
  limit 1;
$$;

create or replace function public.is_organizer(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id
      and role = 'organizador'
      and active = true
  );
$$;

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;

grant select on table public.profiles to authenticated;
grant update (name, email) on table public.profiles to authenticated;

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Organizers can view all profiles" on public.profiles;
drop policy if exists "Users can update own basic profile" on public.profiles;

create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Organizers can view all profiles"
on public.profiles
for select
to authenticated
using (public.is_organizer(auth.uid()));

create policy "Users can update own basic profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and role = public.profile_role(auth.uid())
);
