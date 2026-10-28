"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, History } from "lucide-react";
import { getHistoricalRound, getRoundHistory, historyDate, type HistoricalRound, type HistoryPage } from "@/lib/results/round-history";
import { LoadingCards, EmptyState } from "@/components/ui/ScreenState";
import { PlayerIdentity } from "@/components/players/PlayerIdentity";
import { PostRoundSummary } from "./PostRoundSummary";

export function RoundHistory({ active, onDetailChange }: { active: boolean; onDetailChange: (detail: boolean) => void }) {
  const [page, setPage] = useState<HistoryPage | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<HistoricalRound | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const busy = useRef(false);
  const cache = useRef(new Map<string, HistoricalRound>());
  const origin = useRef<{ scroll: number; id: string | null }>({ scroll: 0, id: null });
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const title = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function loadMore(offset: number) {
    if (busy.current) return;
    busy.current = true; setLoading(true); setError("");
    try {
      const next = await getRoundHistory(offset);
      if (mounted.current) setPage(previous => ({ hasMore: next.hasMore, rounds: offset ? [...(previous?.rounds ?? []), ...next.rounds.filter(row => !previous?.rounds.some(old => old.id === row.id))] : next.rounds }));
    } catch (e) { console.error("Histórico de rodadas", e); if (mounted.current) setError("Não foi possível carregar o histórico. Tente novamente."); }
    finally { busy.current = false; if (mounted.current) setLoading(false); }
  }

  useEffect(() => { let cancelled = false; void Promise.resolve().then(() => { if (!cancelled && active && page === null && !error) void loadMore(0); }); return () => { cancelled = true; }; }, [active, page, error]);

  async function select(id: string) {
    if (busy.current) return;
    if (!selected) origin.current = { scroll: window.scrollY, id };
    setSelected(id); setError(""); setDetail(cache.current.get(id) ?? null); onDetailChange(true);
    window.scrollTo({ top: 0, behavior: "instant" });
    if (cache.current.has(id)) { requestAnimationFrame(() => title.current?.focus()); return; }
    const current = ++sequence.current;
    busy.current = true; setLoading(true);
    try {
      const data = await getHistoricalRound(id);
      if (mounted.current && current === sequence.current) { cache.current.set(id, data); setDetail(data); requestAnimationFrame(() => title.current?.focus()); }
    } catch (e) { console.error("Detalhe da rodada", e); if (mounted.current && current === sequence.current) setError("Não foi possível carregar esta rodada. Tente novamente."); }
    finally { if (current === sequence.current) { busy.current = false; if (mounted.current) setLoading(false); } }
  }

  function back() {
    sequence.current++; busy.current = false; setSelected(null); setDetail(null); setLoading(false); setError(""); onDetailChange(false);
    requestAnimationFrame(() => { window.scrollTo({ top: origin.current.scroll, behavior: "instant" }); if (origin.current.id) rows.current.get(origin.current.id)?.focus({ preventScroll: true }); });
  }

  return <section aria-label="Histórico de Rodadas" className="min-w-0 space-y-4 py-4">
    {selected ? <>
      <button type="button" onClick={back} className="fk-secondary flex min-h-11 items-center gap-2 px-3 text-sm font-bold"><ArrowLeft size={18} aria-hidden="true" />Voltar ao histórico</button>
      {detail && <>
        <header className="border-b border-zinc-200 pb-4"><p className="text-xs font-bold uppercase text-red-700">Rodada finalizada</p><h3 ref={title} tabIndex={-1} className="mt-2 text-xl font-black focus-visible:outline-2 focus-visible:outline-red-600">{historyDate(detail.round.data)}</h3><p className="mt-1 break-words text-sm font-bold">{detail.round.nome ?? "Racha Fortalaka"}</p>{detail.round.horario && <p className="mt-2 text-sm text-zinc-600">{detail.round.horario.slice(0, 5)}</p>}{detail.round.endereco && <p className="mt-1 break-words text-sm text-zinc-600">{detail.round.endereco}</p>}</header>
        <PostRoundSummary roundId={detail.round.id} date={detail.round.data} matches={detail.matches} historical participants={detail.participants}>
          {detail.teams.length > 0 && <section aria-label="Times da rodada" className="border-b border-zinc-200 py-5"><h3 className="text-sm font-black uppercase">Times da rodada</h3><div className="mt-3 space-y-2">{detail.teams.map(team => <details key={team.id} className="border-t border-zinc-100"><summary className="min-h-12 cursor-pointer content-center break-words text-sm font-bold">{team.name} · {team.players.length}</summary><ul>{team.players.map(player => <li key={player.id} className="py-2"><PlayerIdentity playerId={player.registeredId} name={player.name} avatarUrl={player.avatarUrl} size="sm" /></li>)}</ul></details>)}</div></section>}
        </PostRoundSummary>
      </>}
    </> : <>
      <h3 className="text-xl font-black">Histórico de Rodadas</h3>
      {page?.rounds.length === 0 && !loading && !error && <EmptyState icon={History} title="Nenhuma rodada finalizada ainda." description="" />}
      {page && <ol className="divide-y divide-zinc-200 border-y border-zinc-200">{page.rounds.map(round => <li key={round.id}><button ref={node => { if (node) rows.current.set(round.id, node); else rows.current.delete(round.id); }} type="button" onClick={() => void select(round.id)} className="flex min-h-20 w-full items-center gap-3 py-4 text-left focus-visible:outline-2 focus-visible:outline-red-600"><span className="min-w-0 flex-1"><span className="block text-base font-black uppercase">{historyDate(round.data)}</span><span className="mt-1 block text-xs font-semibold leading-relaxed text-zinc-600">{round.participantCount} {round.participantCount === 1 ? "participante" : "participantes"} · {round.matchCount} {round.matchCount === 1 ? "partida" : "partidas"} · {round.totalGoals} {round.totalGoals === 1 ? "gol" : "gols"}</span></span><ChevronRight size={20} aria-hidden="true" className="shrink-0" /></button></li>)}</ol>}
      {page?.hasMore && !error && <button disabled={loading} onClick={() => void loadMore(page.rounds.length)} className="fk-secondary min-h-12 w-full text-sm font-bold disabled:opacity-50">Carregar mais</button>}
    </>}
    {loading && <LoadingCards label={selected ? "Carregando rodada..." : "Carregando histórico..."} />}
    {error && <div role="alert" className="space-y-2 border-l-2 border-red-600 p-3 text-sm"><p>{error}</p><button disabled={loading} onClick={() => { if (selected) { setSelected(null); void select(selected); } else void loadMore(page?.rounds.length ?? 0); }} className="fk-secondary min-h-11 px-3 font-bold">Tentar novamente</button></div>}
  </section>;
}
