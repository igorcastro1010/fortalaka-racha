"use client";

import { useState } from "react";
import { isOrganizer, type Profile } from "@/lib/auth/roles";
import { useCurrentRound } from "@/components/rounds/useCurrentRound";
import { RoundLoadStatus, RoundSummary } from "@/components/rounds/RoundSummary";
import { EvaluationAdminPanel } from "./EvaluationAdminPanel";
import { EvaluationScreen } from "./EvaluationScreen";
import { ViewTabs } from "@/components/ui/ViewTabs";
import type { EvaluationState } from "@/lib/ratings/repository";

export function EvaluationArea({ profile }: { profile: Profile }) {
  const { round, loading, error, retry } = useCurrentRound();
  const [view, setView] = useState<"avaliar" | "progresso">(isOrganizer(profile) && profile.active ? "progresso" : "avaliar");
  const [revision, setRevision] = useState(0);
  const [personal, setPersonal] = useState<EvaluationState | null>(null);
  const [readStatus, setReadStatus] = useState({ loading: true, error: "" });
  const organizer = isOrganizer(profile) && profile.active;

  return <section className="min-w-0 space-y-5">
    <div><h2 className="text-[29px] font-black leading-tight">Avaliação</h2><p className="mt-1 text-sm font-bold text-zinc-600">Notas pós-jogo do seu time</p></div>
    <RoundLoadStatus loading={loading} error={error} empty={!round} retry={retry} />
    {!loading && !error && round && <>
      <ViewTabs label="Visualização das avaliações" value={view} onChange={setView} items={[{ id: "avaliar", label: "Avaliar" }, { id: "progresso", label: "Progresso" }]} />
      <div hidden={view !== "avaliar"}>
        <EvaluationScreen key={round.roundId} roundId={round.roundId} refreshToken={revision} onStateChange={setPersonal} onReadStatusChange={setReadStatus} />
      </div>
      <div hidden={view !== "progresso"} className="space-y-5">
        <details className="border-b border-zinc-200 pb-4"><summary className="min-h-11 cursor-pointer content-center text-sm font-bold focus-visible:outline-2 focus-visible:outline-red-600">Resumo da rodada</summary><div className="pt-3"><RoundSummary round={round} /></div></details>
        <EvaluationAdminPanel key={round.roundId} roundId={round.roundId} roundStatus={round.status} organizer={organizer} personalState={personal} personalLoading={readStatus.loading} personalError={readStatus.error} onOpenEvaluate={() => setView("avaliar")} onUpdated={() => setRevision(value => value + 1)} />
        {organizer && <button onClick={() => setView("avaliar")} className="fk-secondary min-h-12 w-full rounded-lg border border-zinc-300 px-3 text-sm font-bold">Ver minhas avaliações</button>}
      </div>
    </>}
  </section>;
}
