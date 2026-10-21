-- Executar após fluxo-principal.sql. Incremental, sem apagar dados existentes.
-- Registros legados tipo=goleiro continuam armazenados; no sorteio atual são participantes comuns.
begin;

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
      if (new.tipo<>'linha' and not (tg_op='UPDATE' and old.tipo='goleiro' and new.tipo=old.tipo and new.status='removido')) or new.status not in ('confirmado','removido') then raise exception 'Inscrição de participante inválida.'; end if;
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

create or replace function public.inscricao_rodada(p_racha uuid,p_tipo text default null,p_entrar boolean default true)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare pname text;
begin
  select name into pname from public.profiles where id=auth.uid() and active;
  if not found then raise exception 'Entre para participar.'; end if;
  perform 1 from public.rachas where id=p_racha and estado='aberto' for update;
  if not found then raise exception 'A lista está fechada.'; end if;
  if p_entrar then
    insert into public.racha_participantes(racha_id,jogador_id,nome,tipo,status)
      values(p_racha,auth.uid(),pname,'linha','confirmado')
      on conflict(racha_id,jogador_id) where jogador_id is not null
      do update set tipo=excluded.tipo,status='confirmado',nome=excluded.nome;
  else
    update public.racha_participantes set status='removido' where racha_id=p_racha and jogador_id=auth.uid();
  end if;
end; $$;

create or replace function public.validar_composicao_times(p_racha uuid,p_times jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer; k integer; t jsonb; sizes integer[] := '{}'; ids uuid[] := '{}';
begin
  select count(*) into n from public.racha_participantes where racha_id=p_racha and tipo in ('linha','goleiro') and status='confirmado' and jogador_id is not null;
  if n=0 then raise exception 'Nenhum participante disponível para sorteio.'; end if;
  k := ceil(n/5.0);
  if p_times is null or jsonb_typeof(p_times)<>'array' or jsonb_array_length(p_times)<>k then raise exception 'Quantidade de times inválida.'; end if;
  if (select count(distinct (value->>'numero')::int) from jsonb_array_elements(p_times) where (value->>'numero')::int between 1 and k)<>k then raise exception 'Numeração inválida.'; end if;
  for t in select value from jsonb_array_elements(p_times) loop
    if t->'jogadores' is null or jsonb_typeof(t->'jogadores')<>'array' then raise exception 'Jogadores inválidos.'; end if;
    sizes := array_append(sizes,jsonb_array_length(t->'jogadores'));
    if jsonb_array_length(t->'jogadores') not between 1 and 5 then raise exception 'Cada time deve ter de 1 a 5 participantes.'; end if;
    if coalesce(length(trim(t->>'nome')),0) not between 1 and 100 then raise exception 'Nome inválido.'; end if;
    ids := ids || array(select value::uuid from jsonb_array_elements_text(t->'jogadores'));
  end loop;
  if (select max(s)-min(s) from unnest(sizes) s)>1 then raise exception 'Os times devem estar equilibrados.'; end if;
  if cardinality(ids)<>n or (select count(distinct id) from unnest(ids) id)<>n then raise exception 'Jogadores repetidos ou faltantes.'; end if;
  if exists(select 1 from unnest(ids) u(id) where not exists(select 1 from public.racha_participantes p where p.id=u.id and p.racha_id=p_racha and p.tipo in ('linha','goleiro') and p.status='confirmado' and p.jogador_id is not null and p.jogador_id is not null)) then raise exception 'Somente participantes confirmados desta rodada podem participar.'; end if;
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
      select tid,p.jogador_id,p.id,'linha',true from public.racha_participantes p
      where p.id in(select value::uuid from jsonb_array_elements_text(t->'jogadores'))
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
    coalesce((select jsonb_agg(j.participante_id) from public.time_jogadores j where j.time_id=t.id and j.ativo),'[]'::jsonb)))
    into payload from public.times t where t.racha_id=p_racha and t.ativo;
  perform public.validar_composicao_times(p_racha,payload);
  update public.times set confirmado=true where racha_id=p_racha and ativo;
  select array_agg(id order by numero) into ordem_times from public.times where racha_id=p_racha and ativo;
  insert into public.fila_times(racha_id,ordem_inicial,ordem) values(p_racha,ordem_times,ordem_times)
    on conflict(racha_id) do update set ordem_inicial=excluded.ordem_inicial,ordem=excluded.ordem,versao=fila_times.versao+1,updated_at=now();
  update public.rachas set estado='times_confirmados',versao=versao+1,updated_at=now() where id=p_racha;
end; $$;

create or replace function public.ler_times_rodada()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'Acesso não autorizado.'; end if;
  select jsonb_build_object('roundId',r.id,'roundName',r.nome,'status',r.estado,'version',r.versao,
    'confirmed',r.estado in ('times_confirmados','em_andamento','finalizado'),
    'fieldPlayers',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'jogadorId',p.jogador_id,'name',p.nome,
      'type',p.tipo,'status',p.status,'avatarUrl',f.avatar_url) order by p.created_at,p.id)
      from public.racha_participantes p left join public.profiles f on f.id=p.jogador_id
      where p.racha_id=r.id and p.tipo in ('linha','goleiro') and p.status='confirmado' and p.jogador_id is not null),'[]'::jsonb),
    'teams',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.nome,'number',t.numero,'players',
      coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'jogadorId',j.jogador_id,'name',p.nome,'avatarUrl',f.avatar_url) order by j.created_at,j.id)
        from public.time_jogadores j join public.racha_participantes p on p.id=j.participante_id
        left join public.profiles f on f.id=j.jogador_id where j.time_id=t.id and j.ativo),'[]'::jsonb)) order by t.numero)
      from public.times t where t.racha_id=r.id and t.ativo and (public.is_organizer(auth.uid()) or (t.confirmado and r.estado in ('times_confirmados','em_andamento','finalizado')))),'[]'::jsonb))
    into result from public.rachas r order by r.data desc nulls last,r.created_at desc,r.id desc limit 1;
  return result;
end;
$$;

-- Restringe as novas inscrições comuns a participante; preserva os tipos legados no schema.
alter policy self_participant_insert on public.racha_participantes
  with check(jogador_id=auth.uid() and tipo='linha' and status='confirmado'
    and exists(select 1 from public.profiles where id=auth.uid() and active)
    and exists(select 1 from public.rachas where id=racha_id and estado='aberto'));
alter policy self_participant_update on public.racha_participantes
  with check(jogador_id=auth.uid() and (tipo='linha' or (tipo='goleiro' and status='removido'))
    and status in ('confirmado','removido')
    and exists(select 1 from public.profiles where id=auth.uid() and active)
    and exists(select 1 from public.rachas where id=racha_id and estado='aberto'));


commit;
