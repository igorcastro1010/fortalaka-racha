"use client";

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { getUnreadCount } from '@/lib/notifications/repository';
import { subscribeLiveRefresh } from '@/lib/live/refresh';

export function NotificationBell() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true, pending = false;
    async function refresh() {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      try { const total = await getUnreadCount(); if (active) setCount(total); }
      catch { if (active) setCount(null); }
      finally { pending = false; }
    }
    void refresh();
    const unsubscribe = subscribeLiveRefresh(refresh);
    return () => { active = false; unsubscribe(); };
  }, []);
  return <a href="/notificacoes" aria-label={`Notificações${count ? `, ${count} não lidas` : ''}`} title="Notificações" className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200"><Bell size={21} aria-hidden="true" />{count != null && count > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-700 px-1 text-center text-[11px] font-bold text-white">{count > 99 ? '99+' : count}</span>}</a>;
}
