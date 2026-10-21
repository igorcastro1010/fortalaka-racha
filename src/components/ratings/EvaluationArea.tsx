"use client";

import { useState } from "react";
import { isOrganizer, type Profile } from "@/lib/auth/roles";
import { useCurrentRound } from "@/components/rounds/useCurrentRound";
import { RoundLoadStatus, RoundSummary } from "@/components/rounds/RoundSummary";
import { EvaluationAdminPanel } from "./EvaluationAdminPanel";
import { EvaluationScreen } from "./EvaluationScreen";

export function EvaluationArea({ profile }: { profile: Profile }) {
  const { round, loading, error, retry } = useCurrentRound();
  const [evaluating, setEvaluating] = useState(false);
  const organizer = isOrganizer(profile) && profile.active;

  return <section className="space-y-3.5">
    <div><h2 className="text-[29px] font-black leading-tight">Avaliação</h2><p className="mt-1 text-sm font-bold text-zinc-600">Notas pós-jogo do seu time</p></div>
    <RoundLoadStatus loading={loading} error={error} empty={!round} retry={retry} />
    {!loading && !error && round && <>
      {!evaluating && <RoundSummary round={round} />}
      {!evaluating && <EvaluationAdminPanel key={round.roundId} roundId={round.roundId} roundStatus={round.status} organizer={organizer} onOpenEvaluate={() => setEvaluating(true)} />}
      {organizer && !evaluating && <button onClick={() => setEvaluating(true)} className="min-h-12 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-black">Ver minhas avaliações</button>}
      {evaluating && <>
        <button onClick={() => setEvaluating(false)} className="min-h-11 rounded-xl px-3 text-sm font-bold text-red-700">← Voltar à avaliação</button>
        <EvaluationScreen key={round.roundId} roundId={round.roundId} />
      </>}
    </>}
  </section>;
}
