"use client";

import { useCallback, useEffect, useState } from "react";
import { getPlayerStatistics, type PlayerStatistics } from "@/lib/matches/repository";
import { PlayerAvatar } from "./PlayerAvatar";
import { Trophy } from "lucide-react";
import { EmptyState, LoadingCards } from "@/components/ui/ScreenState";
import { rankingMetric, rankingOptions, sortRanking, type RankingSort } from "@/lib/players/ranking";

function useStatistics(playerId?: string) {
  const [data, setData] = useState<PlayerStatistics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setData(await getPlayerStatistics(playerId)); }
    catch (e) { setError(e instanceof Error ? e.message : "Nao foi possivel carregar as estatisticas."); }
    finally { setLoading(false); }
  }, [playerId]);
  useEffect(() => {
    let active = true;
    const read = async () => {
      try {
        const rows = await getPlayerStatistics(playerId);
        if (active) { setData(rows); setError(""); }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Nao foi possivel carregar as estatisticas.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void read();
    window.addEventListener("focus", read);
    return () => { active = false; window.removeEventListener("focus", read); };
  }, [playerId]);
  return { data, loading, error, reload };
}

function Metrics({ player }: { player: PlayerStatistics }) {
  return <dl className="grid grid-cols-4 divide-x divide-zinc-100 text-center">{[
    ["Jogos", player.jogos], ["Gols", player.gols], ["Ast", player.assistencias], ["Vit", player.vitorias],
  ].map(([label, value]) => <div key={label} className="px-1"><dd className="text-xl font-black tracking-tight font-black tabular-nums text-neutral-950">{value}</dd><dt className="mt-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">{label}</dt></div>)}</dl>;
}

function ReadStatus({ loading, error, reload }: { loading: boolean; error: string; reload: () => void }) {
  return <>{loading && <LoadingCards label="Carregando estatisticas..." />}{error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700"><p>{error}</p><button onClick={reload} className="mt-2 min-h-11 font-bold underline">Tentar novamente</button></div>}</>;
}

export function RankingScreen({ sort, onSortChange }: { sort: RankingSort; onSortChange: (sort: RankingSort) => void }) {
  const state = useStatistics();
  const ranking = sortRanking(state.data, sort);
  const activeLabel = rankingOptions.find(option => option.id === sort)!.label;
  return <section aria-label="Ranking dos jogadores" className="min-w-0 space-y-3"><div><h2 className="text-[32px] font-black leading-[0.9] tracking-tighter">Ranking</h2><p className="mt-0.5 text-xs font-black uppercase tracking-wider text-zinc-500">{sort === "geral" ? "Classificação por overall — maior nota primeiro" : `${activeLabel} — maior valor primeiro`}</p></div>
    <div role="group" aria-label="Ordenação do ranking" className="flex w-full min-w-0 gap-2 overflow-x-auto pb-2">
      {rankingOptions.map(option => <button key={option.id} type="button" aria-pressed={sort === option.id} onClick={() => onSortChange(option.id)} className={`min-h-11 shrink-0 rounded-full border px-4 text-xs font-black transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${sort === option.id ? "border-red-600 bg-red-600 text-white shadow-md shadow-red-600/20 shadow-md shadow-red-600/20" : "border-zinc-200 bg-white text-neutral-950 hover:bg-zinc-50 shadow-sm"}`}>{option.label}</button>)}
    </div>
    <ReadStatus {...state} />
    {!state.error && !state.loading && !state.data.length && <EmptyState icon={Trophy} title="O ranking começa em campo" description="O desempenho dos jogadores aparece aqui depois das partidas." />}
    {!state.error && ranking.map((player, index) => {
      const metric = rankingMetric(player, sort);
      return <article key={player.jogador_id} className={`rounded-2xl border bg-white p-4 shadow-sm ring-1 ring-black/[0.03] ${index === 0 ? "border-red-200 border-l-[3px] border-l-red-600" : index < 3 ? "border-zinc-200 border-l-[3px] border-l-zinc-500" : "border-zinc-200"}`}>
      <div className="flex items-center gap-2.5"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${index === 0 ? "bg-red-600 text-white" : "bg-zinc-100 text-zinc-800"}`} aria-label={`${index + 1}º lugar${index < 3 ? ", Top 3" : ""}`}>{index + 1}º</span><PlayerAvatar name={player.nome} avatarUrl={player.avatar_url} size="sm" /><h3 className="min-w-0 flex-1 break-words text-lg font-black tracking-tight">{player.nome}</h3><span aria-label={metric.value == null ? "Nota media ainda nao disponivel" : sort === "geral" || sort === "nota" ? `Nota media ${metric.value}` : `${metric.value} ${metric.label}`} className={`w-20 shrink-0 rounded-xl px-1 py-1 text-center ${metric.value == null ? "bg-zinc-50 text-zinc-400" : "bg-red-50 text-red-700"}`}><strong className="block text-2xl font-black tabular-nums text-red-600">{metric.value ?? "--"}</strong><span className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">{metric.label}</span></span></div>
      <div className="mt-2 border-t border-zinc-100 pt-2"><Metrics player={player} /></div>
      {player.quantidade_avaliacoes === 1 && <p className="mt-2 text-center text-[11px] font-semibold text-zinc-500">Nota oculta ate receber 2 avaliacoes.</p>}
    </article>; })}
  </section>;
}

export function PlayerStatisticsCard({ playerId, compact = false }: { playerId: string; compact?: boolean }) {
  const state = useStatistics(playerId);
  return <section className={`rounded-2xl bg-white p-4 text-neutral-950 shadow-sm ring-1 ring-black/[0.03] ${compact ? "" : "ring-1 ring-black/5"}`}><h3 className={`mb-3 font-black ${compact ? "text-[10px] font-black uppercase tracking-widest text-zinc-500" : "text-lg"}`}>Estatisticas reais</h3><ReadStatus {...state} />{!state.error && state.data[0] && <><Metrics player={state.data[0]} /><p className="mt-2 text-center text-[10px] text-zinc-500">Jogos = partidas jogadas, nao rodadas.</p></>}</section>;
}
