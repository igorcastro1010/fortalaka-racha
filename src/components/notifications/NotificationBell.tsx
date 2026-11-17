"use client";

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { getUnreadCount } from '@/lib/notifications/repository';
import { useViewData } from '@/components/live/useViewData';

export function NotificationBell() {
  const state = useViewData('unread-count', ['notifications'], signal => getUnreadCount(signal));
  const count = state.error ? null : state.data;
  return <Link href="/notificacoes" aria-label={`Notificações${count ? `, ${count} não lidas` : ''}`} title="Notificações" className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200"><Bell size={21} aria-hidden="true" />{count != null && count > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-700 px-1 text-center text-[11px] font-bold text-white">{count > 99 ? '99+' : count}</span>}</Link>;
}
