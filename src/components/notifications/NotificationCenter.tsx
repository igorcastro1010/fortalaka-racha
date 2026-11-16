"use client";

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { PushSettings } from './PushSettings';
import { getNotifications, markNotificationsRead, clearReadNotifications, notificationHref, type AppNotification } from '@/lib/notifications/repository';

import { ViewTabs } from '@/components/ui/ViewTabs';
import { useConfirmation } from '@/components/ui/useConfirmation';

export function NotificationCenter() {
  const [tab, setTab] = useState<'unread' | 'read'>('unread');
  const { confirm, confirmationDialog } = useConfirmation();
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const mounted = useRef(false);
  const pending = useRef(false);
  const readPending = useRef(false);
  const initialRead = useRef<ReturnType<typeof getNotifications> | null>(null);
  const load = useCallback(async (offset = 0, filter: 'unread' | 'read' = 'unread') => {
    if (pending.current) return;
    pending.current = true; setLoading(true); setError('');
    try {
      const data = await getNotifications(offset, filter);
      if (mounted.current) { setRows(previous => offset ? [...previous, ...data.rows.filter(row => !previous.some(p => p.id === row.id))] : data.rows); setHasMore(data.hasMore); }
    } catch { if (mounted.current) setError('A central está indisponível no momento. Tente atualizar em instantes.'); }
    finally { pending.current = false; if (mounted.current) setLoading(false); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    initialRead.current ??= getNotifications();
    initialRead.current.then(data => { if (active) { setRows(data.rows); setHasMore(data.hasMore); } })
      .catch(() => { if (active) setError('A central está indisponível no momento. Tente atualizar em instantes.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; mounted.current = false; };
  }, []);
  async function mark(ids: string[] | null) {
    if (readPending.current || pending.current) return;
    readPending.current = true; setBusy(true); setMessage('');
    try {
      await markNotificationsRead(ids);
      await load(0, tab);
      if (mounted.current) { setMessage(ids ? 'Notificação lida.' : 'Todas as notificações foram marcadas como lidas.'); }
    } catch { if (mounted.current) setMessage('Não foi possível marcar como lida. Tente novamente.'); }
    finally { readPending.current = false; if (mounted.current) setBusy(false); }
  }
  async function clear() {
    if (readPending.current || pending.current) return;
    readPending.current = true; setBusy(true); setMessage('');
    try {
      if (!await confirm({ title: 'Limpar notificações lidas?', description: 'Todas as notificações já lidas serão retiradas da sua central. As não lidas serão mantidas.' })) return;
      await clearReadNotifications();
      await load(0, 'read');
      if (mounted.current) setMessage('Notificações lidas removidas da central.');
    } catch { if (mounted.current) setMessage('Não foi possível limpar as notificações. Tente novamente.'); }
    finally { readPending.current = false; if (mounted.current) setBusy(false); }
  }
  return <section aria-label="Central de notificações" className="space-y-4">{confirmationDialog}<Link href="/" className="fk-tertiary inline-flex items-center">← Voltar ao app</Link><h1 className="flex items-center gap-2 text-3xl font-black"><Bell aria-hidden="true" />Notificações</h1><p className="text-sm text-zinc-600">Avisos da rodada e conquistas. Sem notificações a cada gol.</p>
    <ViewTabs label="Filtrar notificações" value={tab} onChange={next => { if (busy || loading || pending.current || readPending.current) return; setTab(next); setRows([]); setHasMore(false); setMessage(''); void load(0, next); }} items={[{ id: 'unread', label: 'Não lidas' }, { id: 'read', label: 'Lidas' }]} />
    <div className="flex flex-wrap gap-2"><button onClick={() => load(0, tab)} disabled={loading || busy} className="fk-secondary">Atualizar</button>{tab === 'unread' ? <button onClick={() => mark(null)} disabled={loading || busy || (!hasMore && !rows.some(row => !row.read_at))} className="fk-secondary"><CheckCheck size={18} aria-hidden="true" />Marcar todas como lidas</button> : <button onClick={() => void clear()} disabled={loading || busy || !rows.length} className="fk-secondary"><Trash2 size={18} aria-hidden="true" />Limpar lidas</button>}</div>
    {loading && <p role="status">Carregando avisos...</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!loading && !error && !rows.length && <div className="fk-section"><h2 className="text-lg font-black">{tab === 'unread' ? 'Tudo em dia' : 'Nenhuma notificação lida'}</h2><p className="mt-2 text-sm text-zinc-600">{tab === 'unread' ? 'Novos avisos aparecerão aqui.' : 'Os avisos marcados como lidos aparecem aqui até você limpar.'}</p></div>}
    <ul className="divide-y divide-zinc-200">{rows.map(row => <li key={row.id} className="min-w-0 space-y-2 py-4"><div className="flex items-start gap-3"><Bell size={18} aria-hidden="true" className="mt-1 shrink-0 text-red-700" /><div className="min-w-0 flex-1"><h2 className="break-words text-base font-black">{row.title}</h2><p className="mt-1 break-words text-sm text-zinc-600">{row.body}</p><p className="mt-2 text-xs text-zinc-600"><time dateTime={row.created_at}>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Fortaleza' }).format(new Date(row.created_at))}</time> · {row.read_at ? 'Lida' : 'Não lida'}</p></div></div><div className="flex flex-wrap gap-2"><a href={notificationHref(row)} className="fk-secondary">{{ racha: 'Ver racha', teams: 'Ver times', results: 'Ver resultados', evaluate: 'Ver avaliações', profile: 'Ver conquistas' }[row.destination]}</a>{!row.read_at && <button onClick={() => mark([row.id])} disabled={busy || loading} className="fk-tertiary">Marcar como lida</button>}</div></li>)}</ul>
    {hasMore && <button onClick={() => load(rows.length, tab)} disabled={loading || busy} className="fk-secondary w-full">Carregar mais avisos</button>}
    {message && <p role="status" className="text-sm text-zinc-600">{message}</p>}
    <PushSettings />
  </section>;
}
