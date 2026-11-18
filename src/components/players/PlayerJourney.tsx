"use client";

import { lazy, Suspense, useId, useState } from 'react';
import { ChevronDown, TrendingUp } from 'lucide-react';
import { LoadingCards } from '@/components/ui/ScreenState';

const PlayerEvolution = lazy(() => import('./PlayerEvolution'));

export function PlayerJourney({ playerId }: { playerId: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <section className="min-w-0 border-t border-zinc-200 py-4">
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)} className="flex min-h-12 w-full items-center gap-3 py-2 text-left font-bold focus-visible:outline-2 focus-visible:outline-red-700">
      <TrendingUp size={22} className="shrink-0 text-red-700" aria-hidden="true" />
      <span className="min-w-0 flex-1">Evolução, histórico e conquistas</span>
      <ChevronDown size={20} aria-hidden="true" className={`shrink-0 motion-safe:transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    <div id={id}>{open && <Suspense fallback={<LoadingCards label="Carregando desempenho..." />}><PlayerEvolution key={playerId} playerId={playerId} /></Suspense>}</div>
  </section>;
}
