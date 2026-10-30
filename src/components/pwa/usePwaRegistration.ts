"use client";

import { useEffect, useRef, useState } from 'react';

export function usePwaRegistration() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const accepted = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator) || !window.isSecureContext) return;
    let active = true;
    let registration: ServiceWorkerRegistration | null = null;
    let checking = false;
    let lastCheck = 0;
    const watched = new Map<ServiceWorker, () => void>();
    function watch() {
      const worker = registration?.installing;
      if (!worker || watched.has(worker)) return;
      const change = () => {
        if (active && worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(registration?.waiting ?? worker);
      };
      watched.set(worker, change);
      worker.addEventListener('statechange', change);
      change();
    }
    async function start() {
      try {
        const next = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
        if (!active) return;
        registration = next;
        if (next.waiting) setWaiting(next.waiting);
        next.addEventListener('updatefound', watch);
        watch();
      } catch {
        if (active && navigator.onLine) setError('Não foi possível preparar a instalação agora. O app continua disponível.');
      }
    }
    async function check() {
      if (!registration || checking || !navigator.onLine || document.visibilityState === 'hidden' || Date.now() - lastCheck < 60000) return;
      checking = true; lastCheck = Date.now();
      try { await registration.update(); } catch { /* Uma falha de rede não interrompe o app. */ }
      finally { checking = false; }
    }
    function changed() { if (accepted.current) window.location.reload(); }
    navigator.serviceWorker.addEventListener('controllerchange', changed);
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', check);
    if (document.readyState === 'complete') void start();
    else window.addEventListener('load', start, { once: true });
    return () => {
      active = false;
      clearTimeout(timeout.current);
      window.removeEventListener('load', start);
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', check);
      navigator.serviceWorker.removeEventListener('controllerchange', changed);
      registration?.removeEventListener('updatefound', watch);
      watched.forEach((listener, worker) => worker.removeEventListener('statechange', listener));
    };
  }, []);
  async function update() {
    if (!waiting || accepted.current) return;
    if (!navigator.onLine) { setError('Conecte-se à internet antes de atualizar.'); return; }
    accepted.current = true; setUpdating(true); setError('');
    try {
      // Outra aba ou publicação pode ter substituído o worker exibido no aviso.
      const current = await navigator.serviceWorker.getRegistration();
      const worker = current?.waiting;
      if (!worker && current?.active?.state === 'activated') { window.location.reload(); return; }
      if (!worker || worker.state === 'redundant') throw new Error('Worker indisponível');
      worker.postMessage({ type: 'SKIP_WAITING' });
      timeout.current = setTimeout(() => {
        accepted.current = false; setUpdating(false);
        setError('A atualização não terminou. Tente novamente quando estiver conectado.');
      }, 15000);
    } catch {
      accepted.current = false; setUpdating(false);
      setError('Não foi possível atualizar agora. Tente novamente.');
    }
  }
  return { waiting, updating, error, update };
}
