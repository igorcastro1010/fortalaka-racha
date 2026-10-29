"use client";

import { useEffect, useState } from "react";
import { ArrowRight, RefreshCw, ShieldCheck } from "lucide-react";
import { isOrganizer, type Profile } from "@/lib/auth/roles";
import type { RoundDetails } from "@/lib/rounds/repository";
import type { MatchesState } from "@/lib/matches/repository";
import { getCurrentRoundTeamsState, type RoundTeamsState } from "@/lib/teams/repository";
import { getEvaluationProgress, type EvaluationProgress } from "@/lib/ratings/repository";
import { buildOrganizerOverview, type OrganizerDestination } from "@/lib/rounds/organizer-overview";
import { createClient } from "@/lib/supabase/client";
import { RoundProgress } from "./RoundProgress";

type Props = {
  profile: Profile;
  round: RoundDetails | null;
  loading: boolean;
  matches: MatchesState | null;
  matchesError: string;
  onRefresh: () => void;
  onNavigate: (destination: OrganizerDestination) => void;
};

export function OrganizerPanel(props: Props) {
  if (!isOrganizer(props.profile) || !props.profile.active) return null;
  if (!props.round) return <section aria-label="Painel do Organizador" className="fk-section">
    <h3 className="text-sm font-black uppercase text-neutral-950">Painel do Organizador</h3>
    <p role="status" className="mt-3 text-sm text-zinc-600">{props.loading ? "Carregando rodada..." : "Nenhuma rodada disponível."}</p>
    {!props.loading && <button onClick={() => props.onNavigate("racha")} className="fk-primary mt-3 w-full">CRIAR RODADA</button>}
  </section>;
  return <OrganizerRoundPanel key={props.round.roundId} {...props} round={props.round} />;
}

function dateLabel(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Data a definir";
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "Data a definir";
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(date).replaceAll(".", "").toUpperCase();
}

function OrganizerRoundPanel({ round, matches, matchesError, loading, onRefresh, onNavigate }: Props & { round: RoundDetails }) {
  const [snapshot, setSnapshot] = useState<{ round: RoundDetails; teams: RoundTeamsState | null; evaluations: EvaluationProgress | null; errors: string[] } | null>(null);
  useEffect(() => {
    let active = true;
    // Reaproveita a rodada da Home: não relê participantes, perfis ou avatares.
    Promise.allSettled([getCurrentRoundTeamsState(createClient(), round), getEvaluationProgress(round.roundId)]).then(([teams, evaluations]) => {
      if (!active) return;
      setSnapshot({ round, teams: teams.status === "fulfilled" ? teams.value : null,
        evaluations: evaluations.status === "fulfilled" ? evaluations.value : null,
        errors: [teams.status === "rejected" ? "Não foi possível atualizar os times." : "", evaluations.status === "rejected" ? "Não foi possível atualizar as avaliações." : ""].filter(Boolean) });
    });
    return () => { active = false; };
  }, [round]);
  const data = snapshot?.round === round ? snapshot : null;
  const view = buildOrganizerOverview(round, data?.teams ?? null, matches, data?.evaluations ?? null);
  const errors = [...(data?.errors ?? []), matchesError].filter(Boolean);
  const pending = loading || !data || (!matches && !matchesError);
  const shortcuts = [
    { label: "Lista", destination: "racha" }, { label: "Times", destination: "teams" },
    { label: "Resultados", destination: "results" }, { label: "Avaliações", destination: "evaluate" },
  ] as const;

  return <section aria-label="Painel do Organizador" aria-busy={pending} className="fk-section space-y-4">
    <div className="flex items-center gap-2">
      <ShieldCheck size={20} className="shrink-0 text-red-700" aria-hidden="true" />
      <div className="min-w-0 flex-1"><h3 className="text-sm font-black uppercase">Painel do Organizador</h3><p className="mt-1 text-xs text-zinc-600">{dateLabel(round.date)}</p></div>
      <button onClick={onRefresh} disabled={pending} aria-label="Atualizar painel" title="Atualizar painel" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 disabled:opacity-40"><RefreshCw size={18} aria-hidden="true" /></button>
    </div>
    <p role="status" className="border-l-2 border-red-700 py-1 pl-3 text-sm font-semibold">{view.alert}</p>
    {pending && <p className="text-xs text-zinc-600">Atualizando indicadores...</p>}
    {errors.length > 0 && <p role="alert" className="text-sm text-red-700">{errors.join(" ")} Use Atualizar painel para tentar novamente.</p>}
    <p className="text-xs font-bold text-zinc-600">Próxima ação</p>
    <button onClick={() => onNavigate(view.primary.destination)} className="fk-primary w-full">{view.primary.label}<ArrowRight size={18} aria-hidden="true" /></button>
    <RoundProgress status={round.status} evaluationsCompleted={view.evaluationsCompleted} />
    <details className="border-b border-zinc-200 pb-2">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-bold">Detalhes da organização</summary>
      <div className="space-y-4 pt-3">
      <dl aria-label="Indicadores da rodada" className="grid grid-cols-2 gap-4">{[
        ["Participantes", String(view.confirmed)], ["Times", view.teamCount === null ? "—" : String(view.teamCount)],
        ["Partidas", view.matchCount === null ? "—" : String(view.matchCount)], ["Avaliações", view.evaluationStatus ?? "—"],
      ].map(([label, value]) => <div key={label} className="min-w-0 border-l-2 border-zinc-200 pl-3"><dt className="text-xs text-zinc-600">{label}</dt><dd className={`mt-1 break-words font-black tabular-nums ${label === "Avaliações" ? "text-sm" : "text-2xl"}`}>{value}</dd></div>)}</dl>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-zinc-600"><span>LISTA {view.listStatus}</span><span>TIMES {view.teamsStatus ?? "—"}</span><span>RACHA {view.rachaStatus}</span></div>
      {(view.substitutes > 0 || view.absent > 0) && <p className="text-xs text-zinc-600">{view.substitutes} {view.substitutes === 1 ? "suplente" : "suplentes"} · {view.absent} {view.absent === 1 ? "ausente" : "ausentes"}</p>}
      {view.finalized !== null && <p className="text-xs font-bold text-zinc-500">{view.finalized} {view.finalized === 1 ? "partida finalizada" : "partidas finalizadas"}{data?.evaluations && ` · ${data.evaluations.respondentes} de ${data.evaluations.total} jogadores responderam`}</p>}
      {view.currentMatch && <p className="break-words border-l-2 border-red-700 py-2 pl-3 text-center text-sm font-bold"><span className="mb-1 block text-xs text-red-700">EM CAMPO</span>{view.currentMatch.timeA} {view.currentMatch.placarA} × {view.currentMatch.placarB} {view.currentMatch.timeB}</p>}
      {view.waiting.length > 0 && <p className="break-words text-xs text-zinc-600">{round.status === "finalizado" ? "Fila preservada" : "Fila"}: {view.waiting.join(" → ")}</p>}
      <nav aria-label="Atalhos do organizador" className="grid grid-cols-2 gap-2">{shortcuts.map(link => <button key={link.destination} onClick={() => onNavigate(link.destination)} className="fk-secondary">{link.label}</button>)}</nav>
      </div>
    </details>
  </section>;
}
