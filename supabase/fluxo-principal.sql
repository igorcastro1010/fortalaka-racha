-- Incremental. Executar APÓS entrada-avaliacoes.sql (e suas dependências).
-- Não remove tabelas, rodadas, participantes, composições ou resultados.
begin;

alter table public.rachas drop constraint if exists rachas_estado_check;
alter table public.rachas add constraint rachas_estado_check
  check(estado in ('aberto','lista_fechada','times_confirmados','em_andamento','finalizado'));
-- Toda rodada nasce aberta; mudanças de estado continuam pelas RPCs autorizadas.
create or replace function public.validar_criacao_rodada() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if new.estado<>'aberto' or new.avaliacoes_abertas or new.finalizada_at is not null then
    raise exception 'Crie a rodada aberta, com avaliações fechadas.';
  end if;
  return new;
end; $$;
drop trigger if exists validar_criacao_rodada on public.rachas;
create trigger validar_criacao_rodada before insert on public.rachas
  for each row execute function public.validar_criacao_rodada();

alter table public.times add column if not exists ativo boolean not null default true;
alter table public.time_jogadores add column if not exists ativo boolean not null default true;
alter table public.time_jogadores add column if not exists tipo text not null default 'linha'
  check(tipo in ('linha','goleiro'));
-- Oculta composições substituídas também nas consultas diretas, preservando o histórico.
alter policy "Users can view confirmed teams" on public.times
  using(confirmado and ativo);
alter policy "Users can view confirmed team players" on public.time_jogadores
  using(ativo and exists(select 1 from public.times t where t.id=time_id and t.confirmado and t.ativo));

alter table public.partidas add column if not exists sequencia_fila integer;
update public.partidas p set sequencia_fila=q.n
from (select id,row_number() over(partition by racha_id order by created_at,id)::integer n from public.partidas) q
where p.id=q.id and p.sequencia_fila is null;

create table if not exists public.fila_times (
  racha_id uuid primary key references public.rachas(id),
  ordem_inicial uuid[] not null default '{}',
  ordem uuid[] not null default '{}',
  versao integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.fila_times enable row level security;
revoke all on public.fila_times from public,anon,authenticated;
grant select on public.fila_times to authenticated;
drop policy if exists fila_read on public.fila_times;
create policy fila_read on public.fila_times for select to authenticated
  using(exists(select 1 from public.profiles where id=auth.uid() and active));

-- Inicializa sem sobrescrever filas que já foram persistidas.
insert into public.fila_times(racha_id,ordem_inicial,ordem)
select r.id,array_agg(t.id order by t.numero),array_agg(t.id order by t.numero)
from public.rachas r join public.times t on t.racha_id=r.id and t.ativo and t.confirmado
group by r.id on conflict(racha_id) do nothing;

create or replace function public.recalcular_fila(p_racha uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare ordem_atual uuid[]; aguardando uuid[]; m record; vencedor uuid; perdedor uuid;
begin
  select ordem_inicial into ordem_atual from public.fila_times where racha_id=p_racha for update;
  if not found then return; end if;
  for m in select * from public.partidas where racha_id=p_racha and status='finalizada'
    order by sequencia_fila nulls last,created_at,id loop
    aguardando := array_remove(array_remove(ordem_atual,m.time_a_id),m.time_b_id);
    if m.placar_a=m.placar_b then
      ordem_atual := aguardando || array[m.time_a_id,m.time_b_id];
    else
      vencedor := case when m.placar_a>m.placar_b then m.time_a_id else m.time_b_id end;
      perdedor := case when m.placar_a>m.placar_b then m.time_b_id else m.time_a_id end;
      ordem_atual := array[vencedor] || aguardando || array[perdedor];
    end if;
  end loop;
  update public.fila_times set ordem=ordem_atual,versao=versao+1,updated_at=now() where racha_id=p_racha;
end; $$;
-- Recupera a fila de rodadas antigas a partir dos resultados preservados.
do $$ declare rid uuid; begin
  for rid in select racha_id from public.fila_times where versao=0 loop perform public.recalcular_fila(rid); end loop;
end; $$;

create or replace function public.proteger_lista_sorteio()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare rid uuid; state text; admin boolean; uid uuid; pname text;
begin
  rid := case when tg_op='DELETE' then old.racha_id else new.racha_id end;
  uid := auth.uid(); admin := public.is_organizer(uid);
  if tg_op='UPDATE' and (new.racha_id<>old.racha_id or new.id<>old.id or new.jogador_id is distinct from old.jogador_id) then
    raise exception 'Não mova participantes entre rodadas ou jogadores.';
  end if;
  select estado into state from public.rachas where id=rid for update;
  if state='finalizado' then raise exception 'Rodada finalizada: a lista está preservada.'; end if;
  if not admin then
    if state<>'aberto' then raise exception 'A lista está fechada.'; end if;
    if not exists(select 1 from public.profiles where id=uid and active) then raise exception 'Entre para participar.'; end if;
    if (case when tg_op='DELETE' then old.jogador_id else new.jogador_id end) is distinct from uid then
      raise exception 'Você só pode alterar a própria inscrição.';
    end if;
    if tg_op<>'DELETE' then
      if new.tipo not in ('linha','goleiro') or new.status not in ('confirmado','removido') then raise exception 'Escolha Linha ou Goleiro.'; end if;
      if tg_op='INSERT' and new.status<>'confirmado' then raise exception 'A inscrição deve ser confirmada.'; end if;
      select name into pname from public.profiles where id=uid;
      new.nome := pname;
    end if;
  end if;
  -- Uma alteração administrativa não apaga os times nem a participação histórica.
  if not exists(select 1 from public.partidas where racha_id=rid) then
    update public.times set ativo=false,confirmado=false where racha_id=rid;
    update public.time_jogadores set ativo=false where time_id in(select id from public.times where racha_id=rid);
    if state='times_confirmados' then update public.rachas set estado='lista_fechada' where id=rid; end if;
  end if;
  update public.rachas set versao=versao+1,updated_at=now() where id=rid;
  return case when tg_op='DELETE' then old else new end;
end; $$;

drop policy if exists self_participant_insert on public.racha_participantes;
create policy self_participant_insert on public.racha_participantes for insert to authenticated
  with check(jogador_id=auth.uid() and tipo in ('linha','goleiro') and status='confirmado'
    and exists(select 1 from public.profiles where id=auth.uid() and active)
    and exists(select 1 from public.rachas where id=racha_id and estado='aberto'));
drop policy if exists self_participant_update on public.racha_participantes;
create policy self_participant_update on public.racha_participantes for update to authenticated
  using(jogador_id=auth.uid() and exists(select 1 from public.rachas where id=racha_id and estado='aberto'))
  with check(jogador_id=auth.uid() and tipo in ('linha','goleiro') and status in ('confirmado','removido')
    and exists(select 1 from public.profiles where id=auth.uid() and active)
    and exists(select 1 from public.rachas where id=racha_id and estado='aberto'));
drop policy if exists self_participant_delete on public.racha_participantes;
create policy self_participant_delete on public.racha_participantes for delete to authenticated
  using(jogador_id=auth.uid() and exists(select 1 from public.profiles where id=auth.uid() and active)
    and exists(select 1 from public.rachas where id=racha_id and estado='aberto'));

create or replace function public.inscricao_rodada(p_racha uuid,p_tipo text default null,p_entrar boolean default true)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare pname text;
begin
  select name into pname from public.profiles where id=auth.uid() and active;
  if not found then raise exception 'Entre para participar.'; end if;
  perform 1 from public.rachas where id=p_racha and estado='aberto' for update;
  if not found then raise exception 'A lista está fechada.'; end if;
  if p_entrar then
    if p_tipo is null or p_tipo not in ('linha','goleiro') then raise exception 'Escolha Linha ou Goleiro.'; end if;
    insert into public.racha_participantes(racha_id,jogador_id,nome,tipo,status)
      values(p_racha,auth.uid(),pname,p_tipo,'confirmado')
      on conflict(racha_id,jogador_id) where jogador_id is not null
      do update set tipo=excluded.tipo,status='confirmado',nome=excluded.nome;
  else
    update public.racha_participantes set status='removido' where racha_id=p_racha and jogador_id=auth.uid();
  end if;
end; $$;

create or replace function public.alterar_estado_rodada(p_racha uuid,p_estado text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.rachas%rowtype;
begin
  if not public.is_organizer(auth.uid()) then raise exception 'Somente organizadores podem gerenciar rodadas.'; end if;
  select * into r from public.rachas where id=p_racha for update;
  if not found then raise exception 'Rodada não encontrada.'; end if;
  if r.estado='finalizado' then raise exception 'Rodada finalizada não pode ser alterada.'; end if;
  if p_estado='lista_fechada' then
    if r.estado<>'aberto' then raise exception 'A rodada não está aberta.'; end if;
  elsif p_estado='aberto' then
    if r.estado not in ('lista_fechada','times_confirmados') or exists(select 1 from public.partidas where racha_id=p_racha) then
      raise exception 'O racha já começou. Ajuste a lista sem reabrir o sorteio.';
    end if;
    update public.times set confirmado=false where racha_id=p_racha;
  elsif p_estado='em_andamento' then
    if r.estado<>'times_confirmados' then raise exception 'Confirme os times antes de iniciar.'; end if;
  elsif p_estado='finalizado' then
    if not exists(select 1 from public.partidas where racha_id=p_racha and status='finalizada') then
      raise exception 'Finalize pelo menos uma partida antes de encerrar a rodada.';
    end if;
    if r.estado not in ('times_confirmados','em_andamento') then raise exception 'Confirme os times antes de finalizar.'; end if;
  else raise exception 'Estado inválido.';
  end if;
  update public.rachas set estado=p_estado,versao=versao+1,updated_at=now(),
    finalizada_at=case when p_estado='finalizado' then now() else finalizada_at end where id=p_racha;
end; $$;

create or replace function public.validar_composicao_times(p_racha uuid,p_times jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer; k integer; t jsonb; sizes integer[] := '{}'; ids uuid[] := '{}'; keepers uuid[] := '{}'; gid uuid;
begin
  select count(*) into n from public.racha_participantes where racha_id=p_racha and tipo='linha' and status='confirmado';
  if n=0 then raise exception 'Nenhum jogador de linha disponível para sorteio.'; end if;
  k := ceil(n/5.0);
  if p_times is null or jsonb_typeof(p_times)<>'array' or jsonb_array_length(p_times)<>k then raise exception 'Quantidade de times inválida.'; end if;
  if (select count(distinct (value->>'numero')::int) from jsonb_array_elements(p_times) where (value->>'numero')::int between 1 and k)<>k then raise exception 'Numeração inválida.'; end if;
  for t in select value from jsonb_array_elements(p_times) loop
    if t->'jogadores' is null or jsonb_typeof(t->'jogadores')<>'array' then raise exception 'Jogadores inválidos.'; end if;
    sizes := array_append(sizes,jsonb_array_length(t->'jogadores'));
    if jsonb_array_length(t->'jogadores') not between 1 and 5 then raise exception 'Cada time deve ter de 1 a 5 jogadores de linha.'; end if;
    if coalesce(length(trim(t->>'nome')),0) not between 1 and 100 then raise exception 'Nome inválido.'; end if;
    ids := ids || array(select value::uuid from jsonb_array_elements_text(t->'jogadores'));
    gid := (t->>'goleiro')::uuid;
    if gid is not null then
      if not exists(select 1 from public.racha_participantes where id=gid and racha_id=p_racha and tipo='goleiro' and status='confirmado' and jogador_id is not null) then raise exception 'Goleiro inválido.'; end if;
      keepers := array_append(keepers,gid);
    end if;
  end loop;
  if (select max(s)-min(s) from unnest(sizes) s)>1 then raise exception 'Os times devem estar equilibrados.'; end if;
  if cardinality(ids)<>n or (select count(distinct id) from unnest(ids) id)<>n then raise exception 'Jogadores repetidos ou faltantes.'; end if;
  if (select count(distinct id) from unnest(keepers) id)<>cardinality(keepers) then raise exception 'Goleiro repetido entre times.'; end if;
  if exists(select 1 from unnest(ids) u(id) where not exists(select 1 from public.racha_participantes p where p.id=u.id and p.racha_id=p_racha and p.tipo='linha' and p.status='confirmado' and p.jogador_id is not null)) then raise exception 'Somente jogadores de linha confirmados desta rodada podem participar.'; end if;
end; $$;

create or replace function public.salvar_rascunho_times(p_racha uuid,p_versao integer,p_times jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.rachas%rowtype; t jsonb; tid uuid;
begin
  if not public.is_organizer(auth.uid()) then raise exception 'Somente organizadores podem alterar times.'; end if;
  select * into r from public.rachas where id=p_racha for update;
  if not found then raise exception 'Rodada não encontrada.'; end if;
  if r.versao is distinct from p_versao then raise exception 'A rodada foi alterada. Atualize a tela antes de salvar.'; end if;
  if r.estado not in ('lista_fechada','times_confirmados') or exists(select 1 from public.partidas where racha_id=p_racha) then raise exception 'Não é possível sortear após iniciar o racha. Feche a lista antes de sortear.'; end if;
  perform public.validar_composicao_times(p_racha,p_times);
  update public.times set ativo=false,confirmado=false where racha_id=p_racha;
  update public.time_jogadores set ativo=false where time_id in(select id from public.times where racha_id=p_racha);
  for t in select value from jsonb_array_elements(p_times) loop
    insert into public.times(racha_id,nome,numero,confirmado,ativo) values(p_racha,trim(t->>'nome'),(t->>'numero')::int,false,true)
      on conflict(racha_id,numero) do update set nome=excluded.nome,ativo=true,confirmado=false returning id into tid;
    insert into public.time_jogadores(time_id,jogador_id,participante_id,tipo,ativo)
      select tid,p.jogador_id,p.id,p.tipo,true from public.racha_participantes p
      where p.id in(select value::uuid from jsonb_array_elements_text(t->'jogadores')) or p.id=(t->>'goleiro')::uuid
      on conflict(time_id,jogador_id) do update set participante_id=excluded.participante_id,tipo=excluded.tipo,ativo=true;
  end loop;
  update public.rachas set estado='lista_fechada',versao=versao+1,updated_at=now() where id=p_racha;
end; $$;

create or replace function public.confirmar_rascunho_times(p_racha uuid,p_versao integer)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.rachas%rowtype; payload jsonb; ordem_times uuid[];
begin
  if not public.is_organizer(auth.uid()) then raise exception 'Somente organizadores podem confirmar times.'; end if;
  select * into r from public.rachas where id=p_racha for update;
  if not found then raise exception 'Rodada não encontrada.'; end if;
  if r.versao is distinct from p_versao then raise exception 'A rodada foi alterada. Atualize a tela antes de confirmar.'; end if;
  if r.estado<>'lista_fechada' or exists(select 1 from public.partidas where racha_id=p_racha) then raise exception 'A lista precisa estar fechada antes do início do racha.'; end if;
  select jsonb_agg(jsonb_build_object('numero',t.numero,'nome',t.nome,'jogadores',
    coalesce((select jsonb_agg(j.participante_id) from public.time_jogadores j where j.time_id=t.id and j.ativo and j.tipo='linha'),'[]'::jsonb),
    'goleiro',(select j.participante_id from public.time_jogadores j where j.time_id=t.id and j.ativo and j.tipo='goleiro' limit 1)))
    into payload from public.times t where t.racha_id=p_racha and t.ativo;
  perform public.validar_composicao_times(p_racha,payload);
  update public.times set confirmado=true where racha_id=p_racha and ativo;
  select array_agg(id order by numero) into ordem_times from public.times where racha_id=p_racha and ativo;
  insert into public.fila_times(racha_id,ordem_inicial,ordem) values(p_racha,ordem_times,ordem_times)
    on conflict(racha_id) do update set ordem_inicial=excluded.ordem_inicial,ordem=excluded.ordem,versao=fila_times.versao+1,updated_at=now();
  update public.rachas set estado='times_confirmados',versao=versao+1,updated_at=now() where id=p_racha;
end; $$;

create or replace function public.validar_partida() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  -- Sempre bloqueia a rodada antes da partida: serializa os cinco organizadores.
  perform 1 from public.rachas where id=new.racha_id for update;
  if tg_op='INSERT' then
    if not exists(select 1 from public.rachas where id=new.racha_id and estado in ('times_confirmados','em_andamento'))
      or (select count(*) from public.times where id in(new.time_a_id,new.time_b_id) and racha_id=new.racha_id and confirmado and ativo)<>2 then raise exception 'Escolha dois times confirmados da mesma rodada.'; end if;
    if exists(select 1 from public.partidas where racha_id=new.racha_id and status='aberta') then raise exception 'Finalize a partida atual antes de iniciar outra.'; end if;
    select coalesce(max(sequencia_fila),0)+1 into new.sequencia_fila from public.partidas where racha_id=new.racha_id;
  elsif new.racha_id<>old.racha_id or new.time_a_id<>old.time_a_id or new.time_b_id<>old.time_b_id or new.sequencia_fila is distinct from old.sequencia_fila then
    raise exception 'Os times e a ordem histórica da partida não podem ser substituídos.';
  elsif new.status='aberta' and (exists(select 1 from public.rachas where id=new.racha_id and estado='finalizado')
    or exists(select 1 from public.partidas where racha_id=new.racha_id and status='aberta' and id<>new.id)) then
    raise exception 'Não é possível reabrir esta partida.';
  end if;
  new.updated_at=now();
  if tg_op='UPDATE' then new.versao=old.versao+1; end if;
  return new;
end; $$;

create or replace function public.atualizar_fila_partida() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' then
    update public.rachas set estado='em_andamento',updated_at=now(),versao=versao+1 where id=new.racha_id and estado='times_confirmados';
  end if;
  if not exists(select 1 from public.rachas where id=new.racha_id and estado='finalizado') then
    perform public.recalcular_fila(new.racha_id);
  end if;
  return new;
end; $$;
drop trigger if exists atualizar_fila_partida on public.partidas;
create trigger atualizar_fila_partida after insert or update on public.partidas for each row execute function public.atualizar_fila_partida();

create or replace function public.criar_partida(p_racha uuid,p_time_a uuid,p_time_b uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare pid uuid;
begin
  if not public.is_organizer(auth.uid()) then raise exception 'Somente organizadores podem criar partidas.'; end if;
  insert into public.partidas(racha_id,time_a_id,time_b_id) values(p_racha,p_time_a,p_time_b) returning id into pid;
  insert into public.partida_jogadores(partida_id,jogador_id,time_id)
    select pid,j.jogador_id,j.time_id from public.time_jogadores j where j.time_id in(p_time_a,p_time_b) and j.ativo;
  if not exists(select 1 from public.partida_jogadores where partida_id=pid) then raise exception 'Os times não têm jogadores.'; end if;
  return pid;
end; $$;

create or replace function public.criar_proxima_partida(p_racha uuid,p_versao integer) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.fila_times%rowtype;
begin
  if not public.is_organizer(auth.uid()) then raise exception 'Somente organizadores podem criar partidas.'; end if;
  perform 1 from public.rachas where id=p_racha and estado in ('times_confirmados','em_andamento') for update;
  if not found then raise exception 'Confirme os times. O racha não pode estar finalizado.'; end if;
  select * into f from public.fila_times where racha_id=p_racha for update;
  if not found or cardinality(f.ordem)<2 then raise exception 'Confirme pelo menos dois times para jogar.'; end if;
  if f.versao is distinct from p_versao then raise exception 'A fila foi alterada. Atualize antes de iniciar.'; end if;
  return public.criar_partida(p_racha,f.ordem[1],f.ordem[2]);
end; $$;

-- As gravações históricas seguem pela RPC existente, evitando exclusões diretas.
revoke insert,update,delete on public.partidas,public.partida_jogadores,public.eventos_partida from authenticated;
revoke delete on public.rachas from authenticated;
revoke all on function public.recalcular_fila(uuid),public.atualizar_fila_partida() from public,anon,authenticated;
revoke all on function public.inscricao_rodada(uuid,text,boolean),public.criar_proxima_partida(uuid,integer) from public,anon;
grant execute on function public.inscricao_rodada(uuid,text,boolean),public.criar_proxima_partida(uuid,integer) to authenticated;

-- Leitores e serialização complementar definidos abaixo.
create or replace function public.ler_times_rodada()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'Acesso não autorizado.'; end if;
  select jsonb_build_object('roundId',r.id,'roundName',r.nome,'status',r.estado,'version',r.versao,
    'confirmed',r.estado in ('times_confirmados','em_andamento','finalizado'),
    'goalkeepers',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'jogadorId',p.jogador_id,'name',p.nome,
      'type',p.tipo,'status',p.status,'avatarUrl',f.avatar_url) order by p.created_at,p.id)
      from public.racha_participantes p left join public.profiles f on f.id=p.jogador_id
      where p.racha_id=r.id and p.tipo='goleiro' and p.status='confirmado'),'[]'::jsonb),
    'fieldPlayers',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'jogadorId',p.jogador_id,'name',p.nome,
      'type',p.tipo,'status',p.status,'avatarUrl',f.avatar_url) order by p.created_at,p.id)
      from public.racha_participantes p left join public.profiles f on f.id=p.jogador_id
      where p.racha_id=r.id and p.tipo='linha' and p.status='confirmado'),'[]'::jsonb),
    'teams',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.nome,'number',t.numero,'players',
      coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'jogadorId',j.jogador_id,'name',p.nome,'avatarUrl',f.avatar_url) order by j.created_at,j.id)
        from public.time_jogadores j join public.racha_participantes p on p.id=j.participante_id
        left join public.profiles f on f.id=j.jogador_id where j.time_id=t.id and j.ativo and j.tipo='linha'),'[]'::jsonb),
      'goalkeeper',(select jsonb_build_object('id',j.participante_id,'jogadorId',j.jogador_id,'name',f.name,'avatarUrl',f.avatar_url) from public.time_jogadores j join public.profiles f on f.id=j.jogador_id where j.time_id=t.id and j.ativo and j.tipo='goleiro' limit 1)) order by t.numero)
      from public.times t where t.racha_id=r.id and t.ativo and (public.is_organizer(auth.uid()) or (t.confirmado and r.estado in ('times_confirmados','em_andamento','finalizado')))),'[]'::jsonb))
    into result from public.rachas r order by r.data desc nulls last,r.created_at desc,r.id desc limit 1;
  return result;
end;
$$;

create or replace function public.ler_partidas_rodada(p_racha uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'Entre para consultar as partidas.'; end if;
 return jsonb_build_object('roundStatus',(select estado from public.rachas where id=p_racha),'times',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'nome',t.nome) order by t.numero) from public.times t where t.racha_id=p_racha and t.confirmado and t.ativo),'[]'::jsonb),
 'fila',(select jsonb_build_object('order',f.ordem,'version',f.versao,'currentMatchId',(select id from public.partidas where racha_id=p_racha and status='aberta' order by sequencia_fila nulls last,created_at,id limit 1)) from public.fila_times f where f.racha_id=p_racha),
 'partidas',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'versao',p.versao,'timeAId',p.time_a_id,'timeBId',p.time_b_id,'timeA',a.nome,'timeB',b.nome,'placarA',p.placar_a,'placarB',p.placar_b,'status',p.status,
 'createdAt',p.created_at,'finalizadaAt',p.finalizada_at,
 'jogadores',coalesce((select jsonb_agg(jsonb_build_object('jogador_id',j.jogador_id,'nome',pr.name,'avatar_url',pr.avatar_url,'time_id',j.time_id,'participou',j.participou,
 'gols',coalesce((select sum(e.quantidade) from public.eventos_partida e where e.partida_id=p.id and e.jogador_id=j.jogador_id and e.tipo='gol'),0),
 'assistencias',coalesce((select sum(e.quantidade) from public.eventos_partida e where e.partida_id=p.id and e.jogador_id=j.jogador_id and e.tipo='assistencia'),0)) order by j.time_id,pr.name)
 from public.partida_jogadores j join public.profiles pr on pr.id=j.jogador_id where j.partida_id=p.id),'[]'::jsonb)) order by p.sequencia_fila nulls last,p.created_at,p.id)
 from public.partidas p join public.times a on a.id=p.time_a_id join public.times b on b.id=p.time_b_id where p.racha_id=p_racha),'[]'::jsonb));
end; $$;
create or replace function public.salvar_partida(p_partida uuid,p_versao integer,p_placar_a integer,p_placar_b integer,p_status text,p_jogadores jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare m public.partidas; item jsonb; ja integer; jb integer;
begin
 if not public.is_organizer(auth.uid()) then raise exception 'Somente organizadores podem editar partidas.'; end if;
 select * into m from public.partidas where id=p_partida;
 if not found then raise exception 'Partida não encontrada.'; end if;
 perform 1 from public.rachas where id=m.racha_id for update;
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
 update public.partidas set placar_a=p_placar_a,placar_b=p_placar_b,status=p_status,
  finalizada_at=case when p_status='finalizada' then coalesce(m.finalizada_at,now()) else null end
 where id=p_partida;
 select coalesce(sum(e.quantidade) filter(where j.time_id=m.time_a_id),0),coalesce(sum(e.quantidade) filter(where j.time_id=m.time_b_id),0)
 into ja,jb from public.eventos_partida e join public.partida_jogadores j using(partida_id,jogador_id) where e.partida_id=p_partida and e.tipo='gol';
 return jsonb_build_object('aviso',case when (ja+jb)>0 and (ja<>p_placar_a or jb<>p_placar_b) then 'O placar difere dos gols registrados. Confira os lançamentos.' else null end);
end; $$;


commit;
