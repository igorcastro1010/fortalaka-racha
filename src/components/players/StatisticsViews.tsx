"use client";

import { useCallback, useEffect, useState } from "react";
import { getPlayerStatistics, type PlayerStatistics } from "@/lib/matches/repository";
import { PlayerAvatar } from "./PlayerAvatar";

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
  return <>{loading && <p role="status" className="text-sm text-zinc-600">Carregando estatisticas...</p>}{error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700"><p>{error}</p><button onClick={reload} className="mt-2 min-h-10 font-bold underline">Tentar novamente</button></div>}</>;
}

export function RankingScreen() {
  const state = useStatistics();
  return <section className="space-y-3"><div><h2 className="text-[29px] font-black leading-tight">Ranking</h2><p className="mt-0.5 text-sm font-bold text-zinc-600">Classificacao por vitorias - partidas finalizadas</p></div>
    <ReadStatus {...state} />
    {!state.error && !state.loading && !state.data.length && <p className="rounded-xl bg-white p-4 text-sm text-zinc-600">Nenhum jogador cadastrado.</p>}
    {!state.error && state.data.map((player, index) => <article key={player.jogador_id} className={`rounded-[20px] border bg-white p-3.5 shadow-sm ${index === 0 ? "border-red-200 border-l-[3px] border-l-red-600" : index < 3 ? "border-zinc-200 border-l-[3px] border-l-zinc-500" : "border-zinc-200"}`}>
      <div className="flex items-center gap-2.5"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${index === 0 ? "bg-red-600 text-white" : "bg-zinc-100 text-zinc-800"}`}>{index + 1}</span><PlayerAvatar name={player.nome} avatarUrl={player.avatar_url} size="sm" /><h3 className="min-w-0 flex-1 break-words text-base font-black">{player.nome}</h3><span aria-label={player.nota_geral_100 == null ? "Nota media ainda nao disponivel" : `Nota media ${player.nota_geral_100}`} className={`rounded-xl px-2 py-1 text-xl font-bold ${player.nota_geral_100 == null ? "bg-zinc-50 text-zinc-400" : "bg-red-50 text-red-700"}`}>{player.nota_geral_100 ?? "--"}</span></div>
      <div className="mt-3 border-t border-zinc-100 pt-2.5"><Metrics player={player} /></div>
      {player.quantidade_avaliacoes === 1 && <p className="mt-2 text-center text-[11px] font-semibold text-zinc-500">Nota oculta ate receber 2 avaliacoes.</p>}
    </article>)}
  </section>;
}

export function PlayerStatisticsCard({ playerId }: { playerId: string }) {
  const state = useStatistics(playerId);
  return <section className="rounded-[22px] bg-white p-4 ring-1 ring-black/5"><h3 className="mb-3 text-lg font-black">Estatisticas reais</h3><ReadStatus {...state} />{!state.error && state.data[0] && <><Metrics player={state.data[0]} /><p className="mt-3 text-center text-[11px] text-zinc-500">Jogos = partidas jogadas, nao rodadas.</p></>}</section>;
}
