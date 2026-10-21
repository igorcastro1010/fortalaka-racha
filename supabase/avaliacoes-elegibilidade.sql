-- Executar após fluxo-sem-posicoes.sql (e suas dependências).
-- Corrige a validação de jogadores sem participação; não altera notas existentes.
begin;

create or replace function public.pode_avaliar_companheiro(p_racha uuid,p_avaliador uuid,p_avaliado uuid)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
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
  if not coalesce(aberta,false) then return false; end if;
  time_avaliador := public.time_participante_avaliacao(p_racha,p_avaliador);
  time_avaliado := public.time_participante_avaliacao(p_racha,p_avaliado);
  -- Um time ausente deve resultar em false, nunca em NULL.
  return time_avaliador is not null and time_avaliado is not null and time_avaliador=time_avaliado;
end;
$$;

create or replace function public.salvar_avaliacao(p_racha uuid,p_avaliado uuid,p_passe smallint,p_chute smallint,p_velocidade smallint,p_defesa smallint,p_fisico smallint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare tid uuid;
begin
  tid := public.time_participante_avaliacao(p_racha,auth.uid());
  if tid is null or public.pode_avaliar_companheiro(p_racha,auth.uid(),p_avaliado) is not true then
    raise exception 'Voce so pode avaliar companheiros do seu time enquanto as avaliacoes estiverem abertas.';
  end if;
  insert into public.avaliacoes(racha_id,avaliador_id,avaliado_id,time_id,passe,chute,velocidade,defesa,fisico)
  values(p_racha,auth.uid(),p_avaliado,tid,p_passe,p_chute,p_velocidade,p_defesa,p_fisico)
  on conflict(racha_id,avaliador_id,avaliado_id) do update
  set passe=excluded.passe,chute=excluded.chute,velocidade=excluded.velocidade,defesa=excluded.defesa,fisico=excluded.fisico,updated_at=now();
  return jsonb_build_object('ok',true);
end;
$$;

revoke all on function public.pode_avaliar_companheiro(uuid,uuid,uuid),
  public.salvar_avaliacao(uuid,uuid,smallint,smallint,smallint,smallint,smallint) from public,anon;
grant execute on function public.pode_avaliar_companheiro(uuid,uuid,uuid),
  public.salvar_avaliacao(uuid,uuid,smallint,smallint,smallint,smallint,smallint) to authenticated;
commit;
