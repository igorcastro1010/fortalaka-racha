-- Aplicar no SQL Editor APOS correcao-inscricao-lista.sql e suas dependencias.
-- Publicar junto ao app que envia p_forma_pagamento. Sem backfill de metodo/valor.
begin;
set local lock_timeout = '5s';
lock table public.racha_participantes in share row exclusive mode;

alter table public.racha_participantes
  add column if not exists forma_pagamento text,
  add column if not exists status_pagamento text not null default 'pendente',
  add column if not exists valor_pagamento numeric(10,2);

do $$
begin
  if not exists(select 1 from pg_constraint where conrelid='public.racha_participantes'::regclass and conname='participante_forma_pagamento_check') then
    alter table public.racha_participantes add constraint participante_forma_pagamento_check
      check(forma_pagamento in ('pix','dinheiro'));
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.racha_participantes'::regclass and conname='participante_status_pagamento_check') then
    alter table public.racha_participantes add constraint participante_status_pagamento_check
      check(status_pagamento in ('pendente','recebido'));
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.racha_participantes'::regclass and conname='participante_valor_pagamento_check') then
    alter table public.racha_participantes add constraint participante_valor_pagamento_check
      check(valor_pagamento >= 0 and valor_pagamento::text not in ('NaN','Infinity','-Infinity'));
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.racha_participantes'::regclass and conname='participante_recebido_valor_check') then
    alter table public.racha_participantes add constraint participante_recebido_valor_check
      check(status_pagamento <> 'recebido' or valor_pagamento is not null);
  end if;
end; $$;

-- Mantem o trigger existente e sua ordem: proteger_lista_sorteio executa ANTES
-- de set_racha_participantes_updated_at. Nao ignora updated_at enviado pelo cliente.
create or replace function public.proteger_lista_sorteio()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare rid uuid; state text; admin boolean; uid uuid; pname text;
begin
  rid := case when tg_op='DELETE' then old.racha_id else new.racha_id end;
  uid := auth.uid(); admin := public.is_organizer(uid);
  if not exists(select 1 from public.profiles where id=uid and active) then
    raise exception 'Entre para participar.';
  end if;
  if tg_op='UPDATE' and (new.racha_id is distinct from old.racha_id or new.id is distinct from old.id
      or new.jogador_id is distinct from old.jogador_id or new.created_at is distinct from old.created_at) then
    raise exception 'Nao altere a identidade ou a ordem da inscricao.';
  end if;
  select estado into state from public.rachas where id=rid for update;
  if not found then raise exception 'Rodada nao encontrada.'; end if;
  if not admin and (case when tg_op='DELETE' then old.jogador_id else new.jogador_id end) is distinct from uid then
    raise exception 'Voce so pode alterar a propria inscricao.';
  end if;

  if tg_op<>'DELETE' then
    if new.forma_pagamento is not null and new.forma_pagamento not in ('pix','dinheiro') then
      raise exception 'Escolha Pix ou dinheiro.';
    end if;
    if tg_op='INSERT' then
      if new.forma_pagamento is null then raise exception 'Escolha Pix ou dinheiro.'; end if;
      if new.status_pagamento is distinct from 'pendente' or new.valor_pagamento is not null then
        raise exception 'Novas inscricoes devem iniciar com pagamento pendente e sem valor.';
      end if;
    else
      if (new.status_pagamento is distinct from old.status_pagamento or new.valor_pagamento is distinct from old.valor_pagamento) and not admin then
        raise exception 'Somente organizadores ativos podem atualizar pagamentos.';
      end if;
      if new.forma_pagamento is distinct from old.forma_pagamento then
        if state<>'aberto' then raise exception 'A lista esta fechada.'; end if;
        if new.forma_pagamento is null then raise exception 'Escolha Pix ou dinheiro.'; end if;
      end if;
      if old.status='removido' and new.status='confirmado' and new.forma_pagamento is null then
        raise exception 'Escolha Pix ou dinheiro.';
      end if;
    end if;
    if new.status_pagamento is null or new.status_pagamento not in ('pendente','recebido')
        or (new.valor_pagamento is not null and (new.valor_pagamento<0 or new.valor_pagamento::text in ('NaN','Infinity','-Infinity')))
        or (new.status_pagamento='recebido' and new.valor_pagamento is null) then
      raise exception 'Informe um status e um valor de pagamento validos.';
    end if;
  end if;

  -- Whitelist exata de metadados; qualquer outro campo segue a protecao da lista.
  -- Financeiro de organizador pode mudar apos encerramento, sem tocar sorteio/fila.
  if tg_op='UPDATE' and
      (to_jsonb(new)-array['forma_pagamento','status_pagamento','valor_pagamento']) =
      (to_jsonb(old)-array['forma_pagamento','status_pagamento','valor_pagamento']) then
    if not admin and state<>'aberto' then raise exception 'A lista esta fechada.'; end if;
    return new;
  end if;

  if state='finalizado' then raise exception 'Rodada finalizada: a lista esta preservada.'; end if;
  if not admin then
    if state<>'aberto' then raise exception 'A lista esta fechada.'; end if;
    if tg_op<>'DELETE' then
      if (new.tipo<>'linha' and not (tg_op='UPDATE' and old.tipo='goleiro' and new.tipo=old.tipo and new.status='removido'))
          or new.status not in ('confirmado','removido') then raise exception 'Inscricao de participante invalida.'; end if;
      if tg_op='INSERT' and new.status<>'confirmado' then raise exception 'A inscricao deve ser confirmada.'; end if;
      select name into pname from public.profiles where id=uid;
      new.nome := pname;
    end if;
  end if;
  -- Mesmas regras administrativas de fluxo-sem-posicoes.sql: preserva historico.
  if not exists(select 1 from public.partidas where racha_id=rid) then
    update public.times set ativo=false,confirmado=false where racha_id=rid;
    update public.time_jogadores set ativo=false where time_id in(select id from public.times where racha_id=rid);
    if state='times_confirmados' then update public.rachas set estado='lista_fechada' where id=rid; end if;
  end if;
  update public.rachas set versao=versao+1,updated_at=now() where id=rid;
  return case when tg_op='DELETE' then old else new end;
end; $$;
revoke all on function public.proteger_lista_sorteio() from public,anon,authenticated;

-- Retira apenas a assinatura antiga, sem CASCADE. Defaults preservam chamadas de saida.
drop function if exists public.inscricao_rodada(uuid,text,boolean);
create or replace function public.inscricao_rodada(p_racha uuid,p_tipo text default null,
    p_entrar boolean default true,p_forma_pagamento text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare pname text;
begin
  select name into pname from public.profiles where id=auth.uid() and active;
  if not found then raise exception 'Entre para participar.'; end if;
  perform 1 from public.rachas where id=p_racha and estado='aberto' for update;
  if not found then raise exception 'A lista esta fechada.'; end if;
  if p_entrar then
    if p_forma_pagamento is null or p_forma_pagamento not in ('pix','dinheiro') then
      raise exception 'Escolha Pix ou dinheiro.';
    end if;
    -- Atualiza existentes primeiro: evita efeitos do BEFORE INSERT em repeticoes.
    -- A trava da rodada serializa inscricoes; mantem id, created_at e financeiro.
    perform 1 from public.racha_participantes where racha_id=p_racha and jogador_id=auth.uid();
    if found then
      update public.racha_participantes set tipo='linha',status='confirmado',nome=pname,forma_pagamento=p_forma_pagamento
        where racha_id=p_racha and jogador_id=auth.uid()
          and (tipo,status,nome,forma_pagamento) is distinct from ('linha','confirmado',pname,p_forma_pagamento);
    else
      insert into public.racha_participantes(racha_id,jogador_id,nome,tipo,status,forma_pagamento)
        values(p_racha,auth.uid(),pname,'linha','confirmado',p_forma_pagamento)
        on conflict(racha_id,jogador_id) do update
          set tipo=excluded.tipo,status='confirmado',nome=excluded.nome,forma_pagamento=excluded.forma_pagamento;
    end if;
  else
    update public.racha_participantes set status='removido'
      where racha_id=p_racha and jogador_id=auth.uid() and status<>'removido';
  end if;
end; $$;

create or replace function public.alterar_forma_pagamento(p_participante uuid,p_forma_pagamento text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare rid uuid;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'Acesso nao autorizado.'; end if;
  if p_forma_pagamento is null or p_forma_pagamento not in ('pix','dinheiro') then raise exception 'Escolha Pix ou dinheiro.'; end if;
  select racha_id into rid from public.racha_participantes
    where id=p_participante and (jogador_id=auth.uid() or public.is_organizer(auth.uid()));
  if not found then raise exception 'Inscricao nao encontrada ou acesso nao autorizado.'; end if;
  perform 1 from public.rachas where id=rid and estado='aberto' for update;
  if not found then raise exception 'A lista esta fechada.'; end if;
  update public.racha_participantes set forma_pagamento=p_forma_pagamento where id=p_participante;
  if not found then raise exception 'Inscricao nao encontrada ou acesso nao autorizado.'; end if;
end; $$;

create or replace function public.atualizar_pagamento(p_participante uuid,p_status text,p_valor numeric)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare rid uuid;
begin
  if not public.is_organizer(auth.uid()) then raise exception 'Somente organizadores ativos podem atualizar pagamentos.'; end if;
  if p_status is null or p_status not in ('pendente','recebido')
      or (p_valor is not null and (p_valor<0 or p_valor>99999999.99
        or p_valor::text in ('NaN','Infinity','-Infinity') or p_valor<>round(p_valor,2)))
      or (p_status='recebido' and p_valor is null) then
    raise exception 'Informe um status e um valor de pagamento validos.';
  end if;
  select racha_id into rid from public.racha_participantes where id=p_participante;
  if not found then raise exception 'Inscricao nao encontrada.'; end if;
  perform 1 from public.rachas where id=rid for update;
  update public.racha_participantes set status_pagamento=p_status,valor_pagamento=p_valor where id=p_participante;
  if not found then raise exception 'Inscricao nao encontrada.'; end if;
end; $$;

revoke all on function public.inscricao_rodada(uuid,text,boolean,text),
  public.alterar_forma_pagamento(uuid,text),public.atualizar_pagamento(uuid,text,numeric) from public,anon;
grant execute on function public.inscricao_rodada(uuid,text,boolean,text),
  public.alterar_forma_pagamento(uuid,text),public.atualizar_pagamento(uuid,text,numeric) to authenticated;

create table if not exists public.configuracoes_pagamento (
  id boolean primary key default true check(id),
  chave_pix text not null check(chave_pix ~ '^[0-9]{11}$'),
  titular text not null check(length(btrim(titular)) between 1 and 100),
  banco text not null check(length(btrim(banco)) between 1 and 100)
);

-- Erros genericos antes dos CHECKs: nao ecoam a chave/linha sensivel em DETAIL.
create or replace function public.validar_configuracoes_pagamento()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then raise exception 'A configuracao de pagamento nao pode ser excluida.'; end if;
  if new.id is distinct from true or new.chave_pix is null or new.chave_pix !~ '^[0-9]{11}$'
      or coalesce(length(btrim(new.titular)),0) not between 1 and 100 or length(new.titular)>100
      or coalesce(length(btrim(new.banco)),0) not between 1 and 100 or length(new.banco)>100 then
    raise exception 'Configuracao de pagamento invalida.';
  end if;
  return new;
end; $$;
revoke all on function public.validar_configuracoes_pagamento() from public,anon,authenticated;
drop trigger if exists validar_configuracoes_pagamento on public.configuracoes_pagamento;
create trigger validar_configuracoes_pagamento before insert or update or delete on public.configuracoes_pagamento
  for each row execute function public.validar_configuracoes_pagamento();

insert into public.configuracoes_pagamento(id,chave_pix,titular,banco)
  values(true,'07618707332','Igor da Rocha Castro','Santander') on conflict(id) do nothing;

alter table public.configuracoes_pagamento enable row level security;
revoke all on public.configuracoes_pagamento from public,anon,authenticated;
grant select on public.configuracoes_pagamento to authenticated;
grant update(chave_pix,titular,banco) on public.configuracoes_pagamento to authenticated;
drop policy if exists pagamento_config_read on public.configuracoes_pagamento;
create policy pagamento_config_read on public.configuracoes_pagamento for select to authenticated
  using(exists(select 1 from public.profiles where id=auth.uid() and active));
drop policy if exists pagamento_config_update on public.configuracoes_pagamento;
create policy pagamento_config_update on public.configuracoes_pagamento for update to authenticated
  using(public.is_organizer(auth.uid())) with check(public.is_organizer(auth.uid()));
commit;
