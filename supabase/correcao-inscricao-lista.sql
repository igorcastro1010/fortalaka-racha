-- Executar no SQL Editor apos fluxo-sem-posicoes.sql. Nao apaga nem mescla dados.
begin;
set local lock_timeout = '5s';
lock table public.racha_participantes in share row exclusive mode;

do $$
declare duplicates jsonb;
begin
  select jsonb_agg(to_jsonb(conflict)) into duplicates from (
    select racha_id, jogador_id, array_agg(id order by created_at,id) as ids
    from public.racha_participantes where jogador_id is not null
    group by racha_id,jogador_id having count(*) > 1
  ) conflict;
  if duplicates is not null then
    raise exception using message = 'Inscricoes duplicadas: nenhuma alteracao aplicada.',
      detail = duplicates::text,
      hint = 'Audite os IDs e vinculos historicos antes de decidir a conciliacao. Nenhum registro foi excluido.';
  end if;
end; $$;

create unique index if not exists racha_participantes_inscricao_unique
  on public.racha_participantes (racha_id,jogador_id);

do $$
begin
  if not exists (
    select 1 from pg_index i
    where i.indexrelid = 'public.racha_participantes_inscricao_unique'::regclass
      and i.indrelid = 'public.racha_participantes'::regclass
      and i.indisunique and i.indisvalid and i.indimmediate
      and i.indpred is null and i.indexprs is null and i.indnkeyatts = 2
      and (select array_agg(a.attname order by k.ordinality)
        from unnest(i.indkey) with ordinality k(attnum,ordinality)
        join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum
        where k.ordinality <= i.indnkeyatts) = array['racha_id','jogador_id']::name[]
  ) then raise exception 'Indice de inscricao existente e incompativel; nenhuma alteracao aplicada.';
  end if;
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
      on conflict(racha_id,jogador_id)
      do update set tipo=excluded.tipo,status='confirmado',nome=excluded.nome;
  else
    update public.racha_participantes set status='removido' where racha_id=p_racha and jogador_id=auth.uid();
  end if;
end; $$;

revoke all on function public.inscricao_rodada(uuid,text,boolean) from public,anon;
grant execute on function public.inscricao_rodada(uuid,text,boolean) to authenticated;
commit;
