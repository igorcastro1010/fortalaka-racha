"use client";

import { useId, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, Medal, LockKeyhole, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useViewData } from '@/components/live/useViewData';
import { ViewTabs } from '@/components/ui/ViewTabs';
import { EmptyState, LoadingCards } from '@/components/ui/ScreenState';
import { getPlayerEvolution } from '@/lib/players/evolution-repository';
import { evolutionAchievements, historyDate, overallTrend, pointsPercentage, type RatingPoint } from '@/lib/players/evolution';

const domains = ['round', 'matches', 'ratings', 'statistics', 'profile'] as const;

function ReadState({ loading, error, reload }: { loading: boolean; error: string; reload: () => void }) {
  return <>{loading && <LoadingCards label="Carregando desempenho..." />}{error && <div role="alert" className="py-4 text-sm text-red-800"><p>Não foi possível carregar o desempenho.</p><button className="fk-secondary mt-2" onClick={reload}>Tentar novamente</button></div>}</>;
}
function Pages({ page, hasMore, onChange }: { page: number; hasMore: boolean; onChange: (value: number) => void }) {
  return <nav aria-label="Páginas do histórico" className="flex items-center justify-between gap-3 py-3">
    <button title="Página anterior" aria-label="Página anterior" className="fk-secondary min-h-11 min-w-11" disabled={page === 0} onClick={() => onChange(page - 1)}><ChevronLeft size={20} /></button>
    <span className="text-sm text-zinc-600">Página {page + 1}</span>
    <button title="Próxima página" aria-label="Próxima página" className="fk-secondary min-h-11 min-w-11" disabled={!hasMore} onClick={() => onChange(page + 1)}><ChevronRight size={20} /></button>
  </nav>;
}
export function OverallChart({ points }: { points: RatingPoint[] }) {
  const chronological = [...points].filter(p => p.data !== null).reverse();
  const xy = (p: RatingPoint, i: number) => [40 + i * 400 / Math.max(chronological.length - 1, 1), 180 - p.overall * 1.5];
  return <figure className="py-4">
    <figcaption className="mb-2 text-sm font-bold">Overall por rodada</figcaption>
    {chronological.length > 0 && <svg role="img" aria-label="Evolução do overall, de zero a cem. Valores na lista abaixo." viewBox="0 0 480 215" className="w-full" style={{ aspectRatio: '480 / 215' }}>
      {[0, 50, 100].map(value => <g key={value}><line x1="40" x2="450" y1={180 - value * 1.5} y2={180 - value * 1.5} stroke="#d4d4d8" /><text x="8" y={184 - value * 1.5} fill="#52525b" fontSize="14">{value}</text></g>)}
      <polyline points={chronological.map((p, i) => xy(p, i).join(',')).join(' ')} fill="none" stroke="#b91c1c" strokeWidth="3" />
      {chronological.map((p, i) => { const [x, y] = xy(p, i); return <circle key={p.racha_id} cx={x} cy={y} r="4" fill="#b91c1c"><title>{historyDate(p.data)}: {p.overall}</title></circle>; })}
      <text x="40" y="207" fontSize="13" fill="#52525b">{historyDate(chronological[0].data)}</text>
      {chronological.length > 1 && <text x="450" y="207" textAnchor="end" fontSize="13" fill="#52525b">{historyDate(chronological.at(-1)!.data)}</text>}
    </svg>}
    <ol className="divide-y divide-zinc-200">{[...points].reverse().map(p => <li key={p.racha_id} className="flex items-center gap-3 py-3 text-sm"><div className="min-w-0 flex-1"><span className="block break-words font-semibold">{p.nome}</span><time className="text-zinc-600">{historyDate(p.data)}</time></div><strong className="shrink-0 tabular-nums">{p.overall}<span className="font-normal text-zinc-600"> / 100</span></strong></li>)}</ol>
  </figure>;
}
function Ratings({ playerId }: { playerId: string }) {
  const [page, setPage] = useState(0);
  const state = useViewData(`evolution:${playerId}:notas:${page}`, domains, signal => getPlayerEvolution(playerId, 'notas', page, signal));
  return <><ReadState {...state} />{!state.error && state.data && <>{state.data.items.length ? <OverallChart points={state.data.items} /> : <EmptyState title="Evolução ainda indisponível" description="As notas aparecem após fechar as avaliações da rodada, com pelo menos duas respostas válidas." />}<Pages page={page} hasMore={state.data.hasMore} onChange={setPage} /></>}</>;
}
function History({ playerId }: { playerId: string }) {
  const [kind, setKind] = useState<'partidas' | 'rodadas'>('partidas');
  const [page, setPage] = useState(0);
  const matches = useViewData(`evolution:${playerId}:partidas:${page}`, domains, signal => getPlayerEvolution(playerId, 'partidas', page, signal), kind === 'partidas');
  const rounds = useViewData(`evolution:${playerId}:rodadas:${page}`, domains, signal => getPlayerEvolution(playerId, 'rodadas', page, signal), kind === 'rodadas');
  const state = kind === 'partidas' ? matches : rounds;
  return <div className="space-y-3"><ViewTabs label="Tipo de histórico" value={kind} onChange={value => { setKind(value); setPage(0); }} items={[{ id: 'partidas', label: 'Partidas' }, { id: 'rodadas', label: 'Rodadas' }]} />
    <ReadState {...state} />
    {!state.error && state.data?.items.length === 0 && <EmptyState title="Sem partidas registradas" description="O histórico aparece quando houver participação confirmada em uma partida finalizada." />}
    {!state.error && !state.loading && kind === 'partidas' && matches.data?.items.map(m => <article key={m.id} className="border-b border-zinc-200 py-4">
      <p className="text-xs text-zinc-600">{historyDate(m.data)} · {m.nome}</p>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-sm font-bold"><span className="break-words">{m.time_a}</span><span className="whitespace-nowrap text-xl tabular-nums">{m.placar_a} × {m.placar_b}</span><span className="break-words text-right">{m.time_b}</span></div>
      <p className="mt-2 text-sm"><strong className={m.resultado === 'V' ? 'text-green-800' : m.resultado === 'D' ? 'text-red-800' : 'text-zinc-700'}>{m.resultado === 'V' ? 'Vitória' : m.resultado === 'E' ? 'Empate' : 'Derrota'}</strong><span className="text-zinc-600"> · {m.gols} {m.gols === 1 ? 'gol' : 'gols'} · {m.assistencias} {m.assistencias === 1 ? 'assistência' : 'assistências'}</span></p>
    </article>)}
    {!state.error && !state.loading && kind === 'rodadas' && rounds.data?.items.map(r => <article key={r.racha_id} className="border-b border-zinc-200 py-4"><h4 className="break-words font-bold">{r.nome}</h4><p className="text-sm text-zinc-600">{historyDate(r.data)} · {r.jogos} {r.jogos === 1 ? 'partida' : 'partidas'} · {r.gols} {r.gols === 1 ? 'gol' : 'gols'}</p><p className="mt-2 text-sm">Vitórias: {r.vitorias} · Empates: {r.empates} · Derrotas: {r.derrotas}</p></article>)}
    {state.data && !state.error && <Pages page={page} hasMore={state.data.hasMore} onChange={setPage} />}
  </div>;
}

function Achievements({ items }: { items: ReturnType<typeof evolutionAchievements> }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const earned = items.filter(a => a.earned);
  const locked = items.filter(a => !a.earned).sort((a, b) => b.current / b.target - a.current / a.target);
  const visibleLocked = expanded ? locked : locked.slice(0, 3);
  const row = (a: (typeof items)[number]) => <li key={a.id} className="min-w-0 border-b border-zinc-200">
    <details className="group">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 py-3 focus-visible:outline-2 focus-visible:outline-red-700 [&::-webkit-details-marker]:hidden">
        {a.earned ? <Medal size={22} className="shrink-0 text-red-700" aria-hidden="true" /> : <LockKeyhole size={20} className="shrink-0 text-zinc-500" aria-hidden="true" />}
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-bold">{a.title}</span>
          <span className="mt-1 block text-xs text-zinc-600">{a.earned ? `Desbloqueada${a.date ? ` · ${historyDate(a.date)}` : ''}` : `Bloqueada · ${Math.min(a.current, a.target)} de ${a.target}`}</span>
          {!a.earned && <progress aria-label={`Progresso: ${a.title}`} value={Math.min(a.current, a.target)} max={a.target} className="mt-2 block h-1 w-full appearance-none overflow-hidden rounded bg-zinc-200 [&::-webkit-progress-bar]:bg-zinc-200 [&::-webkit-progress-value]:bg-red-700 [&::-moz-progress-bar]:bg-red-700" />}
        </span>
        <ChevronDown size={18} className="shrink-0 text-zinc-500 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <p className="pb-3 pl-8 text-sm leading-relaxed text-zinc-600">{a.description}</p>
    </details>
  </li>;
  return <div className="space-y-4">
    <p className="text-sm text-zinc-600">{earned.length} de {items.length} conquistas desbloqueadas</p>
    {earned.length > 0 && <section aria-label="Desbloqueadas"><h4 className="text-sm font-bold">Desbloqueadas</h4><ul>{earned.map(row)}</ul></section>}
    {locked.length > 0 && <section aria-label="Próximas conquistas"><h4 className="text-sm font-bold">Próximas conquistas</h4><ul id={listId}>{visibleLocked.map(row)}</ul></section>}
    {locked.length > 3 && <button type="button" className="fk-secondary min-h-11 w-full gap-2" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(value => !value)}>{expanded ? 'Mostrar menos' : `Ver todas (${items.length})`}<ChevronDown size={18} className={`shrink-0 transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" /></button>}
  </div>;
}

export default function PlayerEvolution({ playerId }: { playerId: string }) {
  const [tab, setTab] = useState<'evolution' | 'history' | 'achievements'>('evolution');
  const state = useViewData(`evolution:${playerId}:resumo`, domains, signal => getPlayerEvolution(playerId, 'resumo', 0, signal));
  const summary = state.data;
  const achievements = summary ? evolutionAchievements(summary) : [];
  const delta = summary ? overallTrend(summary.overall.ultimas) : null;
  const Trend = delta === null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return <div className="min-w-0 space-y-4 pt-3">
    <ViewTabs label="Desempenho do atleta" value={tab} onChange={setTab} items={[{ id: 'evolution', label: 'Evolução' }, { id: 'history', label: 'Histórico' }, { id: 'achievements', label: 'Conquistas' }]} />
    <ReadState {...state} />
    {summary && !state.error && <>
      {tab === 'evolution' && <><dl className="grid grid-cols-3 gap-3 border-b border-zinc-200 py-4">{[['Média geral', summary.overall.media], ['Mais recente', summary.overall.ultimas[0]?.overall], ['Melhor nota', summary.overall.melhor]].map(([label, value]) => <div key={label}><dt className="text-xs text-zinc-600">{label}</dt><dd className="mt-1 text-2xl font-black tabular-nums">{value ?? '--'}</dd></div>)}</dl>
        <p className={`flex items-center gap-2 text-sm font-semibold ${delta !== null && delta > 0 ? 'text-green-800' : delta !== null && delta < 0 ? 'text-red-800' : 'text-zinc-600'}`}><Trend size={20} aria-hidden="true" />{delta === null ? 'Sem comparação entre rodadas' : delta === 0 ? 'Estável na última rodada' : `${delta > 0 ? '+' : ''}${delta} pontos na última rodada`}</p>
        <Ratings playerId={playerId} /></>}
      {tab === 'history' && <><dl className="grid grid-cols-3 gap-x-3 gap-y-5 border-b border-zinc-200 py-4">{[['Partidas', summary.stats.jogos], ['Gols', summary.stats.gols], ['Aproveitamento', pointsPercentage(summary.stats) === null ? '--' : `${pointsPercentage(summary.stats)}%`], ['Vitórias', summary.stats.vitorias], ['Empates', summary.stats.empates], ['Derrotas', summary.stats.derrotas]].map(([label, value]) => <div key={label}><dt className="break-words text-xs text-zinc-600">{label}</dt><dd className="mt-1 text-xl font-black tabular-nums">{value}</dd></div>)}</dl><History playerId={playerId} /></>}
      {tab === 'achievements' && <Achievements key={playerId} items={achievements} />}
    </>}
  </div>;
}
