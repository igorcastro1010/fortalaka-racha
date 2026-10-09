-- Aplicar após validacao-sorteio-avatars.sql, partidas-estatisticas.sql e avaliacoes.sql.
begin;
alter table public.rachas add column if not exists finalizada_at timestamptz;
alter table public.rachas add column if not exists avaliacoes_abertas boolean not null default false;
create or replace function public.alterar_estado_rodada(p_racha uuid,p_estado text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.rachas%rowtype;
begin
  if not public.is_organizer(auth.uid()) then raise exception 'Somente organizadores podem gerenciar rodadas.'; end if;
  select * into r from public.rachas where id=p_racha for update;
  if not found then raise exception 'Rodada não encontrada.'; end if;
  if r.estado='finalizado' then raise exception 'Rodada finalizada não pode ser alterada.'; end if;
  if p_estado='times_confirmados' then raise exception 'Use a confirmação dos times persistidos.'; end if;
  if p_estado='lista_fechada' then
    if r.estado<>'aberto' then raise exception 'A rodada não está aberta.'; end if;
    if not exists(select 1 from public.racha_participantes where racha_id=p_racha and tipo='linha' and status='confirmado') then
      raise exception 'Adicione pelo menos um jogador de linha confirmado antes de fechar a lista.';
    end if;
  elsif p_estado='aberto' then
    update public.times set confirmado=false where racha_id=p_racha;
  elsif p_estado='finalizado' then
    if not exists(select 1 from public.partidas where racha_id=p_racha and status='finalizada') then raise exception 'Finalize pelo menos uma partida antes de encerrar a rodada.'; end if;
    if r.estado<>'times_confirmados' then raise exception 'Confirme os times antes de finalizar.'; end if;
  else raise exception 'Estado inválido.';
  end if;
  update public.rachas set estado=p_estado,versao=versao+1,updated_at=now(),finalizada_at=case when p_estado='finalizado' then now() else finalizada_at end where id=p_racha;
end;
$$;


-- Ponto de entrada próprio evita usar a regra antiga antes da migração.
create or replace function public.finalizar_rodada(p_racha uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.alterar_estado_rodada(p_racha,'finalizado');
end; $$;
revoke all on function public.finalizar_rodada(uuid) from public,anon;
grant execute on function public.finalizar_rodada(uuid) to authenticated;

create or replace function public.alterar_avaliacoes_rodada(p_racha uuid,p_abertas boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare total integer; respondentes integer;
begin
  if not public.is_organizer(auth.uid()) then raise exception 'Somente organizadores podem alterar avaliacoes.'; end if;
  if not exists(select 1 from public.rachas where id=p_racha and estado='finalizado' for update) then
    raise exception 'Finalize a rodada antes de abrir avaliações.';
  end if;
  if p_abertas and not exists(select 1 from public.partidas where racha_id=p_racha and status='finalizada') then
    raise exception 'Finalize pelo menos uma partida antes de abrir avaliacoes.';
  end if;
  update public.rachas set avaliacoes_abertas=p_abertas,updated_at=now(),versao=versao+1 where id=p_racha;
  select count(distinct jogador_id) into total from public.partida_jogadores j join public.partidas p on p.id=j.partida_id where p.racha_id=p_racha and p.status='finalizada' and j.participou;
  select count(distinct avaliador_id) into respondentes from public.avaliacoes where racha_id=p_racha;
  return jsonb_build_object('total',coalesce(total,0),'respondentes',coalesce(respondentes,0),'abertas',p_abertas);
end; $$;

create or replace function public.pode_avaliar_companheiro(p_racha uuid,p_avaliador uuid,p_avaliado uuid)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare
  time_avaliador uuid;
  time_avaliado uuid;
  aberta boolean;
begin
  if p_avaliador is null or p_avaliado is null or p_avaliador=p_avaliado or auth.uid() is distinct from p_avaliador then
    return false;
  end if;
  if not exists(select 1 from public.profiles where id=p_avaliador and active)
    or not exists(select 1 from public.profiles where id=p_avaliado and active) then
    return false;
  end if;
  select r.avaliacoes_abertas into aberta from public.rachas r where r.id=p_racha and r.estado='finalizado';
  if not coalesce(aberta,false) then
    return false;
  end if;
  time_avaliador := public.time_participante_avaliacao(p_racha,p_avaliador);
  time_avaliado := public.time_participante_avaliacao(p_racha,p_avaliado);
  return time_avaliador is not null and time_avaliador=time_avaliado;
end;
$$;

-- Preserva resultados e permite correções, mas não novas partidas depois de encerrada.
create or replace function public.validar_partida() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then
  perform 1 from public.rachas where id=new.racha_id and estado='times_confirmados' for update;
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


commit;
