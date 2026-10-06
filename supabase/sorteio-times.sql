create table if not exists public.rachas (
  id uuid primary key default gen_random_uuid(),
  nome text not null default 'Racha',
  data date,
  horario time,
  endereco text,
  estado text not null default 'aberto',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint rachas_estado_check check (estado in ('aberto', 'lista_fechada', 'times_confirmados', 'finalizado'))
);

alter table public.rachas
add column if not exists estado text not null default 'aberto';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rachas_estado_check'
      and conrelid = 'public.rachas'::regclass
  ) then
    alter table public.rachas
      add constraint rachas_estado_check check (estado in ('aberto', 'lista_fechada', 'times_confirmados', 'finalizado'));
  end if;
end
$$;

create table if not exists public.racha_participantes (
  id uuid primary key default gen_random_uuid(),
  racha_id uuid not null references public.rachas(id) on delete cascade,
  jogador_id uuid references public.profiles(id) on delete set null,
  nome text not null,
  tipo text not null,
  status text not null default 'confirmado',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint racha_participantes_tipo_check check (tipo in ('goleiro', 'linha', 'suplente')),
  constraint racha_participantes_status_check check (status in ('confirmado', 'ausente', 'removido'))
);

update public.racha_participantes
set tipo = 'suplente',
    status = 'confirmado'
where status = 'suplente'
  and tipo in ('goleiro', 'linha');

alter table public.racha_participantes
drop constraint if exists racha_participantes_tipo_check;

alter table public.racha_participantes
add constraint racha_participantes_tipo_check check (tipo in ('goleiro', 'linha', 'suplente'));

alter table public.racha_participantes
drop constraint if exists racha_participantes_status_check;

alter table public.racha_participantes
add constraint racha_participantes_status_check check (status in ('confirmado', 'ausente', 'removido'));

create unique index if not exists racha_participantes_racha_jogador_unique
on public.racha_participantes (racha_id, jogador_id)
where jogador_id is not null;

create table if not exists public.times (
  id uuid primary key default gen_random_uuid(),
  racha_id uuid not null references public.rachas(id) on delete cascade,
  nome text not null,
  numero integer not null,
  confirmado boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint times_numero_check check (numero >= 1),
  constraint times_racha_numero_unique unique (racha_id, numero)
);

alter table public.times
drop constraint if exists times_numero_check;

alter table public.times
add constraint times_numero_check check (numero >= 1);

create table if not exists public.time_jogadores (
  id uuid primary key default gen_random_uuid(),
  time_id uuid not null references public.times(id) on delete cascade,
  jogador_id uuid not null references public.profiles(id) on delete cascade,
  participante_id uuid references public.racha_participantes(id) on delete set null,
  created_at timestamptz default now(),
  constraint time_jogadores_time_jogador_unique unique (time_id, jogador_id)
);

drop trigger if exists set_rachas_updated_at on public.rachas;
create trigger set_rachas_updated_at
before update on public.rachas
for each row
execute function public.set_updated_at();

drop trigger if exists set_racha_participantes_updated_at on public.racha_participantes;
create trigger set_racha_participantes_updated_at
before update on public.racha_participantes
for each row
execute function public.set_updated_at();

drop trigger if exists set_times_updated_at on public.times;
create trigger set_times_updated_at
before update on public.times
for each row
execute function public.set_updated_at();

alter table public.rachas enable row level security;
alter table public.racha_participantes enable row level security;
alter table public.times enable row level security;
alter table public.time_jogadores enable row level security;

grant select on table public.rachas to authenticated;
grant select on table public.racha_participantes to authenticated;
grant select on table public.times to authenticated;
grant select on table public.time_jogadores to authenticated;

grant insert, update, delete on table public.rachas to authenticated;
grant insert, update, delete on table public.racha_participantes to authenticated;
grant insert, update, delete on table public.times to authenticated;
grant insert, update, delete on table public.time_jogadores to authenticated;

drop policy if exists "Authenticated users can view rounds" on public.rachas;
drop policy if exists "Organizers can manage rounds" on public.rachas;
drop policy if exists "Authenticated users can view participants" on public.racha_participantes;
drop policy if exists "Organizers can manage participants" on public.racha_participantes;
drop policy if exists "Users can view confirmed teams" on public.times;
drop policy if exists "Organizers can view all teams" on public.times;
drop policy if exists "Organizers can manage teams" on public.times;
drop policy if exists "Users can view confirmed team players" on public.time_jogadores;
drop policy if exists "Organizers can view all team players" on public.time_jogadores;
drop policy if exists "Organizers can manage team players" on public.time_jogadores;

create policy "Authenticated users can view rounds"
on public.rachas
for select
to authenticated
using (true);

create policy "Organizers can manage rounds"
on public.rachas
for all
to authenticated
using (public.is_organizer(auth.uid()))
with check (public.is_organizer(auth.uid()));

create policy "Authenticated users can view participants"
on public.racha_participantes
for select
to authenticated
using (true);

create policy "Organizers can manage participants"
on public.racha_participantes
for all
to authenticated
using (public.is_organizer(auth.uid()))
with check (public.is_organizer(auth.uid()));

create policy "Users can view confirmed teams"
on public.times
for select
to authenticated
using (confirmado = true);

create policy "Organizers can view all teams"
on public.times
for select
to authenticated
using (public.is_organizer(auth.uid()));

create policy "Organizers can manage teams"
on public.times
for all
to authenticated
using (public.is_organizer(auth.uid()))
with check (public.is_organizer(auth.uid()));

create policy "Users can view confirmed team players"
on public.time_jogadores
for select
to authenticated
using (
  exists (
    select 1
    from public.times
    where times.id = time_jogadores.time_id
      and times.confirmado = true
  )
);

create policy "Organizers can view all team players"
on public.time_jogadores
for select
to authenticated
using (public.is_organizer(auth.uid()));

create policy "Organizers can manage team players"
on public.time_jogadores
for all
to authenticated
using (public.is_organizer(auth.uid()))
with check (public.is_organizer(auth.uid()));
