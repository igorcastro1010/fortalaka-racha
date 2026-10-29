"use client";

import { useEffect, useState } from 'react';
import { Medal, ShieldCheck } from 'lucide-react';
import { getAchievements } from '@/lib/players/achievements';
import { getPlayerRoundHonours } from '@/lib/players/achievement-repository';

export function PlayerAchievements({ playerId, stats }: { playerId: string; stats: { jogos: number; gols: number; assistencias: number; vitorias: number } }) {
  const [honours, setHonours] = useState<{ playerId: string; scorer: number; assists: number; error: boolean } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const all = getAchievements(stats);
  const earned = all.filter(a => a.earned);
  // História completa só é consultada sob demanda; marcos reutilizam as estatísticas já carregadas.
  useEffect(() => {
    if (!expanded) return;
    const controller = new AbortController();
    getPlayerRoundHonours(playerId, controller.signal).then(data => { if (!controller.signal.aborted) setHonours({ playerId, ...data, error: false }); })
      .catch(() => { if (!controller.signal.aborted) setHonours({ playerId, scorer: 0, assists: 0, error: true }); });
    return () => controller.abort();
  }, [playerId, expanded]);
  const current = honours?.playerId === playerId ? honours : null;
  return <section aria-label="Conquistas" className="fk-section space-y-4"><h3 className="flex items-center gap-2 text-lg font-black"><Medal aria-hidden="true" size={21} />Conquistas</h3>
    {!earned.length && <p className="text-sm text-zinc-600">As primeiras conquistas começam em campo.</p>}
    <ul className="grid grid-cols-2 gap-3">{earned.map(a => <li key={a.id} className="min-w-0 border-l-2 border-red-700 bg-zinc-50 p-3"><ShieldCheck size={22} className="mb-2 text-red-700" aria-hidden="true" /><p className="break-words text-sm font-black">{a.title}</p><p className="mt-1 text-xs leading-relaxed text-zinc-600">{a.description}</p></li>)}</ul>
    <details><summary className="min-h-11 cursor-pointer content-center text-sm font-bold">Próximos marcos</summary><ul className="space-y-2 pt-2">{all.filter(a => !a.earned).map(a => <li key={a.id} className="text-sm text-zinc-600">{a.title} · {a.current}/{a.target}</li>)}</ul></details>
    <details onToggle={event => setExpanded(event.currentTarget.open)}><summary className="min-h-11 cursor-pointer content-center text-sm font-bold">Prêmios de rodada</summary><div role="status" className="space-y-2 py-3 text-sm text-zinc-600">{!current ? 'Consultando rodadas finalizadas...' : current.error ? 'Não foi possível consultar os prêmios. Os marcos acima continuam disponíveis.' : <><p>Artilheiro da rodada: <strong>{current.scorer}</strong></p><p>Garçom da rodada: <strong>{current.assists}</strong></p><p className="text-xs">Empates em primeiro lugar compartilham o prêmio. Somente rodadas e partidas finalizadas com eventos registrados.</p></>}</div></details>
  </section>;
}
