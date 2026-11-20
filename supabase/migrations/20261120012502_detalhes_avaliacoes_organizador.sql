-- Consulta administrativa somente leitura. Nao amplia SELECT na tabela.
-- Reversao: drop function public.ler_detalhes_avaliacoes(uuid);
begin;
create or replace function public.ler_detalhes_avaliacoes(p_racha uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or not public.is_organizer(auth.uid()) then
    raise exception 'Somente organizadores ativos podem consultar as notas.' using errcode='42501';
  end if;
  return coalesce((
    with participants as materialized (
      select p.id, public.time_participante_avaliacao(p_racha,p.id) as team_id
      from public.profiles p where p.active and exists (
        select 1 from public.partida_jogadores j join public.partidas m on m.id=j.partida_id
        where m.racha_id=p_racha and m.status='finalizada' and j.participou and j.jogador_id=p.id
      )
    ), pairs as (
      select x.id as sender,y.id as recipient from participants x join participants y
        on x.team_id=y.team_id and x.id<>y.id
      union
      select avaliador_id,avaliado_id from public.avaliacoes where racha_id=p_racha
    )
    select jsonb_agg(jsonb_build_object(
      'avaliador_id',x.id,'avaliador_nome',x.name,'avaliador_avatar',x.avatar_url,
      'avaliado_id',y.id,'avaliado_nome',y.name,'avaliado_avatar',y.avatar_url,
      'avaliado',a.id is not null,'passe',a.passe,'chute',a.chute,
      'velocidade',a.velocidade,'defesa',a.defesa,'fisico',a.fisico,'updated_at',a.updated_at
    ) order by x.name,x.id,y.name,y.id)
    from pairs k join public.profiles x on x.id=k.sender join public.profiles y on y.id=k.recipient
    left join public.avaliacoes a on a.racha_id=p_racha and a.avaliador_id=x.id and a.avaliado_id=y.id
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.ler_detalhes_avaliacoes(uuid) from public,anon;
grant execute on function public.ler_detalhes_avaliacoes(uuid) to authenticated;
commit;
