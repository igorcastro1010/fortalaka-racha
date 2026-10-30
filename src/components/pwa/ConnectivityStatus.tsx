"use client";

import { useEffect, useState } from 'react';

export function ConnectivityStatus() {
  const [status, setStatus] = useState<'online' | 'offline' | 'restored'>('online');
  useEffect(() => {
    let active = true;
    let wasOffline = !navigator.onLine;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const offline = () => {
      wasOffline = true;
      clearTimeout(timer);
      setStatus('offline');
    };
    const online = () => {
      if (!wasOffline) return;
      wasOffline = false;
      setStatus('restored');
      clearTimeout(timer);
      timer = setTimeout(() => setStatus('online'), 5000);
    };
    void Promise.resolve().then(() => { if (active && !navigator.onLine) offline(); });
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, []);
  if (status === 'online') return null;
  return <aside role="status" className="mx-auto max-w-[640px] border-b border-zinc-200 bg-zinc-100 px-5 py-3 text-sm text-neutral-950" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
    <p className="font-bold">{status === 'offline' ? 'Você está sem conexão.' : 'Conexão restaurada.'}</p>
    {status === 'offline' && <p className="mt-1 text-zinc-600">Algumas informações podem estar indisponíveis ou desatualizadas.</p>}
  </aside>;
}
