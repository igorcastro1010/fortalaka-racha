-- Executar DEPOIS de schema.sql. Não cria participantes nem contas de teste.
begin;

create table if not exists public.rodadas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 100),
  data date not null,
  confirmado boolean not null default false,
  versao integer not null default 0,
  confirmado_por uuid references public.profiles(id) on delete set null,
  confirmado_em timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.rodada_participantes (
  id uuid primary key,
  rodada_id uuid not null references public.rodadas(id) on delete cascade,
  jogador_id uuid references public.profiles(id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 100),
  tipo text not null check (tipo in ('goleiro_fixo', 'linha', 'suplente')),
  status text not null check (status in ('presente', 'ausente', 'removido')),
  created_at timestamptz not null default now(),
  unique (rodada_id, id)
);

create table if not exists public.times (
  id uuid primary key default gen_random_uuid(),
  rodada_id uuid not null references public.rodadas(id) on delete cascade,
  nome text not null,
  numero integer not null check (numero between 1 and 4),
  cor text,
  created_at timestamptz not null default now(),
  unique (rodada_id, numero),
  unique (rodada_id, id)
);

create table if not exists public.time_jogadores (
  id uuid primary key default gen_random_uuid(),
  rodada_id uuid not null,
  time_id uuid not null,
  participante_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (rodada_id, time_id) references public.times(rodada_id, id) on delete cascade,
  foreign key (rodada_id, participante_id) references public.rodada_participantes(rodada_id, id) on delete cascade,
  unique (rodada_id, participante_id)
);
create index if not exists time_jogadores_time_idx on public.time_jogadores(time_id);

alter table public.rodadas enable row level security;
alter table public.rodada_participantes enable row level security;
alter table public.times enable row level security;
alter table public.time_jogadores enable row level security;
revoke all on public.rodadas, public.rodada_participantes, public.times, public.time_jogadores from anon, authenticated;
grant select on public.rodadas, public.rodada_participantes, public.times, public.time_jogadores to authenticated;

-- Escritas somente via RPCs autorizadas, validadas e atômicas, inclusive para organizadores.
drop policy if exists sorteio_rodadas_leitura on public.rodadas;
create policy sorteio_rodadas_leitura on public.rodadas for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and active));
drop policy if exists sorteio_participantes_leitura on public.rodada_participantes;
create policy sorteio_participantes_leitura on public.rodada_participantes for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and active));
drop policy if exists sorteio_times_leitura on public.times;
create policy sorteio_times_leitura on public.times for select to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and active)
  and (public.is_organizer(auth.uid()) or exists (
    select 1 from public.rodadas r where r.id = rodada_id and r.confirmado
  ))
);
drop policy if exists sorteio_membros_leitura on public.time_jogadores;
create policy sorteio_membros_leitura on public.time_jogadores for select to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and active)
  and (public.is_organizer(auth.uid()) or exists (
    select 1 from public.rodadas r where r.id = rodada_id and r.confirmado
  ))
);

create or replace function public.criar_rodada(p_nome text, p_data date)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if not public.is_organizer(auth.uid()) then raise exception 'Somente organizadores podem criar rodadas.'; end if;
  insert into public.rodadas(nome, data) values (trim(p_nome), p_data) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.salvar_participantes(p_rodada uuid, p_versao integer, p_participantes jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_round public.rodadas%rowtype; v_item jsonb;
begin
  if not public.is_organizer(auth.uid()) then raise exception 'Somente organizadores podem alterar participantes.'; end if;
  select * into v_round from public.rodadas where id = p_rodada for update;
  if not found then raise exception 'Rodada não encontrada.'; end if;
  if p_versao is distinct from v_round.versao then raise exception 'A rodada foi alterada. Atualize a tela antes de continuar.'; end if;
  if p_participantes is null or jsonb_typeof(p_participantes) <> 'array' then raise exception 'Lista de participantes inválida.'; end if;
  if jsonb_array_length(p_participantes) > 100 then raise exception 'Limite de 100 participantes por rodada.'; end if;
  if (select count(*) from jsonb_array_elements(p_participantes)) <>
     (select count(distinct (x->>'id')::uuid) from jsonb_array_elements(p_participantes) x) then
    raise exception 'Existem participantes repetidos na rodada.';
  end if;
  if (select count(*) from jsonb_array_elements(p_participantes) x
      where x->>'tipo' = 'goleiro_fixo' and x->>'status' <> 'removido') <> 2 then
    raise exception 'A rodada deve ter exatamente 2 goleiros fixos.';
  end if;
  -- Não permite roubar ou mover a identidade de uma participação de outra rodada.
  if exists (select 1 from public.rodada_participantes p
     join jsonb_array_elements(p_participantes) x on p.id = (x->>'id')::uuid where p.rodada_id <> p_rodada) then
    raise exception 'Participante pertence a outra rodada.';
  end if;
  delete from public.times where rodada_id = p_rodada;
  delete from public.rodada_participantes p where p.rodada_id = p_rodada
    and not exists (select 1 from jsonb_array_elements(p_participantes) x where (x->>'id')::uuid = p.id);
  for v_item in select value from jsonb_array_elements(p_participantes) loop
    insert into public.rodada_participantes(id, rodada_id, name, tipo, status)
    values ((v_item->>'id')::uuid, p_rodada, trim(v_item->>'name'), v_item->>'tipo', v_item->>'status')
    on conflict (id) do update set name = excluded.name, tipo = excluded.tipo, status = excluded.status;
  end loop;
  update public.rodadas set confirmado = false, confirmado_por = null, confirmado_em = null, versao = versao + 1 where id = p_rodada;
end;
$$;

create or replace function public.confirmar_times(p_rodada uuid, p_versao integer, p_times jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_round public.rodadas%rowtype; v_count integer; v_team jsonb; v_id uuid;
begin
  if not public.is_organizer(auth.uid()) then raise exception 'Somente organizadores podem confirmar times.'; end if;
  select * into v_round from public.rodadas where id = p_rodada for update;
  if not found then raise exception 'Rodada não encontrada.'; end if;
  if p_versao is distinct from v_round.versao then raise exception 'A rodada foi alterada. Atualize a tela antes de continuar.'; end if;
  select count(*) into v_count from public.rodada_participantes
    where rodada_id = p_rodada and tipo = 'linha' and status = 'presente';
  if v_count < 20 then raise exception 'São necessários 20 jogadores de linha para formar 4 times de 5.'; end if;
  if v_count > 20 then raise exception 'Existem mais de 20 jogadores disponíveis. Ajuste a lista antes de sortear.'; end if;
  if (select count(*) from public.rodada_participantes where rodada_id = p_rodada and tipo = 'goleiro_fixo' and status <> 'removido') <> 2 then
    raise exception 'A rodada deve ter exatamente 2 goleiros fixos.';
  end if;
  if p_times is null or jsonb_typeof(p_times) <> 'array' then raise exception 'Times inválidos.'; end if;
  if jsonb_array_length(p_times) <> 4 then raise exception 'São necessários 4 times.'; end if;
  if (select count(distinct (x->>'numero')::integer) from jsonb_array_elements(p_times) x
      where (x->>'numero')::integer between 1 and 4) <> 4 then raise exception 'Numeração dos times inválida.'; end if;
  for v_team in select value from jsonb_array_elements(p_times) loop
    if v_team->'jogadores' is null or jsonb_typeof(v_team->'jogadores') <> 'array' then raise exception 'Jogadores inválidos.'; end if;
    if jsonb_array_length(v_team->'jogadores') <> 5 then raise exception 'Cada time deve ter exatamente 5 jogadores de linha.'; end if;
    if coalesce(length(trim(v_team->>'nome')), 0) not between 1 and 100 then raise exception 'Nome de time inválido.'; end if;
  end loop;
  if (select count(distinct j.value::uuid) from jsonb_array_elements(p_times) t,
      lateral jsonb_array_elements_text(t->'jogadores') j(value)) <> 20 then raise exception 'Existem jogadores repetidos nos times.'; end if;
  if exists (select 1 from jsonb_array_elements(p_times) t, lateral jsonb_array_elements_text(t->'jogadores') j(value)
    where not exists (select 1 from public.rodada_participantes p
      where p.id = j.value::uuid and p.rodada_id = p_rodada and p.tipo = 'linha' and p.status = 'presente')) then
    raise exception 'Somente jogadores de linha presentes desta rodada podem participar dos times.';
  end if;
  delete from public.times where rodada_id = p_rodada;
  for v_team in select value from jsonb_array_elements(p_times) loop
    insert into public.times(rodada_id, numero, nome, cor)
      values (p_rodada, (v_team->>'numero')::integer, trim(v_team->>'nome'), v_team->>'cor') returning id into v_id;
    insert into public.time_jogadores(rodada_id, time_id, participante_id)
      select p_rodada, v_id, value::uuid from jsonb_array_elements_text(v_team->'jogadores');
  end loop;
  update public.rodadas set confirmado = true, confirmado_por = auth.uid(), confirmado_em = now(), versao = versao + 1 where id = p_rodada;
end;
$$;

create or replace function public.ler_sorteio(p_rodada uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_result jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and active) then raise exception 'Acesso não autorizado.'; end if;
  select jsonb_build_object(
    'rodada', jsonb_build_object('id', r.id, 'nome', r.nome, 'data', r.data, 'versao', r.versao, 'confirmado', r.confirmado),
    'participantes', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'tipo', p.tipo, 'status', p.status) order by p.created_at, p.id)
      from public.rodada_participantes p where p.rodada_id = r.id), '[]'::jsonb),
    'times', case when r.confirmado or public.is_organizer(auth.uid()) then coalesce((
      select jsonb_agg(jsonb_build_object('numero', t.numero, 'nome', t.nome, 'cor', t.cor,
        'jogadores', coalesce((select jsonb_agg(j.participante_id order by j.created_at, j.id) from public.time_jogadores j where j.time_id = t.id), '[]'::jsonb)) order by t.numero)
      from public.times t where t.rodada_id = r.id), '[]'::jsonb) else '[]'::jsonb end
  ) into v_result from public.rodadas r where r.id = p_rodada;
  if v_result is null then raise exception 'Rodada não encontrada.'; end if;
  return v_result;
end;
$$;

revoke all on function public.criar_rodada(text, date), public.salvar_participantes(uuid, integer, jsonb),
  public.confirmar_times(uuid, integer, jsonb), public.ler_sorteio(uuid) from public, anon;
grant execute on function public.criar_rodada(text, date), public.salvar_participantes(uuid, integer, jsonb),
  public.confirmar_times(uuid, integer, jsonb), public.ler_sorteio(uuid) to authenticated;

commit;
