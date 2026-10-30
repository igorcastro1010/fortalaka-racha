import { createClient } from '@/lib/supabase/client';

// Somente invalidar leituras. Nunca aplicar payload de socket como dado do app.
export const LIVE_TABLES = ['rachas', 'racha_participantes', 'times', 'time_jogadores', 'partidas', 'partida_jogadores', 'eventos_partida', 'fila_times'] as const;
type Listener = { refresh: () => Promise<unknown> | void; pending: boolean; active: boolean };
const listeners = new Set<Listener>();
let stop: (() => void) | undefined;

function start() {
  let batch: ReturnType<typeof setTimeout> | undefined;
  const visible = () => navigator.onLine !== false && document.visibilityState !== 'hidden';
  const flush = () => {
    batch = undefined;
    if (!visible()) return;
    for (const listener of listeners) {
      if (listener.pending || !listener.active) continue;
      listener.pending = true;
      void Promise.resolve().then(() => listener.active && listener.refresh()).catch(() => {
        // O componente conserva seus dados e trata o erro pela leitura normal.
      }).finally(() => { listener.pending = false; });
    }
  };
  const schedule = () => { if (visible() && !batch) batch = setTimeout(flush, 300); };
  const timer = setInterval(schedule, 5000);
  window.addEventListener('focus', schedule);
  window.addEventListener('online', schedule);
  document.addEventListener('visibilitychange', schedule);
  let disconnect: (() => void) | undefined;
  try {
    const client = createClient();
    let channel = client.channel('fortalaka-operacao-v1');
    for (const table of LIVE_TABLES) channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule);
    channel.subscribe(status => { if (status === 'SUBSCRIBED') schedule(); });
    disconnect = () => { void client.removeChannel(channel).catch(() => {}); };
  } catch { /* Sem WebSocket, mantém a atualização periódica protegida por RLS. */ }
  return () => {
    clearInterval(timer); clearTimeout(batch);
    window.removeEventListener('focus', schedule);
    window.removeEventListener('online', schedule);
    document.removeEventListener('visibilitychange', schedule);
    disconnect?.();
  };
}

export function subscribeLiveRefresh(refresh: Listener['refresh']) {
  const listener: Listener = { refresh, pending: false, active: true };
  listeners.add(listener);
  if (!stop) stop = start();
  return () => {
    listener.active = false;
    listeners.delete(listener);
    if (!listeners.size) { stop?.(); stop = undefined; }
  };
}
