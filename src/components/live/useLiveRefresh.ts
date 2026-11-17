"use client";

import { useEffect, useEffectEvent } from 'react';
import { subscribeLiveRefresh } from '@/lib/live/refresh';
import { ALL_DOMAINS, type Domain } from '@/lib/live/cache';

// isCurrent impede aplicar uma leitura que terminou depois de editar/salvar/sair.
export function useLiveRefresh(refresh: (isCurrent: () => boolean, signal: AbortSignal) => Promise<void>, enabled = true, scope?: string, domains: readonly Domain[] = ALL_DOMAINS, onError?: () => void) {
  const read = useEffectEvent(refresh);
  const allowed = useEffectEvent(() => enabled);
  const tags = domains.join(',');
  const failed = useEffectEvent(() => onError?.());
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let controller: AbortController | undefined;
    const unsubscribe = subscribeLiveRefresh(async () => {
      controller = new AbortController();
      try { await read(() => active && allowed(), controller.signal); }
      catch (error) { if (active && !controller.signal.aborted) { failed(); throw error; } }
    }, tags.split(',') as Domain[]);
    return () => { active = false; controller?.abort(); unsubscribe(); };
  }, [enabled, scope, tags]);
}
