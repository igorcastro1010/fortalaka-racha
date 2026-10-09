"use client";

import { useCallback, useState } from "react";
import { isOrganizer, type Profile } from "@/lib/auth/roles";
import { RankingScreen } from "@/components/players/StatisticsViews";
import { MatchesPanel } from "@/components/rounds/MatchesPanel";
import { RoundLoadStatus, RoundSummary } from "@/components/rounds/RoundSummary";
import { useCurrentRound } from "@/components/rounds/useCurrentRound";

export function ResultsScreen({ profile }: { profile: Profile }) {
  const [view, setView] = useState<"matches" | "ranking">("matches");
  const [startedRound, setStartedRound] = useState<string | null>(null);
  const onRoundStarted = useCallback((id: string) => setStartedRound(id), []);
  const { round, loading, error, retry } = useCurrentRound();

  return <section className="space-y-3.5">
    <div><h2 className="text-[29px] font-black leading-tight">Resultados</h2><p className="mt-1 text-sm font-bold text-zinc-600">Partidas, placares e desempenho</p></div>
    <nav aria-label="Áreas de Resultados" className="grid grid-cols-2 gap-2 rounded-[16px] bg-zinc-200/60 p-1">
      {([{ id: "matches", label: "Partidas" }, { id: "ranking", label: "Ranking" }] as const).map(tab => <button key={tab.id} aria-current={view === tab.id ? "page" : undefined} onClick={() => setView(tab.id)} className={`min-h-11 rounded-xl text-sm font-black ${view === tab.id ? "bg-neutral-950 text-white shadow-sm" : "text-zinc-600"}`}>{tab.label}</button>)}
    </nav>
    {view === "ranking" ? <RankingScreen /> : <>
      <RoundLoadStatus loading={loading} error={error} empty={!round} retry={retry} />
      {!loading && !error && round && <>
        <RoundSummary round={round.status === "times_confirmados" && startedRound === round.roundId ? { ...round, status: "em_andamento" } : round} />
        <MatchesPanel key={round.roundId} roundId={round.roundId} roundStatus={round.status} onRoundStarted={onRoundStarted} organizer={isOrganizer(profile) && profile.active} />
      </>}
    </>}
  </section>;
}
