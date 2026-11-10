import { createClient } from '@/lib/supabase/client';

export type PushStatus = 'unsupported' | 'homescreen' | 'unconfigured' | 'denied' | 'enabled' | 'disabled';
const DB = 'fortalaka-push';
const STORE = 'settings';
const TIMEOUT = 10000;
let operations: Promise<unknown> = Promise.resolve();
class PushError extends Error {}

export function pushErrorMessage(cause: unknown): string {
  return cause instanceof PushError ? cause.message : 'Não foi possível alterar as notificações deste dispositivo. Tente novamente.';
}

function bounded<T>(promise: PromiseLike<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new PushError('O dispositivo demorou a responder. Tente novamente.')), TIMEOUT);
    Promise.resolve(promise).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function exclusive<T>(action: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => navigator.locks ? await navigator.locks.request('fortalaka-push', action) : await action();
  const result = operations.then(run, run);
  operations = result.catch(() => {});
  return result;
}

export function pushAvailability(): PushStatus | null {
  if (typeof window === 'undefined') return 'unsupported';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && !window.matchMedia('(display-mode: standalone)').matches && !(navigator as Navigator & { standalone?: boolean }).standalone) return 'homescreen';
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (!process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY) return 'unconfigured';
  return null;
}

// Shared with sw.js, outside the offline cache: absence or storage failure is fail-closed.
async function localState(endpoint: string | null | undefined): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let expired = false;
    let transaction: IDBTransaction | undefined;
    const timer = setTimeout(() => {
      expired = true;
      transaction?.abort();
      reject(new PushError('Não foi possível salvar a preferência deste dispositivo.'));
    }, TIMEOUT);
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(DB, 1); }
    catch (cause) { clearTimeout(timer); reject(cause); return; }
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => { clearTimeout(timer); reject(request.error); };
    request.onsuccess = () => {
      const db = request.result;
      if (expired) { db.close(); return; }
      const tx = db.transaction(STORE, endpoint === undefined ? 'readonly' : 'readwrite');
      transaction = tx;
      const read = endpoint === undefined ? tx.objectStore(STORE).get('endpoint') : null;
      if (!read) tx.objectStore(STORE).put(endpoint, 'endpoint');
      tx.oncomplete = () => { clearTimeout(timer); db.close(); resolve(read?.result ?? endpoint ?? null); };
      tx.onerror = tx.onabort = () => { clearTimeout(timer); db.close(); reject(tx.error); };
    };
  });
}

async function rpc(name: 'registrar_push' | 'remover_push' | 'push_ativo', args: Record<string, string>) {
  const { data, error } = await bounded(createClient().rpc(name, args));
  if (error) throw new PushError('Não foi possível sincronizar as notificações. Tente novamente.');
  return data;
}

async function registration() {
  return bounded(navigator.serviceWorker.getRegistration('/'));
}

async function requirePushWorker(reg: ServiceWorkerRegistration): Promise<void> {
  const message = 'Atualize o app pelo aviso de atualização e tente ativar novamente.';
  if (!reg.active) throw new PushError(message);
  const channel = new MessageChannel();
  try {
    await bounded(new Promise<void>((resolve, reject) => {
      channel.port1.onmessage = event => {
        if (event.data?.type === 'FORTALAKA_PUSH_CAPABILITIES' && event.data.version === 1) resolve();
        else reject(new PushError(message));
      };
      reg.active!.postMessage({ type: 'FORTALAKA_PUSH_CAPABILITIES' }, [channel.port2]);
    }));
  } catch { throw new PushError(message); }
  finally { channel.port1.close(); channel.port2.close(); }
}

export function getPushStatus(): Promise<PushStatus> {
  return exclusive(async () => {
    const unavailable = pushAvailability();
    if (unavailable) return unavailable;
    const reg = await registration();
    const sub = reg ? await bounded(reg.pushManager.getSubscription()) : null;
    if (!sub) { await localState(null); return 'disabled'; }
    const enabled = await rpc('push_ativo', { p_endpoint: sub.endpoint }) === true;
    // A read can revoke local delivery, but never constitutes a new opt-in.
    if (!enabled || Notification.permission !== 'granted') await localState(null);
    return enabled && Notification.permission === 'granted' && await localState(undefined) === sub.endpoint ? 'enabled' : 'disabled';
  });
}

export function enablePush(): Promise<void> {
  // Call permission synchronously from the click, before awaiting registration/storage.
  const unavailable = pushAvailability();
  if (unavailable) return Promise.reject(new PushError('Push indisponível neste dispositivo.'));
  let permission: Promise<NotificationPermission>;
  try { permission = Notification.permission === 'granted' ? Promise.resolve('granted') : Notification.requestPermission(); }
  catch { return Promise.reject(new PushError('Não foi possível solicitar a permissão. Confira os ajustes do navegador.')); }
  return exclusive(async () => {
    if (await bounded(permission) !== 'granted') throw new PushError('Permissão não concedida. Confira os ajustes do navegador.');
    await localState(null);
    await bounded(navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }));
    const ready = await bounded(navigator.serviceWorker.ready);
    await requirePushWorker(ready);
    let sub = await bounded(ready.pushManager.getSubscription());
    if (!sub) {
      const encoded = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY!;
      const raw = atob(encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '='));
      sub = await bounded(ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, char => char.charCodeAt(0)) }));
    }
    const json = sub.toJSON();
    if (!json.keys?.p256dh || !json.keys.auth) throw new PushError('Assinatura inválida. Tente novamente.');
    await rpc('registrar_push', { p_endpoint: sub.endpoint, p_p256dh: json.keys.p256dh, p_auth: json.keys.auth });
    if (await rpc('push_ativo', { p_endpoint: sub.endpoint }) !== true) throw new PushError('A ativação não foi confirmada. Tente novamente.');
    await localState(sub.endpoint);
  });
}

export function cleanupPushOnLogout(): Promise<void> {
  return exclusive(async () => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    let failed = false;
    try { await localState(null); } catch { failed = true; }
    let reg: ServiceWorkerRegistration | undefined;
    try { reg = await registration(); } catch { failed = true; }
    if (reg) {
      try { (await bounded(reg.getNotifications())).forEach(notification => notification.close()); }
      catch { failed = true; }
      let sub: PushSubscription | null = null;
      try { if (reg.pushManager) sub = await bounded(reg.pushManager.getSubscription()); }
      catch { failed = true; }
      if (sub) {
        // Server cleanup must never prevent stopping delivery in the browser.
        try { if (!await bounded(sub.unsubscribe())) failed = true; } catch { failed = true; }
        try { await rpc('remover_push', { p_endpoint: sub.endpoint }); } catch { failed = true; }
      }
    }
    if (failed) throw new PushError('Não foi possível concluir toda a desativação. Confira a conexão e tente novamente.');
  });
}

export const disablePush = cleanupPushOnLogout;
