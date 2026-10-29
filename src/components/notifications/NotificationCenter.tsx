"use client";

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { getNotifications, markNotificationsRead, notificationHref, type AppNotification } from '@/lib/notifications/repository';

export function NotificationCenter() {
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
  const load = useCallback(async (offset = 0) => {
    if (pending.current) return;
    pending.current = true; setLoading(true); setError('');
    try {
      const data = await getNotifications(offset);
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
      if (mounted.current) { setRows(previous => previous.map(row => (!ids || ids.includes(row.id)) && !row.read_at ? { ...row, read_at: new Date().toISOString() } : row)); setMessage(ids ? 'Notificação lida.' : 'Todas as notificações foram marcadas como lidas.'); }
    } catch { if (mounted.current) setMessage('Não foi possível marcar como lida. Tente novamente.'); }
    finally { readPending.current = false; if (mounted.current) setBusy(false); }
  }
  return <section aria-label="Central de notificações" className="space-y-4"><Link href="/" className="fk-tertiary inline-flex items-center">← Voltar ao app</Link><h1 className="flex items-center gap-2 text-3xl font-black"><Bell aria-hidden="true" />Notificações</h1><p className="text-sm text-zinc-600">Avisos da rodada e conquistas. Sem notificações a cada gol.</p>
    <div className="flex flex-wrap gap-2"><button onClick={() => load()} disabled={loading || busy} className="fk-secondary">Atualizar</button><button onClick={() => mark(null)} disabled={loading || busy || (!hasMore && !rows.some(row => !row.read_at))} className="fk-secondary"><CheckCheck size={18} aria-hidden="true" />Marcar todas como lidas</button></div>
    {loading && <p role="status">Carregando avisos...</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!loading && !error && !rows.length && <div className="fk-section"><h2 className="text-lg font-black">Tudo em dia</h2><p className="mt-2 text-sm text-zinc-600">Novos avisos aparecerão aqui.</p></div>}
    <ul className="divide-y divide-zinc-200">{rows.map(row => <li key={row.id} className="min-w-0 space-y-2 py-4"><div className="flex items-start gap-3"><Bell size={18} aria-hidden="true" className="mt-1 shrink-0 text-red-700" /><div className="min-w-0 flex-1"><h2 className="break-words text-base font-black">{row.title}</h2><p className="mt-1 break-words text-sm text-zinc-600">{row.body}</p><p className="mt-2 text-xs text-zinc-600"><time dateTime={row.created_at}>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Fortaleza' }).format(new Date(row.created_at))}</time> · {row.read_at ? 'Lida' : 'Não lida'}</p></div></div><div className="flex flex-wrap gap-2"><a href={notificationHref(row)} className="fk-secondary">{{ racha: 'Ver racha', teams: 'Ver times', results: 'Ver resultados', evaluate: 'Ver avaliações', profile: 'Ver conquistas' }[row.destination]}</a>{!row.read_at && <button onClick={() => mark([row.id])} disabled={busy || loading} className="fk-tertiary">Marcar como lida</button>}</div></li>)}</ul>
    {hasMore && <button onClick={() => load(rows.length)} disabled={loading || busy} className="fk-secondary w-full">Carregar mais avisos</button>}
    {message && <p role="status" className="text-sm text-zinc-600">{message}</p>}
    <p className="fk-section text-xs text-zinc-600">Avisos disponíveis dentro do app. Push no celular ainda não está ativado.</p>
  </section>;
}
