"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlayerAvatar } from "./PlayerAvatar";
import { getPlayerStatistics, type PlayerStatistics } from "@/lib/matches/repository";
import { createClient } from "@/lib/supabase/client";
import { attributes, type RatingSummary } from "@/lib/ratings/summary";
import { comparisonMetrics } from "@/lib/players/comparison";

const format = (value: number | null) => value == null ? "--" : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function PlayerComparison({ initialA = "", initialB = "", viewerId, organizer = false }: { initialA?: string; initialB?: string; viewerId: string; organizer?: boolean }) {
  const [players, setPlayers] = useState<PlayerStatistics[]>([]);
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialA === initialB ? "" : initialB);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [ratings, setRatings] = useState<{ a: string; b: string; values: (RatingSummary | null)[]; error: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    getPlayerStatistics().then(data => { if (active) { setPlayers(data); setError(""); } })
      .catch(() => { if (active) setError("Não foi possível carregar jogadores. Tente novamente."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    let active = true;
    const client = createClient();
    Promise.all([a, b].map(async id => {
      if (!id || (!organizer && id !== viewerId) || !players.some(p => p.jogador_id === id)) return null;
      const { data, error } = await client.rpc("medias_jogador", { p_jogador: id });
      if (error) throw error;
      const row = data?.[0] as RatingSummary | undefined;
      return row && row.quantidade >= 2 ? row : null;
    })).then(values => { if (active) setRatings({ a, b, values, error: false }); })
      .catch(() => { if (active) setRatings({ a, b, values: [null, null], error: true }); });
    return () => { active = false; };
  }, [a, b, players, viewerId, organizer]);
  const playerA = players.find(p => p.jogador_id === a) ?? null;
  const playerB = players.find(p => p.jogador_id === b) ?? null;
  const current = ratings?.a === a && ratings?.b === b ? ratings : null;
  function select(side: "a" | "b", value: string) {
    if (side === "a") setA(value); else setB(value);
    const url = new URL(window.location.href);
    url.searchParams.set("jogadorA", side === "a" ? value : a);
    url.searchParams.set("jogadorB", side === "b" ? value : b);
    window.history.replaceState(null, "", url);
  }
  const rows = [...comparisonMetrics(playerA, playerB), ...attributes.map(({ key, label }) => ({
    label: `${label} /10`, a: current?.values[0]?.[key] ?? null, b: current?.values[1]?.[key] ?? null,
  }))];
  return <section aria-label="Comparar jogadores" className="space-y-4">
    <header><Link href="/?tab=results" className="inline-flex min-h-11 items-center text-sm font-bold text-red-700">← Voltar ao app</Link><h1 className="text-3xl font-black tracking-tight">Comparar jogadores</h1><p className="mt-2 text-sm text-zinc-600">Dois estilos em campo. Estatísticas e médias públicas.</p></header>
    {loading && <p role="status">Carregando jogadores...</p>}
    {error && <div role="alert"><p>{error}</p><button onClick={() => setAttempt(n => n + 1)} className="min-h-11 font-bold underline">Tentar novamente</button></div>}
    {!loading && !error && !players.length && <p>A comparação ficará disponível quando houver jogadores nas estatísticas.</p>}
    <div className="grid grid-cols-2 gap-3">{([{ side: "a", value: a, other: b, player: playerA }, { side: "b", value: b, other: a, player: playerB }] as const).map(({ side, value, other, player }) => <div key={side} className="min-w-0 rounded-2xl bg-white p-3 ring-1 ring-black/5">
      <label htmlFor={`player-${side}`} className="text-xs font-black uppercase">Jogador {side.toUpperCase()}</label>
      <select id={`player-${side}`} value={value} onChange={event => select(side, event.target.value)} className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-zinc-300 bg-white px-2 text-sm"><option value="">Selecionar</option>{players.filter(p => p.jogador_id !== other).map(p => <option key={p.jogador_id} value={p.jogador_id}>{p.nome}</option>)}</select>
      {player && <div className="mt-3 space-y-2"><PlayerAvatar name={player.nome} avatarUrl={player.avatar_url} /><p className="break-words text-sm font-black">{player.nome}</p></div>}
    </div>)}</div>
    {!loading && !error && ((a && !playerA) || (b && !playerB)) && <p role="status" className="text-sm text-zinc-600">Um dos jogadores não está disponível. Selecione outro jogador.</p>}
    <div className="overflow-hidden rounded-2xl bg-white p-4 ring-1 ring-black/5"><p className="mb-3 text-xs text-zinc-600">A à esquerda · B à direita. Maior valor em destaque.</p><dl className="divide-y divide-zinc-100">{rows.map(row => <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)_minmax(0,1fr)] items-center gap-2 py-3 text-center"><dd className={`font-black tabular-nums ${row.a != null && row.b != null && row.a > row.b ? "text-red-700" : ""}`}>{format(row.a)}</dd><dt className="text-xs font-bold text-zinc-600">{row.label}</dt><dd className={`font-black tabular-nums ${row.a != null && row.b != null && row.b > row.a ? "text-red-700" : ""}`}>{format(row.b)}</dd></div>)}</dl></div>
    {current?.error && <p role="status" className="text-sm text-zinc-600">Médias indisponíveis no momento. As estatísticas continuam disponíveis.</p>}
    <p className="text-xs leading-relaxed text-zinc-600">Jogos são partidas finalizadas. Overall e atributos exigem pelo menos duas avaliações. Os atributos seguem a permissão atual do perfil: próprios ou para organizadores. Uma métrica isolada não define o melhor jogador.</p>
  </section>;
}
