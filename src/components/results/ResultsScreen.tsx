"use client";

import { useCallback, useState } from "react";
import { isOrganizer, type Profile } from "@/lib/auth/roles";
import { RankingScreen } from "@/components/players/StatisticsViews";
import { MatchesPanel } from "@/components/rounds/MatchesPanel";
import { RoundLoadStatus, RoundSummary } from "@/components/rounds/RoundSummary";
import { useCurrentRound } from "@/components/rounds/useCurrentRound";
import type { RankingSort } from "@/lib/players/ranking";
import { ViewTabs } from "@/components/ui/ViewTabs";

export function ResultsScreen({ profile }: { profile: Profile }) {
  const [view, setView] = useState<"matches" | "ranking">("matches");
  const [rankingVisited, setRankingVisited] = useState(false);
  const [rankingSort, setRankingSort] = useState<RankingSort>("geral");
  const [startedRound, setStartedRound] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const onRoundStarted = useCallback((id: string) => setStartedRound(id), []);
  const { round, loading, error, retry } = useCurrentRound();

  return <section className="space-y-3.5">
    <div><h2 className="text-[29px] font-black leading-tight">Resultados</h2><p className="mt-1 text-sm font-bold text-zinc-600">Partidas, placares e desempenho</p></div>
    <ViewTabs label="Áreas de Resultados" value={view} onChange={next => { setView(next); if (next === "ranking") setRankingVisited(true); }} items={[{ id: "matches", label: "Partidas" }, { id: "ranking", label: "Ranking" }]} />
    {rankingVisited && <div hidden={view !== "ranking"}><RankingScreen sort={rankingSort} onSortChange={setRankingSort} /></div>}
    <div hidden={view !== "matches"} className="space-y-4">
      <RoundLoadStatus loading={loading} error={error} empty={!round} retry={retry} />
      {!loading && !error && round && <>
        {!historyOpen && <RoundSummary round={round.status === "times_confirmados" && startedRound === round.roundId ? { ...round, status: "em_andamento" } : round} />}
        <MatchesPanel key={round.roundId} roundId={round.roundId} roundStatus={round.status} roundDate={round.date} onRoundStarted={onRoundStarted} onHistoryViewChange={setHistoryOpen} organizer={isOrganizer(profile) && profile.active} />
      </>}
    </div>
  </section>;
}
