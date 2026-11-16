// Somente apresentação no navegador. Repositórios e mutações não usam este cache.
export type Domain = 'round' | 'teams' | 'matches' | 'statistics' | 'ratings' | 'notifications' | 'profile' | 'payments';
export const ALL_DOMAINS: Domain[] = ['round', 'teams', 'matches', 'statistics', 'ratings', 'notifications', 'profile', 'payments'];
type Entry = { tags: readonly Domain[]; controller: AbortController; promise: Promise<unknown>; value?: unknown; ready: boolean; at: number; users: number };
const entries = new Map<string, Entry>();
let session: string | null = null;
const aborted = () => new DOMException('Leitura substituída ou cancelada.', 'AbortError');

export function invalidateMemory(tags: readonly Domain[] = ALL_DOMAINS) {
  for (const [key, entry] of entries) if (entry.tags.some(tag => tags.includes(tag))) {
    entries.delete(key); entry.controller.abort();
  }
}

export function setMemorySession(id: string | null) {
  if (id !== session) { invalidateMemory(); session = id; }
}

export function readMemory<T>(key: string, tags: readonly Domain[], load: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal, ttl = 30000): Promise<T> {
  if (signal?.aborted) return Promise.reject(aborted());
  if (typeof window === 'undefined' || !session) return load(signal ?? new AbortController().signal);
  let entry = entries.get(key);
  if (entry?.ready && Date.now() - entry.at < ttl) return Promise.resolve(entry.value as T);
  if (entry?.ready) { entries.delete(key); entry = undefined; }
  if (!entry) {
    // Limite de memória: remover apenas entradas concluídas, nunca leitores ativos.
    if (entries.size >= 100) for (const [oldKey, old] of entries) if (old.ready) { entries.delete(oldKey); break; }
    const next: Entry = { tags, controller: new AbortController(), promise: Promise.resolve(), ready: false, at: 0, users: 0 };
    entries.set(key, next);
    next.promise = Promise.resolve().then(() => load(next.controller.signal)).then(value => {
      if (entries.get(key) !== next || next.controller.signal.aborted) throw aborted();
      next.value = value; next.ready = true; next.at = Date.now(); return value;
    }).catch(error => { if (entries.get(key) === next) entries.delete(key); throw error; });
    entry = next;
  }
  const current = entry;
  current.users++;
  return new Promise<T>((resolve, reject) => {
    let done = false;
    const finish = (error?: unknown, value?: T) => {
      if (done) return;
      done = true; signal?.removeEventListener('abort', cancel); current.controller.signal.removeEventListener('abort', cancelled);
      current.users--;
      if (!current.ready && !current.users) {
        if (entries.get(key) === current) entries.delete(key);
        current.controller.abort();
      }
      if (error) reject(error); else resolve(value as T);
    };
    const cancel = () => finish(aborted());
    const cancelled = () => finish(aborted());
    signal?.addEventListener('abort', cancel, { once: true });
    current.controller.signal.addEventListener('abort', cancelled, { once: true });
    current.promise.then(value => finish(undefined, value as T), error => finish(error));
  });
}
