"use client";

import { useCallback, useEffect, useState } from "react";
import { getPlayerStatistics, type PlayerStatistics } from "@/lib/matches/repository";
import { PlayerAvatar } from "./PlayerAvatar";
import { Trophy } from "lucide-react";
import { EmptyState, LoadingCards } from "@/components/ui/ScreenState";

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
  ].map(([label, value]) => <div key={label} className="px-1"><dd className="text-base font-bold tabular-nums text-zinc-800">{value}</dd><dt className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-zinc-600">{label}</dt></div>)}</dl>;
}

function ReadStatus({ loading, error, reload }: { loading: boolean; error: string; reload: () => void }) {
  return <>{loading && <LoadingCards label="Carregando estatisticas..." />}{error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700"><p>{error}</p><button onClick={reload} className="mt-2 min-h-11 font-bold underline">Tentar novamente</button></div>}</>;
}

export function RankingScreen() {
  const state = useStatistics();
  const ranking = [...state.data].sort((a, b) =>
    (b.nota_geral_100 ?? -1) - (a.nota_geral_100 ?? -1)
    || a.nome.localeCompare(b.nome, "pt-BR")
    || a.jogador_id.localeCompare(b.jogador_id)
  );
  return <section className="space-y-3"><div><h2 className="text-[29px] font-black leading-tight">Ranking</h2><p className="mt-0.5 text-sm font-bold text-zinc-600">Classificação por overall — maior nota primeiro</p></div>
    <ReadStatus {...state} />
    {!state.error && !state.loading && !state.data.length && <EmptyState icon={Trophy} title="O ranking começa em campo" description="O desempenho dos jogadores aparece aqui depois das partidas." />}
    {!state.error && ranking.map((player, index) => <article key={player.jogador_id} className={`rounded-[20px] border bg-white p-3 shadow-sm ${index === 0 ? "border-red-200 border-l-[3px] border-l-red-600" : index < 3 ? "border-zinc-200 border-l-[3px] border-l-zinc-500" : "border-zinc-200"}`}>
      <div className="flex items-center gap-2.5"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${index === 0 ? "bg-red-600 text-white" : "bg-zinc-100 text-zinc-800"}`} aria-label={`${index + 1}º lugar${index < 3 ? ", Top 3" : ""}`}>{index + 1}º</span><PlayerAvatar name={player.nome} avatarUrl={player.avatar_url} size="sm" /><h3 className="min-w-0 flex-1 break-words text-base font-black">{player.nome}</h3><span aria-label={player.nota_geral_100 == null ? "Nota media ainda nao disponivel" : `Nota media ${player.nota_geral_100}`} className={`rounded-xl px-2 py-1 text-xl font-bold ${player.nota_geral_100 == null ? "bg-zinc-50 text-zinc-400" : "bg-red-50 text-red-700"}`}>{player.nota_geral_100 ?? "--"}</span></div>
      <div className="mt-2 border-t border-zinc-100 pt-2"><Metrics player={player} /></div>
      {player.quantidade_avaliacoes === 1 && <p className="mt-2 text-center text-[11px] font-semibold text-zinc-500">Nota oculta ate receber 2 avaliacoes.</p>}
    </article>)}
  </section>;
}

export function PlayerStatisticsCard({ playerId, compact = false }: { playerId: string; compact?: boolean }) {
  const state = useStatistics(playerId);
  return <section className={`rounded-[18px] bg-white p-3 text-neutral-950 ${compact ? "" : "ring-1 ring-black/5"}`}><h3 className={`mb-3 font-black ${compact ? "text-[10px] uppercase tracking-wider text-zinc-500" : "text-lg"}`}>Estatisticas reais</h3><ReadStatus {...state} />{!state.error && state.data[0] && <><Metrics player={state.data[0]} /><p className="mt-2 text-center text-[10px] text-zinc-500">Jogos = partidas jogadas, nao rodadas.</p></>}</section>;
}
