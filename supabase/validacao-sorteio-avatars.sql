-- Executar após schema.sql e sorteio-times.sql. Não inclui dados de teste.
begin;
alter table public.profiles add column if not exists avatar_url text;
alter table public.rachas add column if not exists versao integer not null default 0;

create or replace function public.validar_composicao_times(p_racha uuid, p_times jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer; k integer; t jsonb; sizes integer[]; ids uuid[];
begin
  select count(*) into n from public.racha_participantes where racha_id=p_racha and tipo='linha' and status='confirmado';
  if n=0 then raise exception 'Nenhum jogador de linha disponível para sorteio.'; end if;
  k := ceil(n / 5.0);
  if p_times is null or jsonb_typeof(p_times)<>'array' then raise exception 'Sorteio inválido.'; end if;
  if jsonb_array_length(p_times)<>k then raise exception 'Quantidade de times inválida.'; end if;
  if (select count(distinct (value->>'numero')::int) from jsonb_array_elements(p_times)
      where (value->>'numero')::int between 1 and k)<>k then raise exception 'Numeração inválida.'; end if;
  sizes := '{}'; ids := '{}';
  for t in select value from jsonb_array_elements(p_times) loop
    if t->'jogadores' is null or jsonb_typeof(t->'jogadores')<>'array' then raise exception 'Jogadores inválidos.'; end if;
    sizes := array_append(sizes,jsonb_array_length(t->'jogadores'));
    if jsonb_array_length(t->'jogadores') not between 1 and 5 then raise exception 'Cada time deve ter de 1 a 5 jogadores.'; end if;
    if coalesce(length(trim(t->>'nome')),0) not between 1 and 100 then raise exception 'Nome inválido.'; end if;
    ids := ids || array(select value::uuid from jsonb_array_elements_text(t->'jogadores'));
  end loop;
  if (select max(s)-min(s) from unnest(sizes) s)>1 then raise exception 'Os times devem estar equilibrados.'; end if;
  if cardinality(ids)<>n or (select count(distinct id) from unnest(ids) id)<>n then raise exception 'Jogadores repetidos ou faltantes.'; end if;
  if exists (select 1 from unnest(ids) u(participant_id) where not exists (
      select 1 from public.racha_participantes p where p.id=u.participant_id and p.racha_id=p_racha and p.tipo='linha' and p.status='confirmado' and p.jogador_id is not null)) then
    raise exception 'Somente jogadores de linha confirmados desta rodada podem participar.';
  end if;
end;
$$;

create or replace function public.salvar_rascunho_times(p_racha uuid, p_versao integer, p_times jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.rachas%rowtype; t jsonb; tid uuid;
begin
  if not public.is_organizer(auth.uid()) then raise exception 'Somente organizadores podem alterar times.'; end if;
  select * into r from public.rachas where id=p_racha for update;
  if not found then raise exception 'Rodada não encontrada.'; end if;
  if r.versao is distinct from p_versao then raise exception 'A rodada foi alterada. Atualize a tela antes de salvar.'; end if;
  if r.estado not in ('lista_fechada','times_confirmados') then raise exception 'Feche a lista antes de sortear. Rodadas finalizadas não podem ser alteradas.'; end if;
  perform public.validar_composicao_times(p_racha,p_times);
  delete from public.times where racha_id=p_racha;
  for t in select value from jsonb_array_elements(p_times) loop
    insert into public.times(racha_id,nome,numero,confirmado)
      values (p_racha,trim(t->>'nome'),(t->>'numero')::int,false) returning id into tid;
    insert into public.time_jogadores(time_id,jogador_id,participante_id)
      select tid,p.jogador_id,p.id from jsonb_array_elements_text(t->'jogadores') j
      join public.racha_participantes p on p.id=j.value::uuid;
  end loop;
  update public.rachas set estado='lista_fechada',versao=versao+1 where id=p_racha;
end;
$$;

create or replace function public.confirmar_rascunho_times(p_racha uuid, p_versao integer)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.rachas%rowtype; payload jsonb;
begin
  if not public.is_organizer(auth.uid()) then raise exception 'Somente organizadores podem confirmar times.'; end if;
  select * into r from public.rachas where id=p_racha for update;
  if not found then raise exception 'Rodada não encontrada.'; end if;
  if r.versao is distinct from p_versao then raise exception 'A rodada foi alterada. Atualize a tela antes de confirmar.'; end if;
  if r.estado<>'lista_fechada' then raise exception 'A lista precisa estar fechada para confirmar os times.'; end if;
  select jsonb_agg(jsonb_build_object('numero',t.numero,'nome',t.nome,'jogadores',
    coalesce((select jsonb_agg(j.participante_id) from public.time_jogadores j where j.time_id=t.id),'[]'::jsonb)))
    into payload from public.times t where t.racha_id=p_racha;
  perform public.validar_composicao_times(p_racha,payload);
  update public.times set confirmado=true where racha_id=p_racha;
  update public.rachas set estado='times_confirmados',versao=versao+1 where id=p_racha;
end;
$$;

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
    if r.estado<>'times_confirmados' then raise exception 'Confirme os times antes de finalizar.'; end if;
  else raise exception 'Estado inválido.';
  end if;
  update public.rachas set estado=p_estado,versao=versao+1 where id=p_racha;
end;
$$;

-- Leitura em uma única consulta: sem liberar e-mails ou outros campos de profiles.
create or replace function public.ler_times_rodada()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'Acesso não autorizado.'; end if;
  select jsonb_build_object('roundId',r.id,'roundName',r.nome,'status',r.estado,'version',r.versao,
    'confirmed',r.estado in ('times_confirmados','finalizado'),
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
        left join public.profiles f on f.id=j.jogador_id where j.time_id=t.id),'[]'::jsonb)) order by t.numero)
      from public.times t where t.racha_id=r.id and (public.is_organizer(auth.uid()) or (t.confirmado and r.estado in ('times_confirmados','finalizado')))),'[]'::jsonb))
    into result from public.rachas r order by r.data desc nulls last,r.created_at desc,r.id desc limit 1;
  return result;
end;
$$;

create or replace function public.avatars_da_rodada(p_racha uuid)
returns table(jogador_id uuid, avatar_url text) language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'Acesso não autorizado.'; end if;
  return query select distinct f.id,f.avatar_url from public.racha_participantes p
    join public.profiles f on f.id=p.jogador_id where p.racha_id=p_racha;
end;
$$;

-- Participantes não podem mudar enquanto a lista estiver fechada.
-- Alteração numa lista reaberta invalida o rascunho e incrementa a versão.
create or replace function public.proteger_lista_sorteio()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare rid uuid; state text;
begin
  rid := case when tg_op='DELETE' then old.racha_id else new.racha_id end;
  if tg_op='UPDATE' and (new.racha_id<>old.racha_id or new.id<>old.id) then raise exception 'Não mova participantes entre rodadas.'; end if;
  select estado into state from public.rachas where id=rid for update;
  if state is not null and state<>'aberto' then raise exception 'Reabra a lista antes de editar participantes.'; end if;
  delete from public.times where racha_id=rid;
  update public.rachas set versao=versao+1 where id=rid;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
drop trigger if exists proteger_lista_sorteio on public.racha_participantes;
create trigger proteger_lista_sorteio before insert or update or delete on public.racha_participantes
  for each row execute function public.proteger_lista_sorteio();

-- Ninguém escreve diretamente nos times, nem um organizador com cliente modificado.
revoke insert,update,delete on public.times,public.time_jogadores from authenticated,anon;
revoke update on public.rachas from authenticated;
grant update(nome,data,horario,endereco) on public.rachas to authenticated;
revoke all on function public.validar_composicao_times(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.salvar_rascunho_times(uuid,integer,jsonb),public.confirmar_rascunho_times(uuid,integer),
  public.alterar_estado_rodada(uuid,text),public.ler_times_rodada(),public.avatars_da_rodada(uuid) from public,anon;
grant execute on function public.salvar_rascunho_times(uuid,integer,jsonb),public.confirmar_rascunho_times(uuid,integer),
  public.alterar_estado_rodada(uuid,text),public.ler_times_rodada(),public.avatars_da_rodada(uuid) to authenticated;

-- Upload: PNG/JPEG/WebP, no máximo 2 MiB, pasta do próprio auth.uid().
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('avatars','avatars',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists fortalaka_avatars_read on storage.objects;
create policy fortalaka_avatars_read on storage.objects for select to public using(bucket_id='avatars');
drop policy if exists fortalaka_avatars_insert on storage.objects;
create policy fortalaka_avatars_insert on storage.objects for insert to authenticated with check(
  bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text
  and exists(select 1 from public.profiles where id=auth.uid() and active));
drop policy if exists fortalaka_avatars_update on storage.objects;
create policy fortalaka_avatars_update on storage.objects for update to authenticated
  using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text)
  with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists fortalaka_avatars_delete on storage.objects;
create policy fortalaka_avatars_delete on storage.objects for delete to authenticated
  using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
grant update(avatar_url) on public.profiles to authenticated;
commit;
