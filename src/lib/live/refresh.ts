import { createClient } from '@/lib/supabase/client';
import { ALL_DOMAINS, invalidateMemory, type Domain } from './cache';

// Somente invalidar leituras. Nunca aplicar payload de socket como dado do app.
export const LIVE_TABLES = ['rachas', 'racha_participantes', 'times', 'time_jogadores', 'partidas', 'partida_jogadores', 'eventos_partida', 'fila_times'] as const;
type Listener = { refresh: () => Promise<unknown> | void; pending: boolean; active: boolean; dirty: boolean; domains: readonly Domain[] };
const listeners = new Set<Listener>();
let stop: (() => void) | undefined;
let wake: (() => void) | undefined;
export const TABLE_DOMAINS: Record<string, Domain[]> = {
  rachas: ['round', 'teams', 'matches', 'ratings', 'statistics', 'notifications'],
  racha_participantes: ['round', 'teams', 'payments', 'notifications'],
  times: ['teams', 'ratings', 'notifications'], time_jogadores: ['teams', 'ratings'],
  partidas: ['matches', 'statistics', 'notifications'], partida_jogadores: ['matches', 'statistics'],
  eventos_partida: ['matches', 'statistics'], fila_times: ['matches'],
};
// Estas tabelas não fazem parte da publicação operacional existente. Não
// presumir cobertura do socket nem ampliar publicação/RLS nesta entrega.
const RECONCILE: Domain[] = ['ratings', 'notifications', 'profile', 'payments'];

export function invalidateLive(domains: readonly Domain[] = ALL_DOMAINS) {
  invalidateMemory(domains);
  for (const listener of listeners) if (listener.domains.some(domain => domains.includes(domain))) listener.dirty = true;
  wake?.();
}

function start() {
  let batch: ReturnType<typeof setTimeout> | undefined;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  let reconcile: ReturnType<typeof setTimeout> | undefined;
  let stopped = false, connected = false, delay = 10000;
  const visible = () => navigator.onLine !== false && document.visibilityState !== 'hidden';
  const flush = () => {
    batch = undefined;
    if (!visible()) return;
    for (const listener of listeners) {
      if (listener.pending || !listener.active || !listener.dirty) continue;
      listener.pending = true; listener.dirty = false;
      void Promise.resolve().then(() => listener.active && listener.refresh()).catch(() => {
        // O componente conserva seus dados e trata o erro pela leitura normal.
      }).finally(() => { listener.pending = false; if (listener.active && listener.dirty) schedule(); });
    }
  };
  const schedule = () => { if (!stopped && visible() && !batch) batch = setTimeout(flush, 300); };
  wake = schedule;
  const fallbackTick = () => {
    clearTimeout(fallback);
    if (stopped || connected) return;
    fallback = setTimeout(() => {
      if (visible()) invalidateLive();
      delay = Math.min(delay * 2, 60000); fallbackTick();
    }, delay);
  };
  const reconcileTick = () => {
    reconcile = setTimeout(() => { if (visible()) invalidateLive(RECONCILE); if (!stopped) reconcileTick(); }, 30000);
  };
  const resume = () => { if (visible()) invalidateLive(); };
  window.addEventListener('focus', resume);
  window.addEventListener('online', resume);
  document.addEventListener('visibilitychange', resume);
  let disconnect: (() => void) | undefined;
  try {
    const client = createClient();
    let channel = client.channel('fortalaka-operacao-v1');
    for (const table of LIVE_TABLES) channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => invalidateLive(TABLE_DOMAINS[table]));
    channel.subscribe(status => {
      if (stopped) return;
      connected = status === 'SUBSCRIBED';
      if (connected) { clearTimeout(fallback); delay = 10000; invalidateLive(); }
      else { delay = 10000; fallbackTick(); }
    });
    disconnect = () => { void client.removeChannel(channel).catch(() => {}); };
  } catch { /* O fallback abaixo mantém sincronização sem WebSocket. */ }
  fallbackTick(); reconcileTick();
  return () => {
    stopped = true; wake = undefined;
    clearTimeout(fallback); clearTimeout(reconcile); clearTimeout(batch);
    window.removeEventListener('focus', resume);
    window.removeEventListener('online', resume);
    document.removeEventListener('visibilitychange', resume);
    disconnect?.();
  };
}

export function subscribeLiveRefresh(refresh: Listener['refresh'], domains: readonly Domain[] = ALL_DOMAINS) {
  const listener: Listener = { refresh, pending: false, active: true, dirty: false, domains };
  listeners.add(listener);
  if (!stop) stop = start();
  return () => {
    listener.active = false;
    listeners.delete(listener);
    if (!listeners.size) { stop?.(); stop = undefined; }
  };
}
