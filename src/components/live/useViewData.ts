"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { readMemory, invalidateMemory, type Domain } from '@/lib/live/cache';
import { subscribeLiveRefresh } from '@/lib/live/refresh';

// Cache só para exibição. Nenhuma ação crítica deve consumir este hook para
// decidir se pode gravar: suas RPCs continuam verificando estado/versão no banco.
export function useViewData<T>(key: string, domains: readonly Domain[], load: (signal: AbortSignal) => Promise<T>, enabled = true) {
  const [state, setState] = useState<{ key: string; data: T | null; loading: boolean; error: string }>({ key, data: null, loading: true, error: '' });
  const [revision, setRevision] = useState(0);
  const loader = useEffectEvent(load);
  const tags = domains.join(',');
  const sequence = useRef(0);
  const reload = useCallback(() => { invalidateMemory(domains); setRevision(n => n + 1); }, [tags]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let controller: AbortController;
    const read = async () => {
      const request = ++sequence.current;
      controller?.abort(); controller = new AbortController();
      const signal = controller.signal;
      try {
        const data = await readMemory(key, tags.split(',') as Domain[], signal => loader(signal), signal);
        if (active && request === sequence.current) setState(current => ({ key, data: JSON.stringify(current.data) === JSON.stringify(data) ? current.data : data, loading: false, error: '' }));
      } catch (error) {
        if (!active || request !== sequence.current || signal.aborted) return;
        if (error instanceof Error && error.name === 'AbortError') { void read(); return; }
        setState(current => ({ ...current, key, loading: false, error: 'Não foi possível atualizar os dados. Tente novamente.' }));
      }
    };
    const unsubscribe = subscribeLiveRefresh(read, tags.split(',') as Domain[]);
    void read();
    return () => { active = false; ++sequence.current; controller?.abort(); unsubscribe(); };
  }, [key, tags, enabled, revision]);
  const current = state.key === key ? state : { data: null, loading: true, error: '' };
  return { ...current, reload };
}
