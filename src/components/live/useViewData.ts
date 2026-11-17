"use client";

import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { readMemory, invalidateMemory, type Domain } from '@/lib/live/cache';
import { invalidateLive, subscribeLiveRefresh } from '@/lib/live/refresh';

// Cache só para exibição. Nenhuma ação crítica deve consumir este hook para
// decidir se pode gravar: suas RPCs continuam verificando estado/versão no banco.
export function useViewData<T>(key: string, domains: readonly Domain[], load: (signal: AbortSignal) => Promise<T>, enabled = true) {
  const [state, setState] = useState<{ key: string; data: T | null; loading: boolean; error: string }>({ key, data: null, loading: true, error: '' });
  const [revision, setRevision] = useState(0);
  const loader = useEffectEvent(load);
  const tags = domains.join(',');
  const reload = useCallback(() => { invalidateMemory(domains); setRevision(n => n + 1); }, [tags]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let sequence = 0;
    let controller: AbortController;
    const read = async () => {
      const request = ++sequence;
      controller?.abort(); controller = new AbortController();
      const signal = controller.signal;
      try {
        const data = await readMemory(key, tags.split(',') as Domain[], signal => loader(signal), signal);
        if (active && request === sequence) setState(current => ({ key, data: current.key === key && JSON.stringify(current.data) === JSON.stringify(data) ? current.data : data, loading: false, error: '' }));
      } catch (error) {
        if (!active || request !== sequence || signal.aborted) return;
        if (error instanceof Error && error.name === 'AbortError') { void read().catch(() => {}); return; }
        setState(current => ({ data: current.key === key ? current.data : null, key, loading: false, error: 'Não foi possível atualizar os dados. Tente novamente.' }));
        throw error;
      }
    };
    const unsubscribe = subscribeLiveRefresh(read, tags.split(',') as Domain[], false);
    void read().catch(() => { if (active) invalidateLive(tags.split(',') as Domain[]); });
    return () => { active = false; ++sequence; controller?.abort(); unsubscribe(); };
  }, [key, tags, enabled, revision]);
  const current = state.key === key ? state : { data: null, loading: true, error: '' };
  return { data: current.data, loading: current.loading, error: current.error, reload };
}
