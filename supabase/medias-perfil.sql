-- Execute após schema.sql e sorteio-times.sql. Não insere notas de demonstração.
begin;
create table if not exists public.avaliacoes_jogadores (
  id uuid primary key default gen_random_uuid(),
  racha_id uuid not null references public.rachas(id) on delete cascade,
  jogador_id uuid not null references public.profiles(id) on delete cascade,
  avaliador_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  passe numeric not null check(passe between 0 and 10),
  chute numeric not null check(chute between 0 and 10),
  velocidade numeric not null check(velocidade between 0 and 10),
  defesa numeric not null check(defesa between 0 and 10),
  fisico numeric not null check(fisico between 0 and 10),
  created_at timestamptz not null default now(),
  unique(racha_id,jogador_id,avaliador_id),
  check(jogador_id<>avaliador_id)
);
-- Preserva avaliações antigas de quatro atributos sem inventar uma nota de físico.
alter table public.avaliacoes_jogadores add column if not exists fisico numeric check(fisico between 0 and 10);
create index if not exists avaliacoes_jogadores_jogador_idx on public.avaliacoes_jogadores(jogador_id);
alter table public.avaliacoes_jogadores enable row level security;

-- Avaliações de linha: somente companheiros de um mesmo time confirmado.
-- Não define nem implementa avaliações de goleiros.
create or replace function public.pode_avaliar_linha(p_racha uuid,p_jogador uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and auth.uid()<>p_jogador
    and exists(select 1 from public.profiles where id=auth.uid() and active)
    and exists(select 1 from public.profiles where id=p_jogador and active)
    and exists(
      select 1 from public.times t
      join public.rachas r on r.id=t.racha_id
      join public.time_jogadores a on a.time_id=t.id and a.jogador_id=auth.uid()
      join public.time_jogadores b on b.time_id=t.id and b.jogador_id=p_jogador
      join public.racha_participantes pa on pa.id=a.participante_id and pa.racha_id=r.id
      join public.racha_participantes pb on pb.id=b.participante_id and pb.racha_id=r.id
      where r.id=p_racha and r.estado in ('times_confirmados','finalizado') and t.confirmado
        and pa.tipo='linha' and pb.tipo='linha' and pa.status='confirmado' and pb.status='confirmado'
    );
$$;
revoke all on function public.pode_avaliar_linha(uuid,uuid) from public,anon;
grant execute on function public.pode_avaliar_linha(uuid,uuid) to authenticated;

revoke all on public.avaliacoes_jogadores from anon,authenticated;
grant select,insert on public.avaliacoes_jogadores to authenticated;
grant update(passe,chute,velocidade,defesa,fisico) on public.avaliacoes_jogadores to authenticated;
drop policy if exists ratings_read on public.avaliacoes_jogadores;
create policy ratings_read on public.avaliacoes_jogadores for select to authenticated
  using(jogador_id=auth.uid() or avaliador_id=auth.uid());
drop policy if exists ratings_insert on public.avaliacoes_jogadores;
create policy ratings_insert on public.avaliacoes_jogadores for insert to authenticated
  with check(avaliador_id=auth.uid() and fisico is not null and public.pode_avaliar_linha(racha_id,jogador_id));
drop policy if exists ratings_update on public.avaliacoes_jogadores;
create policy ratings_update on public.avaliacoes_jogadores for update to authenticated
  using(avaliador_id=auth.uid())
  with check(avaliador_id=auth.uid() and fisico is not null and public.pode_avaliar_linha(racha_id,jogador_id));

drop function if exists public.medias_jogador(uuid);
create function public.medias_jogador(p_jogador uuid)
returns table(quantidade bigint,passe numeric,chute numeric,velocidade numeric,defesa numeric,fisico numeric)
language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and active)
    or (p_jogador<>auth.uid() and not public.is_organizer(auth.uid())) then
    raise exception 'Sem permissão para consultar as médias deste jogador.';
  end if;
  return query select count(*),avg(a.passe),avg(a.chute),avg(a.velocidade),avg(a.defesa),avg(a.fisico)
    from public.avaliacoes_jogadores a where a.jogador_id=p_jogador;
end;
$$;
revoke all on function public.medias_jogador(uuid) from public,anon;
grant execute on function public.medias_jogador(uuid) to authenticated;
commit;
