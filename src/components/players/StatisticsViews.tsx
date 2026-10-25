"use client";

import { useCallback, useEffect, useState } from "react";
import { getPlayerStatistics, type PlayerStatistics } from "@/lib/matches/repository";
import { PlayerIdentity } from "@/components/players/PlayerIdentity";
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
    catch (e) { console.error("Estatísticas", e); setError("Não foi possível carregar as estatísticas. Tente novamente."); }
    finally { setLoading(false); }
  }, [playerId]);
  useEffect(() => {
    let active = true;
    const read = async () => {
      try {
        const rows = await getPlayerStatistics(playerId);
        if (active) { setData(rows); setError(""); }
      } catch (e) {
        console.error("Estatísticas", e);
        if (active) setError("Não foi possível carregar as estatísticas. Tente novamente.");
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
  ].map(([label, value]) => <div key={label} className="px-1"><dd className="text-base font-bold tabular-nums text-zinc-800">{value}</dd><dt className="mt-1 text-xs font-semibold text-zinc-600">{label}</dt></div>)}</dl>;
}

function ReadStatus({ loading, error, reload }: { loading: boolean; error: string; reload: () => void }) {
  return <>{loading && <LoadingCards label="Carregando estatisticas..." />}{error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700"><p>{error}</p><button onClick={reload} className="mt-2 min-h-11 font-bold underline">Tentar novamente</button></div>}</>;
}

export function RankingScreen({ sort, onSortChange }: { sort: RankingSort; onSortChange: (sort: RankingSort) => void }) {
  const state = useStatistics();
  const ranking = sortRanking(state.data, sort);
  const activeLabel = rankingOptions.find(option => option.id === sort)!.label;
  return <section aria-label="Ranking dos jogadores" className="min-w-0 space-y-3"><div><h2 className="text-[29px] font-black leading-tight">Ranking</h2><p className="mt-0.5 text-sm text-zinc-600">{sort === "geral" ? "Classificação por overall — maior nota primeiro" : `${activeLabel} — maior valor primeiro`}</p></div>
    <div role="group" aria-label="Ordenação do ranking" className="flex w-full min-w-0 gap-2 overflow-x-auto pb-2">
      {rankingOptions.map(option => <button key={option.id} type="button" aria-pressed={sort === option.id} onClick={() => onSortChange(option.id)} className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${sort === option.id ? "border-red-700 text-red-700" : "border-transparent text-zinc-600 hover:bg-zinc-50"}`}>{option.label}</button>)}
    </div>
    <ReadStatus {...state} />
    {!state.error && !state.loading && !state.data.length && <EmptyState icon={Trophy} title="O ranking começa em campo" description="O desempenho dos jogadores aparece aqui depois das partidas." />}
    {!state.error && ranking.map((player, index) => {
      const metric = rankingMetric(player, sort);
      return <article key={player.jogador_id} className="min-w-0 border-b border-zinc-200 py-3">
      <div className="flex items-center gap-2.5"><span className={`flex h-9 w-7 shrink-0 items-center justify-center border-l-2 text-sm font-black tabular-nums ${index === 0 ? "border-red-700 text-red-700" : index < 3 ? "border-zinc-400 text-neutral-950" : "border-transparent text-zinc-500"}`} aria-label={`${index + 1}º lugar${index < 3 ? ", Top 3" : ""}`}>{index + 1}º</span><PlayerIdentity playerId={player.jogador_id} name={player.nome} avatarUrl={player.avatar_url} size="sm" nameTag="h3" className="flex-1 text-sm font-bold" /><span aria-label={metric.value == null ? "Nota media ainda nao disponivel" : sort === "geral" || sort === "nota" ? `Nota media ${metric.value}` : `${metric.value} ${metric.label}`} className={`min-w-20 shrink-0 text-right ${metric.value == null ? "text-zinc-500" : "text-neutral-950"}`}><strong className="block text-2xl font-black tabular-nums">{metric.value ?? "--"}</strong><span className="block whitespace-nowrap text-xs font-semibold text-zinc-600">{metric.label}</span></span></div>
      <details className="mt-1"><summary aria-label={`Estatísticas de ${player.nome}`} className="min-h-11 cursor-pointer content-center text-xs font-semibold text-zinc-600 focus-visible:outline-2 focus-visible:outline-red-700">Estatísticas</summary><div className="pb-2"><Metrics player={player} /></div></details>
      {player.quantidade_avaliacoes === 1 && <p className="mt-2 text-center text-[11px] font-semibold text-zinc-500">Nota oculta ate receber 2 avaliacoes.</p>}
    </article>; })}
  </section>;
}

export function PlayerStatisticsCard({ playerId, compact = false }: { playerId: string; compact?: boolean }) {
  const state = useStatistics(playerId);
  return <section className={`fk-section min-w-0 bg-white py-4 text-neutral-950 ${compact ? "px-3" : "border-t border-zinc-200"}`}><h3 className={`mb-4 font-bold ${compact ? "text-xs text-zinc-600" : "text-lg"}`}>Estatisticas reais</h3><ReadStatus {...state} />{!state.error && state.data[0] && <><Metrics player={state.data[0]} /><p className="mt-3 text-center text-xs text-zinc-600">Jogos = partidas jogadas, nao rodadas.</p></>}</section>;
}
