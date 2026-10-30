"use client";

import { useEffect, useEffectEvent } from 'react';
import { subscribeLiveRefresh } from '@/lib/live/refresh';

// isCurrent impede aplicar uma leitura que terminou depois de editar/salvar/sair.
export function useLiveRefresh(refresh: (isCurrent: () => boolean) => Promise<void>, enabled = true, scope?: string) {
  const read = useEffectEvent(refresh);
  const allowed = useEffectEvent(() => enabled);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const unsubscribe = subscribeLiveRefresh(() => read(() => active && allowed()));
    return () => { active = false; unsubscribe(); };
  }, [enabled, scope]);
}
