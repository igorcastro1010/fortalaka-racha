-- Apply after fluxo-principal.sql and fluxo-sem-posicoes.sql.
begin;
alter table public.partidas add column if not exists vencedor_penaltis_id uuid references public.times(id);

create or replace function public.validar_desempate_partida() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare estado_rodada text; quantidade integer;
begin
  select estado into estado_rodada from public.rachas where id=new.racha_id for update;
  if new.vencedor_penaltis_id is not null and new.vencedor_penaltis_id not in(new.time_a_id,new.time_b_id) then
    raise exception 'Escolha um dos times da partida para os penaltis.';
  end if;
  if tg_op='UPDATE' then
    if estado_rodada='finalizado' and (new.status is distinct from old.status or new.vencedor_penaltis_id is distinct from old.vencedor_penaltis_id) then
      raise exception 'A rodada encerrada permite apenas corrigir o resultado e os eventos.';
    end if;
    if old.status<>'finalizada' and new.status='finalizada' and new.placar_a=new.placar_b and estado_rodada<>'finalizado' then
      select cardinality(array_remove(array_remove(ordem,new.time_a_id),new.time_b_id)) into quantidade
        from public.fila_times where racha_id=new.racha_id for update;
      if quantidade=1 and new.vencedor_penaltis_id is null then
        raise exception 'Informe o vencedor dos penaltis alternados.';
      end if;
      if quantidade<>1 and new.vencedor_penaltis_id is not null then
        raise exception 'Os penaltis so se aplicam quando ha um time aguardando.';
      end if;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists validar_desempate_partida on public.partidas;
create trigger validar_desempate_partida before insert or update on public.partidas
for each row execute function public.validar_desempate_partida();

create or replace function public.preservar_participacao_encerrada() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.participou is distinct from old.participou and exists(
    select 1 from public.partidas p join public.rachas r on r.id=p.racha_id
    where p.id=old.partida_id and r.estado='finalizado') then
    raise exception 'A participacao da rodada encerrada deve ser preservada.';
  end if;
  return new;
end; $$;
drop trigger if exists preservar_participacao_encerrada on public.partida_jogadores;
create trigger preservar_participacao_encerrada before update on public.partida_jogadores
for each row execute function public.preservar_participacao_encerrada();

create or replace function public.recalcular_fila(p_racha uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare ordem_atual uuid[]; aguardando uuid[]; m record; vencedor uuid; perdedor uuid;
begin
  if exists(select 1 from public.rachas where id=p_racha and estado='finalizado') then return; end if;
  select ordem_inicial into ordem_atual from public.fila_times where racha_id=p_racha for update;
  if not found then return; end if;
  for m in select * from public.partidas where racha_id=p_racha and status='finalizada'
    order by sequencia_fila nulls last,created_at,id loop
    aguardando := array_remove(array_remove(ordem_atual,m.time_a_id),m.time_b_id);
    if m.placar_a=m.placar_b and (cardinality(aguardando)<>1 or m.vencedor_penaltis_id is null) then
      -- Legacy ties without a penalty winner retain their original ordering.
      ordem_atual := aguardando || array[m.time_a_id,m.time_b_id];
    else
      vencedor := case when m.placar_a=m.placar_b then m.vencedor_penaltis_id
        when m.placar_a>m.placar_b then m.time_a_id else m.time_b_id end;
      perdedor := case when vencedor=m.time_a_id then m.time_b_id else m.time_a_id end;
      ordem_atual := array[vencedor] || aguardando || array[perdedor];
    end if;
  end loop;
  update public.fila_times set ordem=ordem_atual,versao=versao+1,updated_at=now() where racha_id=p_racha;
end; $$;

-- Keep the existing six-argument RPC for old clients; its trigger enforces ties too.
create or replace function public.salvar_partida_com_desempate(
  p_partida uuid,p_versao integer,p_placar_a integer,p_placar_b integer,
  p_status text,p_jogadores jsonb,p_vencedor_penaltis uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.partidas; versao_atual integer;
begin
  if not public.is_organizer(auth.uid()) then raise exception 'Somente organizadores podem editar partidas.'; end if;
  select * into m from public.partidas where id=p_partida;
  if not found then raise exception 'Partida nao encontrada.'; end if;
  perform 1 from public.rachas where id=m.racha_id for update;
  select * into m from public.partidas where id=p_partida for update;
  if m.versao is distinct from p_versao then raise exception 'A partida foi alterada. Atualize antes de salvar.'; end if;
  versao_atual := m.versao;
  if p_vencedor_penaltis is not null then
    if m.status<>'aberta' or p_status<>'finalizada' or p_placar_a<>p_placar_b then
      raise exception 'Os penaltis devem decidir uma partida empatada em andamento.';
    end if;
    update public.partidas set vencedor_penaltis_id=p_vencedor_penaltis where id=p_partida returning versao into versao_atual;
  end if;
  return public.salvar_partida(p_partida,versao_atual,p_placar_a,p_placar_b,p_status,p_jogadores);
end; $$;

-- Return completion only, never scores or the identities of rated teammates.
create or replace function public.ler_pendencias_avaliacoes(p_racha uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.is_organizer(auth.uid()) then raise exception 'Somente organizadores podem consultar pendencias.'; end if;
  return coalesce((
    with elegiveis as (
      select p.id,p.name,p.avatar_url,public.time_participante_avaliacao(p_racha,p.id) as time_id
      from public.profiles p where p.active
    ), progresso as (
      select e.id,e.name,e.avatar_url,count(c.id) as total,
        count(a.id) as respondidas
      from elegiveis e join elegiveis c on c.time_id=e.time_id and c.id<>e.id
      left join public.avaliacoes a on a.racha_id=p_racha and a.avaliador_id=e.id and a.avaliado_id=c.id
      where e.time_id is not null group by e.id,e.name,e.avatar_url
    )
    select jsonb_agg(jsonb_build_object('id',id,'nome',name,'avatar_url',avatar_url,
      'respondidas',respondidas,'total',total) order by name,id)
    from progresso where respondidas<total
  ),'[]'::jsonb);
end; $$;
revoke all on function public.validar_desempate_partida(),public.preservar_participacao_encerrada(),public.recalcular_fila(uuid) from public,anon,authenticated;
revoke all on function public.salvar_partida_com_desempate(uuid,integer,integer,integer,text,jsonb,uuid),public.ler_pendencias_avaliacoes(uuid) from public,anon;
grant execute on function public.salvar_partida_com_desempate(uuid,integer,integer,integer,text,jsonb,uuid),public.ler_pendencias_avaliacoes(uuid) to authenticated;
commit;
