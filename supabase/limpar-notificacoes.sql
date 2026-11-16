-- Aplicar depois de notificacoes.sql. Preserva eventos e entregas push.
begin;
alter table public.notifications add column if not exists archived_at timestamptz;

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications for select to authenticated using (
 recipient_id=auth.uid() and archived_at is null
 and exists(select 1 from public.profiles p where p.id=auth.uid() and p.active)
);

create or replace function public.limpar_notificacoes_lidas()
returns integer language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active) then
  raise exception 'Entre para consultar suas notificações.';
 end if;
 update public.notifications set archived_at=now()
 where recipient_id=auth.uid() and read_at is not null and archived_at is null;
 get diagnostics changed=row_count;
 return changed;
end; $$;
revoke all on function public.limpar_notificacoes_lidas() from public,anon;
grant execute on function public.limpar_notificacoes_lidas() to authenticated;
commit;
