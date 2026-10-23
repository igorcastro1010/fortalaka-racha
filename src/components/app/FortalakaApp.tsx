"use client";

import {
  CalendarDays,
  ClipboardList,
  Clock3,
  Home,
  MapPin,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/LogoMark";
import { RachaScreen } from "@/components/rounds/RachaScreen";
import { TeamsScreen } from "@/components/teams/TeamsScreen";
import { PlayerPerformance } from "@/components/players/PlayerPerformance";
import { ProfilePhoto } from "@/components/players/ProfilePhoto";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { PlayerStatisticsCard } from "@/components/players/StatisticsViews";
import { EvaluationArea } from "@/components/ratings/EvaluationArea";
import { ResultsScreen } from "@/components/results/ResultsScreen";
import { useCurrentRound } from "@/components/rounds/useCurrentRound";
import { RoundLoadStatus } from "@/components/rounds/RoundSummary";
import { getRoundMatches, type MatchesState } from "@/lib/matches/repository";
import { RoundProgress } from "@/components/rounds/RoundProgress";
import { OrganizerPanel } from "@/components/rounds/OrganizerPanel";
import { getRoundParticipantCounts } from "@/lib/rounds/organizer-overview";
import type { RoundDetails } from "@/lib/rounds/repository";
import { OwnRegistration } from "@/components/rounds/OwnRegistration";
import { isOrganizer, type Profile } from "@/lib/auth/roles";
import { getEvaluationState, type EvaluationState } from "@/lib/ratings/repository";
import { createClient } from "@/lib/supabase/client";

type Tab = "home" | "racha" | "teams" | "evaluate" | "results" | "profile";

const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Início", icon: Home },
  { id: "racha", label: "Racha", icon: ClipboardList },
  { id: "teams", label: "Times", icon: Users },
  { id: "evaluate", label: "Avaliação", icon: Star },
  { id: "results", label: "Resultados", icon: Trophy },
];

export function FortalakaApp({ profile }: { profile: Profile }) {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  function navigate(tab: Tab) {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-950">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f3f3f4] shadow-2xl shadow-black/35">
        <div className="min-h-screen px-4 pb-[calc(104px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))]">
          {activeTab !== "home" && <AppHeader profile={profile} onOpenProfile={() => navigate("profile")} />}
          {activeTab === "home" && <HomeScreen profile={profile} onOpenProfile={() => navigate("profile")} onOpenRacha={() => navigate("racha")} onOpenEvaluate={() => navigate("evaluate")} onOpenResults={() => navigate("results")} onOpenTeams={() => navigate("teams")} />}
          {activeTab === "racha" && <RachaScreen profile={profile} onOpenResults={() => navigate("results")} />}
          {activeTab === "teams" && <TeamsScreen profile={profile} />}
          {activeTab === "results" && <ResultsScreen profile={profile} />}
          {activeTab === "profile" && <ProfileScreen profile={profile} />}
          {activeTab === "evaluate" && <EvaluationArea profile={profile} />}
        </div>
        <BottomNav activeTab={activeTab} onChange={navigate} />
      </div>
    </main>
  );
}

function AppHeader({ profile, onOpenProfile }: { profile: Profile; onOpenProfile: () => void }) {
  return (
    <header className="mb-4 flex min-h-14 items-center justify-between gap-3 border-b border-black/5 pb-3">
      <div className="flex items-center gap-3">
        <LogoMark size="header" />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-600">Racha</p>
          <h1 className="text-[23px] font-black uppercase leading-none tracking-normal">Fortalaka</h1>
        </div>
      </div>
      <ProfileButton profile={profile} onClick={onOpenProfile} />
    </header>
  );
}

function ProfileButton({ profile, onClick }: { profile: Profile; onClick: () => void }) {
  return <button onClick={onClick} aria-label="Abrir meu perfil" className="shrink-0 rounded-full p-1 ring-1 ring-black/5 focus-visible:outline-2 focus-visible:outline-red-600"><PlayerAvatar name={profile.name} avatarUrl={profile.avatar_url} /></button>;
}

function HomeScreen({ profile, onOpenRacha, onOpenEvaluate, onOpenResults, onOpenTeams, onOpenProfile }: { profile: Profile; onOpenRacha: () => void; onOpenEvaluate: () => void; onOpenResults: () => void; onOpenTeams: () => void; onOpenProfile: () => void }) {
  const { round, loading, error, retry } = useCurrentRound();
  const [matches, setMatches] = useState<{ roundId: string; roundStatus: RoundDetails["status"]; revision: RoundDetails | null; data: MatchesState | null; error: string } | null>(null);
  const organizer = isOrganizer(profile) && profile.active;
  const roundId = round?.roundId;
  const roundStatus = round?.status;
  // Atualizações de inscrição do jogador não precisam reler partidas.
  const matchesRevision = organizer ? round : null;
  useEffect(() => {
    if (!roundId || !roundStatus) return;
    let active = true;
    getRoundMatches(roundId).then(data => {
      if (data.roundStatus && data.roundStatus !== roundStatus) throw new Error("A rodada mudou durante a consulta. Atualize o painel.");
      if (active) setMatches({ roundId, roundStatus, revision: matchesRevision, data, error: "" });
    }).catch(() => { if (active) setMatches({ roundId, roundStatus, revision: matchesRevision, data: null, error: "Não foi possível atualizar as partidas." }); });
    return () => { active = false; };
  }, [roundId, roundStatus, matchesRevision]);
  const currentMatches = matches?.roundId === roundId && matches?.roundStatus === roundStatus && matches?.revision === matchesRevision ? matches : null;
  const counts = getRoundParticipantCounts(round?.participants ?? []);
  const displayName = getDisplayName(profile);
  const firstName = getFirstName(displayName);

  return <section className="space-y-4">
    <AppHeader profile={profile} onOpenProfile={onOpenProfile} />
    <div className="space-y-1"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Olá, {firstName}</p><h2 className="text-[32px] font-black leading-[0.9] tracking-tighter text-neutral-950">Seu próximo jogo.</h2></div>
    <RoundLoadStatus loading={loading && !round} error={error} empty={!round} retry={retry} />
    {organizer && !error && <OrganizerPanel profile={profile} round={round} loading={loading}
      matches={currentMatches?.data ?? null} matchesError={currentMatches?.error ?? ""} onRefresh={retry}
      onNavigate={destination => ({ racha: onOpenRacha, teams: onOpenTeams, results: onOpenResults, evaluate: onOpenEvaluate })[destination]()} />}
    {!error && round && <>
      <Card className="overflow-hidden !p-0">
        <div className="bg-neutral-950 p-4 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Próximo Racha</p>
          <h3 className="mt-1 break-words text-[23px] font-black leading-tight">{round.roundName}</h3>
          <span className="mt-3 inline-flex rounded-full bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-sm">{{aberto: "Lista aberta", lista_fechada: "Lista fechada", times_confirmados: "Times confirmados", em_andamento: "Em andamento", finalizado: "RODADA FINALIZADA"}[round.status]}</span>
        </div>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            <InfoBlock icon={CalendarDays} label="Data" value={round.date ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${round.date}T12:00:00Z`)) : "A definir"} />
            <InfoBlock icon={Clock3} label="Horário" value={round.time?.slice(0, 5) ?? "A definir"} />
          </div>
          <p className="flex items-start gap-2 text-xs font-medium leading-relaxed text-zinc-600"><MapPin size={16} className="mt-0.5 shrink-0" /><span className="min-w-0 break-words">{round.address ?? "Endereço a definir"}</span></p>
          <div className="flex flex-wrap items-baseline gap-x-2 rounded-2xl bg-zinc-100/50 px-4 py-3"><span className="text-3xl font-black tabular-nums text-red-600">{counts.confirmed}</span><span className="text-xs font-bold text-zinc-700">participantes</span><span className="ml-auto text-xs text-zinc-600">{counts.substitutes} suplentes</span></div>
          <OwnRegistration key={round.roundId} compact round={round} profile={profile} onUpdated={retry} />
          <button onClick={onOpenRacha} className="min-h-12 w-full rounded-2xl bg-neutral-950 text-xs font-black uppercase text-white transition active:scale-95">Ver racha</button>
        </div>
      </Card>
      {!organizer && <RoundProgress status={round.status} />}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onOpenTeams} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-xs font-black ring-1 ring-black/[0.03] shadow-sm transition active:scale-95"><Users size={16} />VER TIMES</button>
        <button onClick={onOpenResults} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-xs font-black ring-1 ring-black/5"><Trophy size={16} />VER RESULTADOS</button>
      </div>
      {currentMatches?.data && currentMatches.data.partidas.length > 0 && <p className="text-center text-xs text-zinc-600">{currentMatches.data.partidas.length} partidas na rodada</p>}
    </>}
    {!organizer && <HomeEvaluationCard onOpenEvaluate={onOpenEvaluate} />}
  </section>;
}

function HomeEvaluationCard({ onOpenEvaluate }: { onOpenEvaluate: () => void }) {
  const [state, setState] = useState<EvaluationState | null>(null);

  useEffect(() => {
    let active = true;
    getEvaluationState().then(data => {
      if (active) setState(data);
    }).catch(() => {
      if (active) setState(null);
    });
    return () => { active = false; };
  }, []);

  if (!state?.open) return null;

  return <button onClick={onOpenEvaluate} className="flex w-full items-center gap-3 rounded-2xl bg-neutral-950 p-5 text-left text-white shadow-lg transition active:scale-[0.98]">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-red-600 text-white">
      <Star size={21} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-black">AVALIAR MEU TIME</p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-300">{state.canEvaluate ? "Avalie seus companheiros de time." : "Confira a rodada de avaliacoes."}</p>
    </div>
  </button>;
}

function InfoBlock({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-zinc-100 bg-white px-3 py-3 shadow-sm ring-1 ring-black/[0.02]">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white ring-1 ring-red-600">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{label}</p>
        <p className="mt-0.5 whitespace-nowrap text-[14px] font-black tabular-nums text-neutral-950">{value}</p>
      </div>
    </div>
  );
}

function ProfileScreen({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <PlayerPerformance profile={profile}><PlayerStatisticsCard playerId={profile.id} compact /></PlayerPerformance>
      <ProfilePhoto profile={profile} />

      <button
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="h-12 w-full rounded-2xl border border-red-100 bg-white text-xs font-black uppercase tracking-wider text-red-600 shadow-sm transition hover:bg-red-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSigningOut ? "Saindo..." : "Sair da conta"}
      </button>
    </section>
  );
}

function BottomNav({ activeTab, onChange }: { activeTab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[430px] border-t border-zinc-200 bg-white/[0.96] px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-10px_24px_rgba(0,0,0,0.06)] backdrop-blur">
      <div className="grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onChange(tab.id)}
              className={`flex min-w-0 h-[60px] flex-col items-center justify-center gap-1 rounded-[16px] text-[10px] font-black transition active:scale-95 ${
                isActive ? "bg-neutral-950 text-white shadow-sm" : "text-zinc-600"
              }`}
            >
              <Icon size={22} aria-hidden="true" strokeWidth={isActive ? 2.5 : 2} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.03] ${className}`}>{children}</div>;
}

function getDisplayName(profile: Profile) {
  const name = profile.name.trim();
  const emailPrefix = profile.email?.split("@")[0]?.trim();

  if (!name || (emailPrefix && name.toLowerCase() === emailPrefix.toLowerCase())) {
    return "Jogador";
  }

  return name;
}

function getFirstName(name: string) {
  return name.trim().split(" ")[0] || "Jogador";
}
