-- Incremental: executar após schema.sql, sorteio-times.sql e validacao-sorteio-avatars.sql.
begin;
create table if not exists public.partidas (
 id uuid primary key default gen_random_uuid(),
 racha_id uuid not null references public.rachas(id) on delete cascade,
 time_a_id uuid not null references public.times(id),
 time_b_id uuid not null references public.times(id),
 placar_a integer not null default 0 check(placar_a>=0),
 placar_b integer not null default 0 check(placar_b>=0),
 status text not null default 'aberta' check(status in ('aberta','finalizada','cancelada')),
 versao integer not null default 0,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(time_a_id<>time_b_id)
);
create table if not exists public.partida_jogadores (
 id uuid primary key default gen_random_uuid(),
 partida_id uuid not null references public.partidas(id) on delete cascade,
 jogador_id uuid not null references public.profiles(id),
 time_id uuid not null references public.times(id),
 participou boolean not null default true,
 created_at timestamptz not null default now(),
 unique(partida_id,jogador_id)
);
create table if not exists public.eventos_partida (
 id uuid primary key default gen_random_uuid(),
 partida_id uuid not null references public.partidas(id) on delete cascade,
 jogador_id uuid not null references public.profiles(id),
 tipo text not null check(tipo in ('gol','assistencia')),
 quantidade integer not null default 1 check(quantidade>0),
 created_at timestamptz not null default now(),
 foreign key(partida_id,jogador_id) references public.partida_jogadores(partida_id,jogador_id) on delete cascade
);
create index if not exists partidas_racha_idx on public.partidas(racha_id,created_at);
create index if not exists partida_jogadores_jogador_idx on public.partida_jogadores(jogador_id,partida_id);
create index if not exists eventos_partida_partida_idx on public.eventos_partida(partida_id,jogador_id,tipo);

create or replace function public.validar_partida() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then
  perform 1 from public.rachas where id=new.racha_id and estado in ('times_confirmados','finalizado') for update;
  if not found or (select count(*) from public.times where id in(new.time_a_id,new.time_b_id) and racha_id=new.racha_id and confirmado)<>2 then
   raise exception 'Escolha dois times confirmados da mesma rodada.';
  end if;
 elsif new.racha_id<>old.racha_id or new.time_a_id<>old.time_a_id or new.time_b_id<>old.time_b_id then
  raise exception 'Os times de uma partida não podem ser substituídos. Crie outra partida.';
 end if;
 new.updated_at=now();
 if tg_op='UPDATE' then new.versao=old.versao+1; end if;
 return new;
end; $$;
drop trigger if exists validar_partida on public.partidas;
create trigger validar_partida before insert or update on public.partidas for each row execute function public.validar_partida();

create or replace function public.validar_jogador_partida() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 perform 1 from public.partidas where id=new.partida_id for update;
 if tg_op='UPDATE' then
  if new.partida_id<>old.partida_id or new.jogador_id<>old.jogador_id or new.time_id<>old.time_id then raise exception 'A identidade histórica da participação não pode mudar.'; end if;
 else
  if not exists(select 1 from public.partidas p join public.time_jogadores j on j.time_id=new.time_id
   where p.id=new.partida_id and new.time_id in(p.time_a_id,p.time_b_id) and j.jogador_id=new.jogador_id) then
   raise exception 'Jogador não pertence aos times desta partida.';
  end if;
 end if;
 return new;
end; $$;
drop trigger if exists validar_jogador_partida on public.partida_jogadores;
create trigger validar_jogador_partida before insert or update on public.partida_jogadores for each row execute function public.validar_jogador_partida();

create or replace function public.validar_evento_partida() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 perform 1 from public.partidas where id=new.partida_id for update;
 if not exists(select 1 from public.partida_jogadores where partida_id=new.partida_id and jogador_id=new.jogador_id and participou) then
  raise exception 'Somente participantes da partida podem receber eventos.';
 end if;
 return new;
end; $$;
drop trigger if exists validar_evento_partida on public.eventos_partida;
create trigger validar_evento_partida before insert or update on public.eventos_partida for each row execute function public.validar_evento_partida();

alter table public.partidas enable row level security;
alter table public.partida_jogadores enable row level security;
alter table public.eventos_partida enable row level security;
revoke all on public.partidas,public.partida_jogadores,public.eventos_partida from anon;
grant select,insert,update,delete on public.partidas,public.partida_jogadores,public.eventos_partida to authenticated;
do $$ declare t text; begin
 foreach t in array array['partidas','partida_jogadores','eventos_partida'] loop
  execute format('drop policy if exists partidas_read on public.%I',t);
  execute format('create policy partidas_read on public.%I for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and active))',t);
  execute format('drop policy if exists partidas_manage on public.%I',t);
  execute format('create policy partidas_manage on public.%I for all to authenticated using(public.is_organizer(auth.uid())) with check(public.is_organizer(auth.uid()))',t);
 end loop;
end; $$;

create or replace function public.criar_partida(p_racha uuid,p_time_a uuid,p_time_b uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare pid uuid;
begin
 if not public.is_organizer(auth.uid()) then raise exception 'Somente organizadores podem criar partidas.'; end if;
 insert into public.partidas(racha_id,time_a_id,time_b_id) values(p_racha,p_time_a,p_time_b) returning id into pid;
 insert into public.partida_jogadores(partida_id,jogador_id,time_id)
  select pid,j.jogador_id,j.time_id from public.time_jogadores j where j.time_id in(p_time_a,p_time_b);
 if not exists(select 1 from public.partida_jogadores where partida_id=pid) then raise exception 'Os times não têm jogadores.'; end if;
 return pid;
end; $$;

create or replace function public.salvar_partida(p_partida uuid,p_versao integer,p_placar_a integer,p_placar_b integer,p_status text,p_jogadores jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare m public.partidas; item jsonb; ja integer; jb integer;
begin
 if not public.is_organizer(auth.uid()) then raise exception 'Somente organizadores podem editar partidas.'; end if;
 select * into m from public.partidas where id=p_partida for update;
 if not found then raise exception 'Partida não encontrada.'; end if;
 if p_versao is distinct from m.versao then raise exception 'A partida foi alterada em outra sessão. Atualize antes de salvar.'; end if;
 if p_placar_a is null or p_placar_b is null or p_placar_a<0 or p_placar_b<0 or p_status is null or p_status not in('aberta','finalizada','cancelada') then raise exception 'Placar ou status inválido.'; end if;
 if p_jogadores is null or jsonb_typeof(p_jogadores)<>'array' then raise exception 'Lista de jogadores inválida.'; end if;
 if jsonb_array_length(p_jogadores)<>(select count(*) from public.partida_jogadores where partida_id=p_partida)
  or (select count(distinct value->>'jogador_id') from jsonb_array_elements(p_jogadores))<>jsonb_array_length(p_jogadores) then raise exception 'Envie todos os participantes, sem duplicatas.'; end if;
 for item in select value from jsonb_array_elements(p_jogadores) loop
  if not exists(select 1 from public.partida_jogadores where partida_id=p_partida and jogador_id=(item->>'jogador_id')::uuid)
   or jsonb_typeof(item->'participou') is distinct from 'boolean'
   or item->>'gols' is null or item->>'assistencias' is null
   or item->>'gols' !~ '^[0-9]+$' or item->>'assistencias' !~ '^[0-9]+$' then raise exception 'Participação ou eventos inválidos.'; end if;
  if not (item->>'participou')::boolean and ((item->>'gols')::integer>0 or (item->>'assistencias')::integer>0) then raise exception 'Jogador que não participou não pode ter gols ou assistências.'; end if;
 end loop;
 delete from public.eventos_partida where partida_id=p_partida;
 for item in select value from jsonb_array_elements(p_jogadores) loop
  update public.partida_jogadores set participou=(item->>'participou')::boolean where partida_id=p_partida and jogador_id=(item->>'jogador_id')::uuid;
  if (item->>'gols')::integer>0 then insert into public.eventos_partida(partida_id,jogador_id,tipo,quantidade) values(p_partida,(item->>'jogador_id')::uuid,'gol',(item->>'gols')::integer); end if;
  if (item->>'assistencias')::integer>0 then insert into public.eventos_partida(partida_id,jogador_id,tipo,quantidade) values(p_partida,(item->>'jogador_id')::uuid,'assistencia',(item->>'assistencias')::integer); end if;
 end loop;
 update public.partidas set placar_a=p_placar_a,placar_b=p_placar_b,status=p_status where id=p_partida;
 select coalesce(sum(e.quantidade) filter(where j.time_id=m.time_a_id),0),coalesce(sum(e.quantidade) filter(where j.time_id=m.time_b_id),0)
 into ja,jb from public.eventos_partida e join public.partida_jogadores j using(partida_id,jogador_id) where e.partida_id=p_partida and e.tipo='gol';
 return jsonb_build_object('aviso',case when (ja+jb)>0 and (ja<>p_placar_a or jb<>p_placar_b) then 'O placar difere dos gols registrados. Confira os lançamentos.' else null end);
end; $$;

-- Agrega participações e eventos separadamente para não multiplicar jogos em JOINs.
create or replace view public.estatisticas_jogadores with(security_invoker=true) as
with participacoes as (
 select j.jogador_id,count(*) as jogos,count(*) filter(where (j.time_id=p.time_a_id and p.placar_a>p.placar_b) or (j.time_id=p.time_b_id and p.placar_b>p.placar_a)) as vitorias
 from public.partida_jogadores j join public.partidas p on p.id=j.partida_id where j.participou and p.status='finalizada' group by j.jogador_id
), eventos as (
 select e.jogador_id,coalesce(sum(e.quantidade) filter(where e.tipo='gol'),0) as gols,coalesce(sum(e.quantidade) filter(where e.tipo='assistencia'),0) as assistencias
 from public.eventos_partida e join public.partidas p on p.id=e.partida_id join public.partida_jogadores j on j.partida_id=e.partida_id and j.jogador_id=e.jogador_id
 where p.status='finalizada' and j.participou group by e.jogador_id
)
select p.jogador_id,p.jogos,coalesce(e.gols,0)::bigint as gols,coalesce(e.assistencias,0)::bigint as assistencias,p.vitorias
from participacoes p left join eventos e on e.jogador_id=p.jogador_id;
revoke all on public.estatisticas_jogadores from anon;
grant select on public.estatisticas_jogadores to authenticated;

create or replace function public.ler_estatisticas_jogadores(p_jogador uuid default null)
returns table(jogador_id uuid,nome text,avatar_url text,jogos bigint,gols bigint,assistencias bigint,vitorias bigint)
language plpgsql stable security definer set search_path=public as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'Entre para consultar as estatísticas.'; end if;
 return query select p.id,p.name,p.avatar_url,coalesce(e.jogos,0),coalesce(e.gols,0),coalesce(e.assistencias,0),coalesce(e.vitorias,0)
 from public.profiles p left join public.estatisticas_jogadores e on e.jogador_id=p.id
 where p.active and (p_jogador is null or p.id=p_jogador)
 order by coalesce(e.vitorias,0) desc,coalesce(e.gols,0) desc,coalesce(e.assistencias,0) desc,coalesce(e.jogos,0) desc,p.name,p.id;
end; $$;

create or replace function public.ler_partidas_rodada(p_racha uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'Entre para consultar as partidas.'; end if;
 return jsonb_build_object('times',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'nome',t.nome) order by t.numero) from public.times t where t.racha_id=p_racha and t.confirmado),'[]'::jsonb),
 'partidas',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'versao',p.versao,'timeAId',p.time_a_id,'timeBId',p.time_b_id,'timeA',a.nome,'timeB',b.nome,'placarA',p.placar_a,'placarB',p.placar_b,'status',p.status,
 'jogadores',coalesce((select jsonb_agg(jsonb_build_object('jogador_id',j.jogador_id,'nome',pr.name,'avatar_url',pr.avatar_url,'time_id',j.time_id,'participou',j.participou,
 'gols',coalesce((select sum(e.quantidade) from public.eventos_partida e where e.partida_id=p.id and e.jogador_id=j.jogador_id and e.tipo='gol'),0),
 'assistencias',coalesce((select sum(e.quantidade) from public.eventos_partida e where e.partida_id=p.id and e.jogador_id=j.jogador_id and e.tipo='assistencia'),0)) order by j.time_id,pr.name)
 from public.partida_jogadores j join public.profiles pr on pr.id=j.jogador_id where j.partida_id=p.id),'[]'::jsonb)) order by p.created_at,p.id)
 from public.partidas p join public.times a on a.id=p.time_a_id join public.times b on b.id=p.time_b_id where p.racha_id=p_racha),'[]'::jsonb));
end; $$;
revoke all on function public.criar_partida(uuid,uuid,uuid),public.salvar_partida(uuid,integer,integer,integer,text,jsonb),public.ler_estatisticas_jogadores(uuid),public.ler_partidas_rodada(uuid) from public,anon;
grant execute on function public.criar_partida(uuid,uuid,uuid),public.salvar_partida(uuid,integer,integer,integer,text,jsonb),public.ler_estatisticas_jogadores(uuid),public.ler_partidas_rodada(uuid) to authenticated;
commit;
